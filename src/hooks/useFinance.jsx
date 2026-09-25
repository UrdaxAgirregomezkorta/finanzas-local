import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { BANK_IDS, DEFAULT_SETTINGS } from '../lib/constants.js';
import { loadState, saveState, clearState } from '../lib/storage.js';
import { generateMockTransactions } from '../lib/mockData.js';
import { prepareTransactions, mergeAndDetect } from '../lib/pipeline.js';
import { categorizeAll, suggestRuleKeyword } from '../lib/categorize.js';
import { detectTransfers, toggleTransferFlag, resetManualTransfers } from '../lib/transfers.js';
import { normalizeText, uid } from '../lib/format.js';

const FinanceContext = createContext(null);

const TRANSFER_SETTINGS = ['ownerName', 'transferWindowDays', 'keywordSingleLegTransfers'];

function buildDemoState(settings = DEFAULT_SETTINGS) {
  const raw = generateMockTransactions();
  let all = [];
  const batches = [];
  for (const bank of BANK_IDS) {
    const batchId = `demo-${bank}`;
    const { fresh } = prepareTransactions(raw.filter((t) => t.bank === bank), { bank, batchId, userRules: [] });
    all = all.concat(fresh);
    batches.push({ id: batchId, bank, fileName: `Datos de ejemplo ${bank}`, count: fresh.length, importedAt: new Date().toISOString(), isDemo: true });
  }
  return { transactions: mergeAndDetect([], all, settings), userRules: [], batches, settings };
}

const emptyState = (settings = DEFAULT_SETTINGS) => ({ transactions: [], userRules: [], batches: [], settings });

