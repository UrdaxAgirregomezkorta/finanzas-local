import { BANKS, BANK_IDS, CATEGORIES, NON_ANT_CATEGORIES } from './constants.js';
import { monthOf, daysInMonth, prevMonth, fmtMonth, daysBetween, addDays, merchantKey, prettyMerchant } from './format.js';

const round2 = (n) => Math.round(n * 100) / 100;

/** Tipo visible del movimiento: 'transfer' | 'income' | 'expense'. */
export function txType(t) {
  if (t.is_internal_transfer) return 'transfer';
  return t.amount > 0 ? 'income' : 'expense';
}

/** Aportación del movimiento a ingresos y gastos (los traspasos aportan 0 a ambos). */
function contribution(t) {
  if (t.is_internal_transfer) return { income: 0, expense: 0 };
  const cat = CATEGORIES[t.category] ?? CATEGORIES.otros;
  if (cat.kind === 'income') return { income: t.amount, expense: 0 };
  // En categorías de gasto un abono es una devolución y resta gasto
  return { income: 0, expense: -t.amount };
}

export function totals(txs) {
  let income = 0, expenses = 0, fixed = 0, transfersVolume = 0, transfersCount = 0;
  for (const t of txs) {
    if (t.is_internal_transfer) {
      transfersCount++;
      if (t.amount < 0) transfersVolume += -t.amount;
      continue;
    }
    const c = contribution(t);
    income += c.income;
    expenses += c.expense;
    if (CATEGORIES[t.category]?.fixed) fixed += c.expense;
  }
  const net = income - expenses;
  return {
    income: round2(income),
    expenses: round2(expenses),
    fixed: round2(fixed),
    variable: round2(expenses - fixed),
    net: round2(net),
    savingsRate: income > 0 ? net / income : 0,
    transfersVolume: round2(transfersVolume),
    transfersCount,
  };
}

export function availableMonths(txs) {
  return [...new Set(txs.map((t) => monthOf(t.date)))].sort().reverse();
}

export function filterByPeriod(txs, period) {
  if (!period || period === 'all') return txs;
  return txs.filter((t) => t.date.startsWith(period));
}

/** KPIs del periodo + variación frente al mes anterior. */
export function computeKpis(allTxs, period, settings) {
  const current = totals(filterByPeriod(allTxs, period));
  const previous = period && period !== 'all' ? totals(filterByPeriod(allTxs, prevMonth(period))) : null;
  const target = Math.max(0, current.income * ((settings?.savingsTargetPct ?? 20) / 100));
  const freeToSpend = current.income - current.fixed - target - current.variable;
  const delta = (a, b) => (b && Math.abs(b) > 0.01 ? (a - b) / Math.abs(b) : null);

  return {
    ...current,
    savingsTarget: round2(target),
    freeToSpend: round2(freeToSpend),
    // Presupuesto variable total que permitía el mes (para la barra de reparto)
    variableBudget: round2(Math.max(0, current.income - current.fixed - target)),
    deltas: previous
      ? {
          income: delta(current.income, previous.income),
          expenses: delta(current.expenses, previous.expenses),
          net: delta(current.net, previous.net),
          savingsRate: previous.income > 0 ? current.savingsRate - previous.savingsRate : null,
        }
      : null,
    previous,
  };
}

/** Gasto por categoría para el donut. */
export function expensesByCategory(txs, { discretionaryOnly = false } = {}) {
  const map = new Map();
  for (const t of txs) {
    if (t.is_internal_transfer) continue;
    const cat = CATEGORIES[t.category] ?? CATEGORIES.otros;
    if (cat.kind !== 'expense') continue;
    if (discretionaryOnly && cat.fixed) continue;
    map.set(cat.id, (map.get(cat.id) || 0) - t.amount);
  }
  return [...map.entries()]
    .filter(([, v]) => v > 0.005)
    .map(([id, value]) => ({ id, name: CATEGORIES[id].name, color: CATEGORIES[id].color, value: round2(value) }))
    .sort((a, b) => b.value - a.value);
}

