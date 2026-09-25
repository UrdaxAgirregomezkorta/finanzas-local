import { BANKS, TRANSFER_KEYWORDS } from './constants.js';
import { normalizeText, daysBetween } from './format.js';
import { keywordMatches } from './categorize.js';

const TRANSFER_KW = TRANSFER_KEYWORDS.map(normalizeText);
const STRONG_SINGLE_LEG = ['TRASPASO', 'CUENTA PROPIA', 'ENTRE CUENTAS', 'TOP UP', 'TOPUP', 'MONEY ADDED', 'RECARGA DE', 'APPLE PAY DEPOSIT'];
const NEVER_TRANSFER = ['NOMINA', 'SALARIO', 'BIZUM', 'DIVIDENDO', 'INTERESES', 'RECIBO', 'HIPOTECA', 'PRESTAMO'];

function ownerTokens(ownerName) {
  return normalizeText(ownerName)
    .split(' ')
    .filter((w) => w.length >= 3)
    .slice(0, 2);
}

function signals(t, ownerToks) {
  const text = normalizeText(t.description);
  const mentionsBank = Object.values(BANKS)
    .filter((b) => b.id !== t.bank)
    .some((b) => keywordMatches(text, normalizeText(b.name)));
  return {
    text,
    keyword: TRANSFER_KW.some((k) => keywordMatches(text, k)),
    mentionsOtherBank: mentionsBank,
    owner: ownerToks.length > 0 && ownerToks.every((tok) => keywordMatches(text, tok)),
    topupType: t.rawType === 'TOPUP' || t.rawType === 'TRANSFER' || t.rawType === 'RECARGA' || t.rawType === 'TRANSFERENCIA',
    never: NEVER_TRANSFER.some((k) => keywordMatches(text, k)),
    strong: STRONG_SINGLE_LEG.some((k) => keywordMatches(text, k)),
  };
}

/**
 * Detecta traspasos entre cuentas propias y marca ambas patas con
 * is_internal_transfer = true para que no computen ni como gasto ni como ingreso.
 *
 * Heurística:
 *  1. Emparejamiento: salida en banco A e importe idéntico (al céntimo) de entrada en banco B ≠ A
 *     con diferencia de fechas ≤ ventana (por defecto ±2 días).
 *  2. Puntuación por cercanía temporal + señales textuales (palabras de traspaso, nombre del
 *     titular, mención del otro banco, tipo TOPUP de Revolut). Asignación voraz por puntuación
 *     para que cada movimiento solo pertenezca a un par.
 *  3. Opcional: movimientos sin pareja con señales inequívocas ("traspaso", "top-up", titular +
 *     transferencia) se marcan como traspaso de una sola pata (la otra cuenta no está importada).
 *  4. Las marcas manuales del usuario (transferManual) nunca se sobrescriben.
 */
export function detectTransfers(transactions, settings) {
  const windowDays = settings?.transferWindowDays ?? 2;
  const ownerToks = ownerTokens(settings?.ownerName ?? '');

  const txs = transactions.map((t) =>
    t.transferManual
      ? t
      : { ...t, is_internal_transfer: false, transferPairId: null, transferConfidence: null },
  );
  const byId = new Map(txs.map((t) => [t.id, t]));
  const sig = new Map(txs.map((t) => [t.id, signals(t, ownerToks)]));

  const incomingByCents = new Map();
  for (const t of txs) {
    if (t.transferManual || t.amount <= 0 || sig.get(t.id).never) continue;
    const k = Math.round(t.amount * 100);
    if (!incomingByCents.has(k)) incomingByCents.set(k, []);
    incomingByCents.get(k).push(t);
  }

  const edges = [];
  for (const out of txs) {
    if (out.transferManual || out.amount >= 0) continue;
    const so = sig.get(out.id);
    if (so.never) continue;
    const candidates = incomingByCents.get(Math.round(-out.amount * 100)) || [];
    for (const inc of candidates) {
      if (inc.bank === out.bank) continue;
      const days = daysBetween(out.date, inc.date);
      if (days > windowDays) continue;
      const si = sig.get(inc.id);
      let score = 100 - days * 12;
      if (so.keyword) score += 12;
      if (si.keyword) score += 12;
      if (so.mentionsOtherBank || si.mentionsOtherBank) score += 18;
      if (so.owner || si.owner) score += 18;
      if (so.topupType || si.topupType) score += 15;
      // Importes redondos son típicos de traspasos manuales
      if (Math.abs(out.amount) % 50 === 0) score += 5;
      edges.push({ out: out.id, inc: inc.id, score });
    }
  }

  edges.sort((a, b) => b.score - a.score);
  const used = new Set();
  for (const e of edges) {
    if (used.has(e.out) || used.has(e.inc)) continue;
    used.add(e.out);
    used.add(e.inc);
    const confidence = e.score >= 125 ? 'alta' : 'media';
    Object.assign(byId.get(e.out), { is_internal_transfer: true, transferPairId: e.inc, transferConfidence: confidence });
    Object.assign(byId.get(e.inc), { is_internal_transfer: true, transferPairId: e.out, transferConfidence: confidence });
  }

  if (settings?.keywordSingleLegTransfers !== false) {
    for (const t of txs) {
      if (t.transferManual || t.is_internal_transfer) continue;
      const s = sig.get(t.id);
      if (s.never) continue;
      const single = s.strong || s.topupType || (s.owner && (s.keyword || s.mentionsOtherBank)) || (s.keyword && s.mentionsOtherBank);
      if (single) Object.assign(t, { is_internal_transfer: true, transferPairId: null, transferConfidence: 'palabra clave' });
    }
  }

  return txs;
}