export function FinanceProvider({ children }) {
  const [state, setState] = useState(null);
  const [saveInfo, setSaveInfo] = useState({ at: null, backend: null });
  const stateRef = useRef(state);
  stateRef.current = state;

  // Hidratación: datos guardados o demo en el primer arranque
  useEffect(() => {
    let alive = true;
    loadState().then((saved) => {
      if (!alive) return;
      if (saved && Array.isArray(saved.transactions)) {
        setState({
          transactions: saved.transactions,
          userRules: saved.userRules ?? [],
          batches: saved.batches ?? [],
          settings: { ...DEFAULT_SETTINGS, ...(saved.settings ?? {}) },
        });
        setSaveInfo({ at: saved.savedAt ?? null, backend: 'restaurado' });
      } else {
        setState(buildDemoState());
      }
    });
    return () => { alive = false; };
  }, []);

  // Autoguardado con retardo
  useEffect(() => {
    if (!state) return undefined;
    const h = setTimeout(async () => {
      const backend = await saveState(state);
      setSaveInfo({ at: new Date().toISOString(), backend });
    }, 400);
    return () => clearTimeout(h);
  }, [state]);

  const update = useCallback((fn) => setState((s) => (s ? fn(s) : s)), []);

  // Para acciones que devuelven un resumen: aplica el estado y actualiza la ref al momento,
  // así varias acciones seguidas (p. ej. "Importar todos") ven el estado más reciente.
  const commit = useCallback((next) => {
    stateRef.current = next;
    setState(next);
  }, []);

  // ───────────── Importación ─────────────
  const importParsed = useCallback(({ bank, fileName, transactions, removeDemo }) => {
    const s = stateRef.current;
    const keepBatches = removeDemo ? s.batches.filter((b) => !b.isDemo) : s.batches;
    const keepIds = new Set(keepBatches.map((b) => b.id));
    const existing = removeDemo ? s.transactions.filter((t) => keepIds.has(t.batchId)) : s.transactions;
    const batchId = uid('batch');
    const { fresh, duplicates } = prepareTransactions(transactions, {
      bank,
      batchId,
      userRules: s.userRules,
      existingHashes: new Set(existing.map((t) => t.hash)),
    });
    const before = new Set(existing.filter((t) => t.is_internal_transfer).map((t) => t.id));
    const merged = mergeAndDetect(existing, fresh, s.settings);
    const newTransfers = merged.filter((t) => t.is_internal_transfer && !before.has(t.id)).length;
    const batch = { id: batchId, bank, fileName, count: fresh.length, importedAt: new Date().toISOString(), isDemo: false };
    commit({ ...s, transactions: merged, batches: fresh.length ? [...keepBatches, batch] : keepBatches });
    return { added: fresh.length, duplicates, transfersDetected: newTransfers };
  }, [commit]);

  const removeBatch = useCallback((batchId) => {
    update((s) => ({
      ...s,
      transactions: detectTransfers(s.transactions.filter((t) => t.batchId !== batchId), s.settings),
      batches: s.batches.filter((b) => b.id !== batchId),
    }));
  }, [update]);

  const loadDemo = useCallback(() => {
    update((s) => {
      const demo = buildDemoState(s.settings);
      const real = s.transactions.filter((t) => !String(t.batchId).startsWith('demo'));
      return {
        ...s,
        transactions: mergeAndDetect(real, categorizeAll(demo.transactions, s.userRules), s.settings),
        batches: [...s.batches.filter((b) => !b.isDemo), ...demo.batches],
      };
    });
  }, [update]);

  const clearAll = useCallback(async () => {
    await clearState();
    setState((s) => emptyState(s?.settings));
  }, []);

  // ───────────── Categorías y reglas ─────────────
  const setCategory = useCallback((txId, category, { remember = true } = {}) => {
    const s = stateRef.current;
    const tx = s.transactions.find((t) => t.id === txId);
    if (!tx) return null;
    const snapshot = { transactions: s.transactions, userRules: s.userRules };

    if (!remember) {
      commit({
        ...s,
        transactions: s.transactions.map((t) => (t.id === txId ? { ...t, category, categorySource: 'manual' } : t)),
      });
      return { snapshot, rule: null, affected: 1 };
    }

    const keyword = suggestRuleKeyword(tx.description);
    const norm = normalizeText(keyword);
    const rule = { id: uid('rule'), keyword, category, createdAt: new Date().toISOString() };
    const userRules = [...s.userRules.filter((r) => normalizeText(r.keyword) !== norm), rule];
    const withManual = s.transactions.map((t) => (t.id === txId ? { ...t, category, categorySource: 'manual' } : t));
    const transactions = categorizeAll(withManual, userRules);
    const affected = transactions.filter((t, i) => t.category !== s.transactions[i].category).length;
    commit({ ...s, userRules, transactions });
    return { snapshot, rule, affected };
  }, []);

  const restoreSnapshot = useCallback((snap) => {
    update((s) => ({ ...s, ...snap }));
  }, [update]);

  const addRule = useCallback((keyword, category) => {
    const s = stateRef.current;
    const norm = normalizeText(keyword);
    if (!norm) return 0;
    const userRules = [...s.userRules.filter((r) => normalizeText(r.keyword) !== norm), { id: uid('rule'), keyword: keyword.trim(), category, createdAt: new Date().toISOString() }];
    const transactions = categorizeAll(s.transactions, userRules);
    const affected = transactions.filter((t, i) => t.category !== s.transactions[i].category).length;
    commit({ ...s, userRules, transactions });
    return affected;
  }, []);

  const updateRule = useCallback((ruleId, patch) => {
    update((s) => {
      const userRules = s.userRules.map((r) => (r.id === ruleId ? { ...r, ...patch } : r));
      return { ...s, userRules, transactions: categorizeAll(s.transactions, userRules) };
    });
  }, [update]);

  const deleteRule = useCallback((ruleId) => {
    update((s) => {
      const userRules = s.userRules.filter((r) => r.id !== ruleId);
      return { ...s, userRules, transactions: categorizeAll(s.transactions, userRules) };
    });
  }, [update]);

  const resetManualCategories = useCallback(() => {
    update((s) => ({
      ...s,
      transactions: categorizeAll(
        s.transactions.map((t) => (t.categorySource === 'manual' ? { ...t, categorySource: 'default' } : t)),
        s.userRules,
      ),
    }));
  }, [update]);

  // ───────────── Traspasos ─────────────
  const toggleTransfer = useCallback((txId) => {
    update((s) => ({ ...s, transactions: toggleTransferFlag(s.transactions, txId) }));
  }, [update]);

  const markPair = useCallback((outId, incId) => {
    update((s) => ({
      ...s,
      transactions: s.transactions.map((t) =>
        t.id === outId || t.id === incId
          ? { ...t, is_internal_transfer: true, transferManual: true, transferPairId: t.id === outId ? incId : outId, transferConfidence: 'manual' }
          : t,
      ),
    }));
  }, [update]);

  const rerunTransfers = useCallback(({ resetManual = false } = {}) => {
    const s = stateRef.current;
    const base = resetManual ? resetManualTransfers(s.transactions) : s.transactions;
    const transactions = detectTransfers(base, s.settings);
    commit({ ...s, transactions });
    return transactions.filter((t) => t.is_internal_transfer).length;
  }, []);

  // ───────────── Ajustes ─────────────
  const updateSettings = useCallback((patch) => {
    update((s) => {
      const settings = { ...s.settings, ...patch };
      const touchesTransfers = Object.keys(patch).some((k) => TRANSFER_SETTINGS.includes(k));
      return { ...s, settings, transactions: touchesTransfers ? detectTransfers(s.transactions, settings) : s.transactions };
    });
  }, [update]);

  const value = useMemo(() => {
    if (!state) return { ready: false };
    return {
      ready: true,
      ...state,
      isDemo: state.batches.some((b) => b.isDemo),
      saveInfo,
      importParsed, removeBatch, loadDemo, clearAll,
      setCategory, restoreSnapshot, addRule, updateRule, deleteRule, resetManualCategories,
      toggleTransfer, markPair, rerunTransfers,
      updateSettings,
    };
  }, [state, saveInfo, importParsed, removeBatch, loadDemo, clearAll, setCategory, restoreSnapshot, addRule, updateRule, deleteRule, resetManualCategories, toggleTransfer, markPair, rerunTransfers, updateSettings]);

  return <FinanceContext.Provider value={value}>{children}</FinanceContext.Provider>;
}

export function useFinance() {
  const ctx = useContext(FinanceContext);
  if (!ctx) throw new Error('useFinance debe usarse dentro de <FinanceProvider>');
  return ctx;
}