/** Ingresos vs gastos por mes (últimos n meses con datos). */
export function monthlySeries(allTxs, n = 12) {
  const months = availableMonths(allTxs).slice(0, n).reverse();
  return months.map((m) => {
    const t = totals(filterByPeriod(allTxs, m));
    return { month: m, label: fmtMonth(m, { short: true }), income: t.income, expenses: t.expenses, net: t.net };
  });
}

/** Flujo neto acumulado día a día del mes, comparado con el mes anterior. */
export function cumulativeFlow(allTxs, month) {
  if (!month || month === 'all') month = availableMonths(allTxs)[0];
  if (!month) return { month: null, data: [] };
  const prev = prevMonth(month);
  const days = daysInMonth(month);

  const daily = (m) => {
    const arr = new Array(32).fill(0);
    for (const t of filterByPeriod(allTxs, m)) {
      const c = contribution(t);
      arr[+t.date.slice(8, 10)] += c.income - c.expense;
    }
    return arr;
  };
  const cur = daily(month);
  const pre = daily(prev);
  const lastDayWithData = Math.max(0, ...filterByPeriod(allTxs, month).map((t) => +t.date.slice(8, 10)));
  const today = new Date();
  const isCurrentMonth = month === `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
  const cutoff = isCurrentMonth ? Math.max(lastDayWithData, today.getDate()) : days;
  const hasPrev = filterByPeriod(allTxs, prev).length > 0;

  let accC = 0, accP = 0;
  const data = [];
  for (let d = 1; d <= days; d++) {
    accC += cur[d];
    accP += pre[d];
    data.push({ day: d, actual: d <= cutoff ? round2(accC) : null, previous: hasPrev ? round2(accP) : null });
  }
  return { month, prev: hasPrev ? prev : null, data };
}

/** Gastos hormiga: micro-compras ≤ umbral en categorías discrecionales. */
export function antExpenses(allTxs, period, threshold = 8) {
  const isAnt = (t) =>
    !t.is_internal_transfer && t.amount < 0 && -t.amount <= threshold && !NON_ANT_CATEGORIES.has(t.category);

  const all = allTxs.filter(isAnt);
  const scoped = filterByPeriod(all, period);
  const monthsWithData = Math.max(1, availableMonths(allTxs).length);

  const groups = new Map();
  for (const t of scoped) {
    const key = merchantKey(t.description);
    const g = groups.get(key) || { key, name: prettyMerchant(key), count: 0, total: 0, banks: new Set(), category: t.category, last: t.date };
    g.count++;
    g.total -= t.amount;
    g.banks.add(t.bank);
    if (t.date > g.last) g.last = t.date;
    groups.set(key, g);
  }

  const items = [...groups.values()]
    .map((g) => ({ ...g, total: round2(g.total), avg: round2(g.total / g.count), banks: [...g.banks] }))
    .sort((a, b) => b.total - a.total);

  const periodTotal = round2(scoped.reduce((a, t) => a - t.amount, 0));
  const monthlyAvg = round2(all.reduce((a, t) => a - t.amount, 0) / monthsWithData);

  return {
    items,
    total: periodTotal,
    count: scoped.length,
    monthlyAvg,
    annualProjection: round2(monthlyAvg * 12),
    // Mes a mes para el mini-histograma
    byMonth: availableMonths(allTxs)
      .slice(0, 6)
      .reverse()
      .map((m) => ({ month: m, label: fmtMonth(m, { short: true }), total: round2(filterByPeriod(all, m).reduce((a, t) => a - t.amount, 0)) })),
  };
}

const FREQUENCIES = [
  { id: 'semanal', min: 5, max: 9, perYear: 52 },
  { id: 'mensual', min: 25, max: 35, perYear: 12 },
  { id: 'trimestral', min: 80, max: 100, perYear: 4 },
  { id: 'anual', min: 330, max: 400, perYear: 1 },
];

const median = (arr) => {
  const s = [...arr].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
};

/** Detecta cobros periódicos (suscripciones) a partir de todo el histórico. */
export function detectSubscriptions(allTxs) {
  const referenceDate = allTxs.reduce((max, t) => (t.date > max ? t.date : max), '0000-00-00');
  const groups = new Map();
  for (const t of allTxs) {
    if (t.is_internal_transfer || t.amount >= 0) continue;
    const cat = CATEGORIES[t.category];
    if (!cat || cat.kind !== 'expense' || cat.fixed) continue;
    const key = merchantKey(t.description);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(t);
  }

  const subs = [];
  for (const [key, list] of groups) {
    list.sort((a, b) => a.date.localeCompare(b.date));
    const isSubCategory = list.some((t) => t.category === 'suscripciones');
    const amounts = list.map((t) => -t.amount);
    const medAmount = median(amounts);
    const maxDeviation = Math.max(...amounts.map((a) => Math.abs(a - medAmount) / medAmount));
    const last = list[list.length - 1];

    let freq = null;
    if (list.length >= 2) {
      const intervals = list.slice(1).map((t, i) => daysBetween(list[i].date, t.date));
      const medInterval = median(intervals);
      freq = FREQUENCIES.find((f) => medInterval >= f.min && medInterval <= f.max) || null;
      if (freq && freq.id === 'semanal' && !isSubCategory) freq = null;
    }

    const periodicAndStable = freq && maxDeviation <= 0.05 && ['otros', 'compras', 'ocio'].includes(last.category);
    if (!isSubCategory && !periodicAndStable) continue;
    if (!isSubCategory && freq?.id === 'mensual' && list.length < 3) continue; // evita falsos positivos con 2 cobros

    const effectiveFreq = freq || (medAmount > 60 ? FREQUENCIES[3] : FREQUENCIES[1]);
    const interval = Math.round((effectiveFreq.min + effectiveFreq.max) / 2);
    const lastAmount = -last.amount;
    const active = daysBetween(last.date, referenceDate) <= interval * 1.5;

    subs.push({
      key,
      name: prettyMerchant(key),
      bank: last.bank,
      amount: round2(lastAmount),
      frequency: effectiveFreq.id,
      estimated: !freq,
      charges: list.length,
      lastCharge: last.date,
      nextCharge: addDays(last.date, interval),
      annualCost: round2(lastAmount * effectiveFreq.perYear),
      monthlyCost: round2((lastAmount * effectiveFreq.perYear) / 12),
      priceChanged: list.length >= 2 && Math.abs(-list[list.length - 2].amount - lastAmount) > 0.01,
      active,
      category: last.category,
    });
  }

  subs.sort((a, b) => Number(b.active) - Number(a.active) || b.annualCost - a.annualCost);
  const active = subs.filter((s) => s.active);
  return {
    items: subs,
    activeCount: active.length,
    annualTotal: round2(active.reduce((a, s) => a + s.annualCost, 0)),
    monthlyTotal: round2(active.reduce((a, s) => a + s.monthlyCost, 0)),
  };
}

/** Comparativa por banco: dónde se va el gasto prescindible. */
export function bankBreakdown(txs, antThreshold = 8) {
  const rows = BANK_IDS.map((id) => {
    const list = txs.filter((t) => t.bank === id);
    const t = totals(list);
    const byCat = expensesByCategory(list, { discretionaryOnly: true });
    const ant = list
      .filter((x) => !x.is_internal_transfer && x.amount < 0 && -x.amount <= antThreshold && !NON_ANT_CATEGORIES.has(x.category))
      .reduce((a, x) => a - x.amount, 0);
    const subs = list
      .filter((x) => !x.is_internal_transfer && x.category === 'suscripciones')
      .reduce((a, x) => a - x.amount, 0);
    return {
      id,
      name: BANKS[id].name,
      color: BANKS[id].color,
      role: BANKS[id].role,
      count: list.length,
      income: t.income,
      expenses: t.expenses,
      fixed: t.fixed,
      discretionary: t.variable,
      ant: round2(ant),
      subscriptions: round2(subs),
      topCategory: byCat[0] ?? null,
      transfersOut: round2(list.filter((x) => x.is_internal_transfer && x.amount < 0).reduce((a, x) => a - x.amount, 0)),
    };
  });
  const totalDisc = rows.reduce((a, r) => a + Math.max(0, r.discretionary), 0);
  const leak = [...rows].sort((a, b) => b.discretionary - a.discretionary)[0];
  return {
    rows: rows.map((r) => ({ ...r, share: totalDisc > 0 ? Math.max(0, r.discretionary) / totalDisc : 0 })),
    leakId: leak && leak.discretionary > 0 ? leak.id : null,
  };
}