/**
 * Alterna manualmente la marca de traspaso. Al desmarcar una pata emparejada
 * se desmarcan ambas. Las marcas manuales quedan bloqueadas frente a la detección.
 */
export function toggleTransferFlag(transactions, id) {
  const target = transactions.find((t) => t.id === id);
  if (!target) return transactions;
  const next = !target.is_internal_transfer;
  const partnerId = target.transferPairId;

  return transactions.map((t) => {
    if (t.id === id) {
      return {
        ...t,
        is_internal_transfer: next,
        transferManual: true,
        transferPairId: next ? t.transferPairId : null,
        transferConfidence: next ? 'manual' : null,
      };
    }
    if (!next && partnerId && t.id === partnerId) {
      return { ...t, is_internal_transfer: false, transferManual: true, transferPairId: null, transferConfidence: null };
    }
    return t;
  });
}

/** Elimina todas las marcas manuales para que la detección vuelva a decidir. */
export function resetManualTransfers(transactions) {
  return transactions.map((t) => (t.transferManual ? { ...t, transferManual: false } : t));
}

/** Agrupa traspasos en pares para la vista "Movimientos entre cuentas". */
export function groupTransfers(transactions) {
  const byId = new Map(transactions.map((t) => [t.id, t]));
  const seen = new Set();
  const pairs = [];
  const singles = [];
  for (const t of transactions) {
    if (!t.is_internal_transfer || seen.has(t.id)) continue;
    const partner = t.transferPairId ? byId.get(t.transferPairId) : null;
    if (partner && partner.is_internal_transfer) {
      seen.add(t.id);
      seen.add(partner.id);
      const out = t.amount < 0 ? t : partner;
      const inc = t.amount < 0 ? partner : t;
      pairs.push({ id: `${out.id}:${inc.id}`, out, inc, amount: Math.abs(out.amount), date: out.date, confidence: t.transferConfidence });
    } else {
      seen.add(t.id);
      singles.push(t);
    }
  }
  pairs.sort((a, b) => b.date.localeCompare(a.date));
  singles.sort((a, b) => b.date.localeCompare(a.date));
  return { pairs, singles };
}

/**
 * Candidatos a traspaso no marcados: mismo importe opuesto en otro banco dentro de ventana ampliada (±5 días).
 * Útil para revisión manual.
 */
export function transferSuggestions(transactions, windowDays = 5) {
  const free = transactions.filter((t) => !t.is_internal_transfer);
  const ins = free.filter((t) => t.amount > 0);
  const out = [];
  for (const o of free) {
    if (o.amount >= 0) continue;
    const match = ins.find((i) => i.bank !== o.bank && Math.abs(i.amount + o.amount) < 0.005 && daysBetween(i.date, o.date) <= windowDays);
    if (match) out.push({ out: o, inc: match });
    if (out.length >= 20) break;
  }
  return out;
}
