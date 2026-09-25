const eur = new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR', minimumFractionDigits: 2, maximumFractionDigits: 2 });
const eurCompact = new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 });
const pct = new Intl.NumberFormat('es-ES', { style: 'percent', maximumFractionDigits: 1, minimumFractionDigits: 1 });

export const fmtEUR = (n) => eur.format(Number.isFinite(n) ? n : 0);
export const fmtEUR0 = (n) => eurCompact.format(Number.isFinite(n) ? n : 0);
export const fmtPct = (n) => pct.format(Number.isFinite(n) ? n : 0);
export const fmtSigned = (n) => (n > 0 ? '+' : n < 0 ? '−' : '') + eur.format(Math.abs(n));

const MONTHS = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
const MONTHS_SHORT = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

/** 'YYYY-MM-DD' → '12 mar 2025' */
export function fmtDate(iso, { year = true } = {}) {
  if (!iso) return '';
  const [y, m, d] = iso.split('-').map(Number);
  return `${d} ${MONTHS_SHORT[m - 1]}${year ? ` ${y}` : ''}`;
}

/** 'YYYY-MM' → 'marzo 2025' */
export function fmtMonth(ym, { short = false } = {}) {
  if (!ym || ym === 'all') return 'Todo el histórico';
  const [y, m] = ym.split('-').map(Number);
  return short ? `${MONTHS_SHORT[m - 1]} ${String(y).slice(2)}` : `${MONTHS[m - 1]} ${y}`;
}

export const monthOf = (iso) => iso.slice(0, 7);

export function toISODate(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/** Días entre dos fechas ISO (valor absoluto). */
export function daysBetween(a, b) {
  const da = Date.UTC(+a.slice(0, 4), +a.slice(5, 7) - 1, +a.slice(8, 10));
  const db = Date.UTC(+b.slice(0, 4), +b.slice(5, 7) - 1, +b.slice(8, 10));
  return Math.round(Math.abs(da - db) / 86400000);
}

export function addDays(iso, n) {
  const d = new Date(Date.UTC(+iso.slice(0, 4), +iso.slice(5, 7) - 1, +iso.slice(8, 10) + n));
  return d.toISOString().slice(0, 10);
}

export function daysInMonth(ym) {
  const [y, m] = ym.split('-').map(Number);
  return new Date(Date.UTC(y, m, 0)).getUTCDate();
}

export function prevMonth(ym) {
  const [y, m] = ym.split('-').map(Number);
  const d = new Date(Date.UTC(y, m - 2, 1));
  return d.toISOString().slice(0, 7);
}

/** Mayúsculas, sin tildes, solo alfanumérico separado por espacios simples. */
export function normalizeText(s) {
  return String(s ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, ' ')
    .trim();
}

const NOISE = new Set([
  'COMPRA', 'COMPRAS', 'EN', 'TARJ', 'TARJETA', 'TARJ CRED', 'CRED', 'DEB', 'DEBITO', 'CREDITO', 'PAGO', 'PAGOS', 'MOVIL',
  'CON', 'CONTACTLESS', 'APPLE', 'PAY', 'GOOGLE', 'RECIBO', 'ADEUDO', 'DOMICILIACION', 'CARGO', 'CARD', 'PAYMENT', 'TO',
  'FROM', 'DE', 'DEL', 'LA', 'EL', 'LOS', 'LAS', 'SL', 'SA', 'SLU', 'S', 'L', 'U', 'ES', 'ESP', 'OPERACION', 'FECHA',
  'NUM', 'N', 'REF', 'A', 'FAVOR', 'TRANSFERENCIA', 'INMEDIATA', 'BY', 'WWW', 'COM', 'BILL', 'AL', 'REFERENCIA', 'NO', 'PAGO', 'POS', 'TPV', 'COMERCIO', 'VISA', 'MASTERCARD', 'CLASSIC', 'ORO',
]);

/**
 * Extrae una "clave de comercio" estable a partir del concepto bancario.
 * 'COMPRA TARJ. 5540XXXXXXXX1234 MERCADONA VALENCIA' → 'MERCADONA VALENCIA'
 */
export function merchantKey(description) {
  const words = normalizeText(description)
    .split(' ')
    .filter((w) => w && !NOISE.has(w) && !/\d{3,}/.test(w) && !/^X+\d*$/.test(w) && !/^\d{1,2}$/.test(w));
  return words.slice(0, 2).join(' ') || normalizeText(description).slice(0, 24) || 'SIN CONCEPTO';
}

/** Versión legible de la clave de comercio ('MERCADONA VALENCIA' → 'Mercadona Valencia'). */
export function prettyMerchant(key) {
  return key
    .toLowerCase()
    .split(' ')
    .map((w) => (w.length <= 2 ? w.toUpperCase() : w[0].toUpperCase() + w.slice(1)))
    .join(' ');
}

export function uid(prefix = 'id') {
  const rnd = typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID().slice(0, 8) : Math.random().toString(36).slice(2, 10);
  return `${prefix}_${Date.now().toString(36)}${rnd}`;
}
