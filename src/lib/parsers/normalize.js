/**
 * Convierte un importe en texto o número a Number.
 * Soporta: "-1.234,56", "1.234,56 €", "−45,20", "(45,20)", "1,234.56", "-4.99", "12.345" (miles español).
 * @param {'comma'|'dot'|'auto'} decimalHint
 */
export function parseAmount(value, decimalHint = 'auto') {
  if (value === null || value === undefined || value === '') return NaN;
  if (typeof value === 'number') return value;

  let s = String(value).trim();
  if (!s) return NaN;

  let negative = false;
  if (/^\(.*\)$/.test(s)) {
    negative = true;
    s = s.slice(1, -1);
  }
  s = s.replace(/[\u2212\u2012\u2013\u2014]/g, '-'); // signos menos tipográficos
  s = s.replace(/[€$£]|EUR|USD|GBP/gi, '').trim();
  if (/-\s*$/.test(s)) { negative = true; s = s.replace(/-\s*$/, ''); } // "45,20-"
  if (/^-/.test(s)) { negative = true; s = s.slice(1); }
  if (/^\+/.test(s)) s = s.slice(1);
  s = s.replace(/-/g, '');

  s = s.replace(/[\s\u00a0']/g, '');
  if (!/\d/.test(s)) return NaN;

  const lastComma = s.lastIndexOf(',');
  const lastDot = s.lastIndexOf('.');
  let normalized;

  if (lastComma > -1 && lastDot > -1) {
    // El último separador es el decimal
    normalized = lastComma > lastDot ? s.replace(/\./g, '').replace(',', '.') : s.replace(/,/g, '');
  } else if (lastComma > -1) {
    const decimals = s.length - lastComma - 1;
    const commas = (s.match(/,/g) || []).length;
    if (decimalHint === 'dot' && decimals === 3) normalized = s.replace(/,/g, '');
    else if (commas > 1) normalized = s.replace(/,/g, '');
    else normalized = s.replace(',', '.');
  } else if (lastDot > -1) {
    const decimals = s.length - lastDot - 1;
    const dots = (s.match(/\./g) || []).length;
    if (dots > 1) normalized = s.replace(/\./g, '');
    else if (decimals === 3 && decimalHint !== 'dot') normalized = s.replace('.', ''); // "1.234" → 1234
    else normalized = s;
  } else {
    normalized = s;
  }

  const n = Number(normalized);
  if (!Number.isFinite(n)) return NaN;
  return Math.round((negative ? -n : n) * 100) / 100;
}

const pad = (n) => String(n).padStart(2, '0');

function validYMD(y, m, d) {
  if (y < 1990 || y > 2100 || m < 1 || m > 12 || d < 1 || d > 31) return null;
  const dt = new Date(Date.UTC(y, m - 1, d));
  if (dt.getUTCMonth() !== m - 1) return null;
  return `${y}-${pad(m)}-${pad(d)}`;
}

/**
 * Convierte fechas de extractos a 'YYYY-MM-DD'.
 * Soporta Date, serial de Excel, dd/mm/yyyy, dd-mm-yy, dd.mm.yyyy, yyyy-mm-dd[ hh:mm:ss] y ISO.
 */
export function parseDate(value) {
  if (value === null || value === undefined || value === '') return null;

  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return validYMD(value.getFullYear(), value.getMonth() + 1, value.getDate());
  }

  if (typeof value === 'number') {
    // Serial de Excel (días desde 1899-12-30)
    if (value > 20000 && value < 80000) {
      const d = new Date(Date.UTC(1899, 11, 30) + Math.floor(value) * 86400000);
      return validYMD(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate());
    }
    return null;
  }

  const s = String(value).trim();
  let m = s.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/);
  if (m) return validYMD(+m[1], +m[2], +m[3]);

  m = s.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2,4})/);
  if (m) {
    let y = +m[3];
    if (y < 100) y += 2000;
    // Formato español dd/mm; si el "mes" es > 12, se asume mm/dd
    if (+m[2] > 12 && +m[1] <= 12) return validYMD(y, +m[1], +m[2]);
    return validYMD(y, +m[2], +m[1]);
  }

  // "15 mar 2025" / "15 de marzo de 2025"
  const months = { ene: 1, feb: 2, mar: 3, abr: 4, may: 5, jun: 6, jul: 7, ago: 8, sep: 9, set: 9, oct: 10, nov: 11, dic: 12, jan: 1, apr: 4, aug: 8, dec: 12 };
  m = s.toLowerCase().match(/^(\d{1,2})\s+(?:de\s+)?([a-z]{3})[a-z]*\.?\s+(?:de\s+)?(\d{4})/);
  if (m && months[m[2]]) return validYMD(+m[3], months[m[2]], +m[1]);

  return null;
}

export const looksLikeDate = (v) => parseDate(v) !== null;
export const looksLikeAmount = (v) => {
  if (typeof v === 'number') return true;
  const s = String(v ?? '').trim();
  return /^[-+(−]?\s*[\d.,\s]+\d\)?\s*(€|EUR)?-?$/.test(s) && Number.isFinite(parseAmount(s));
};
