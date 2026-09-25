import { categorizeOne } from './categorize.js';
import { detectTransfers } from './transfers.js';
import { normalizeText, uid } from './format.js';

/** Huella estable para deduplicar reimportaciones del mismo extracto. */
function baseKey(bank, t) {
  return `${bank}|${t.date}|${t.amount.toFixed(2)}|${normalizeText(t.description)}`;
}

/**
 * Convierte movimientos parseados en movimientos del sistema:
 * id, hash de deduplicación, categoría por reglas. No detecta traspasos (se hace sobre el total).
 */
export function prepareTransactions(parsed, { bank, batchId, userRules, existingHashes = new Set() }) {
  const occurrences = new Map();
  const fresh = [];
  let duplicates = 0;

  for (const p of parsed) {
    const base = baseKey(bank, p);
    const n = (occurrences.get(base) || 0) + 1;
    occurrences.set(base, n);
    const hash = `${base}#${n}`;
    if (existingHashes.has(hash)) {
      duplicates++;
      continue;
    }
    const cat = categorizeOne(p.description, p.amount, userRules);
    fresh.push({
      id: uid('tx'),
      hash,
      bank,
      date: p.date,
      valueDate: p.valueDate ?? null,
      description: p.description,
      amount: p.amount,
      balance: p.balance ?? null,
      currency: p.currency ?? 'EUR',
      rawType: p.rawType ?? null,
      category: cat.category,
      categorySource: cat.source,
      is_internal_transfer: false,
      transferPairId: null,
      transferConfidence: null,
      transferManual: false,
      batchId,
    });
  }
  return { fresh, duplicates };
}

/** Une movimientos nuevos con los existentes y relanza la detección de traspasos. */
export function mergeAndDetect(existing, fresh, settings) {
  const all = [...existing, ...fresh].sort((a, b) => b.date.localeCompare(a.date) || a.amount - b.amount);
  return detectTransfers(all, settings);
}
