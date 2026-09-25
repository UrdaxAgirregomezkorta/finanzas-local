import { CATEGORIES, SYSTEM_RULES } from './constants.js';
import { normalizeText, merchantKey } from './format.js';

/** Compila una palabra clave a su forma normalizada. */
const compileKeyword = (kw) => normalizeText(kw);

// Reglas del sistema precompiladas: [{ keyword, category, system: true }]
const COMPILED_SYSTEM = Object.entries(SYSTEM_RULES).flatMap(([category, kws]) =>
  kws.map((kw) => ({ keyword: compileKeyword(kw), category, system: true })).filter((r) => r.keyword),
);

/**
 * Coincidencia a inicio de palabra. Las claves cortas (≤ 4) exigen palabra completa,
 * así 'DIA' no casa con 'DIARIO' ni 'BAR' con 'BARCELONA'.
 */
export function keywordMatches(normalizedText, keyword) {
  const hay = ` ${normalizedText} `;
  if (keyword.length <= 4) return hay.includes(` ${keyword} `);
  return hay.includes(` ${keyword}`);
}

/**
 * Devuelve { category, keyword, source } para un movimiento.
 * Prioridad: reglas del usuario > regla del sistema más específica (clave más larga) > valor por defecto.
 */
export function categorizeOne(description, amount, userRules = []) {
  const text = normalizeText(description);

  const pick = (rules) => {
    let best = null;
    let bestScore = -1;
    for (const r of rules) {
      const cat = CATEGORIES[r.category];
      if (!cat) continue;
      // Las reglas de ingresos solo aplican a abonos, y en un abono tienen preferencia
      // ('DIVIDENDO IBERDROLA' es un rendimiento, no un recibo de luz)
      if (cat.kind === 'income' && amount <= 0) continue;
      if (!keywordMatches(text, r.keyword)) continue;
      const score = r.keyword.length + (cat.kind === 'income' ? 100 : 0);
      if (score > bestScore) {
        best = r;
        bestScore = score;
      }
    }
    return best;
  };

  const user = pick(userRules.map((r) => ({ ...r, keyword: compileKeyword(r.keyword) })));
  if (user) return { category: user.category, keyword: user.keyword, source: 'user-rule' };

  const sys = pick(COMPILED_SYSTEM);
  if (sys) return { category: sys.category, keyword: sys.keyword, source: 'rule' };

  return { category: amount > 0 ? 'ingresos' : 'otros', keyword: null, source: 'default' };
}

/**
 * Recategoriza una lista de movimientos respetando las asignaciones manuales.
 */
export function categorizeAll(transactions, userRules) {
  return transactions.map((t) => {
    if (t.categorySource === 'manual') return t;
    const r = categorizeOne(t.description, t.amount, userRules);
    if (r.category === t.category && r.source === t.categorySource) return t;
    return { ...t, category: r.category, categorySource: r.source };
  });
}

/** Propone la palabra clave con la que recordar una reasignación manual. */
export function suggestRuleKeyword(description) {
  const key = merchantKey(description);
  const [first, second] = key.split(' ');
  if (first && first.length >= 5) return first;
  return [first, second].filter(Boolean).join(' ');
}
