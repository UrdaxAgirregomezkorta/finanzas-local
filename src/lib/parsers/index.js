import Papa from 'papaparse';
import { parseAmount, parseDate, looksLikeDate, looksLikeAmount } from './normalize.js';
import { mapHeader, isUsableMapping, detectBank } from './banks.js';
import { normalizeText } from '../format.js';

const MAX_HEADER_SCAN = 40;

// ─────────────────────────────────────────────────────────────
// Lectura de entrada → matriz de filas
// ─────────────────────────────────────────────────────────────

/** Lee un File del navegador y devuelve { rows, fileName, kind }. Todo ocurre en local. */
export async function readFile(file) {
  const name = file.name || 'archivo';
  const lower = name.toLowerCase();

  if (/\.(xlsx|xlsm|xls|ods)$/.test(lower)) {
    const XLSX = await import('xlsx'); // carga diferida: solo se descarga si subes un Excel
    const buf = await file.arrayBuffer();
    const wb = XLSX.read(buf, { type: 'array', cellDates: true });
    // Elegimos la hoja que tenga una cabecera reconocible (o la más larga)
    let best = null;
    for (const sheetName of wb.SheetNames) {
      const rows = XLSX.utils.sheet_to_json(wb.Sheets[sheetName], { header: 1, raw: true, defval: '', blankrows: false });
      const hasHeader = findHeader(rows).index > -1;
      const score = (hasHeader ? 1e6 : 0) + rows.length;
      if (!best || score > best.score) best = { rows, score };
    }
    return { rows: best?.rows ?? [], fileName: name, kind: 'excel' };
  }

  const text = await readText(file);
  return { rows: textToRows(text), fileName: name, kind: 'text' };
}

/** Lee texto detectando UTF-8 vs Windows-1252 (habitual en exportaciones de banca española). */
async function readText(file) {
  const buf = await file.arrayBuffer();
  const utf8 = new TextDecoder('utf-8', { fatal: false }).decode(buf);
  if (!utf8.includes('\uFFFD')) return utf8;
  try {
    return new TextDecoder('windows-1252').decode(buf);
  } catch {
    return utf8;
  }
}

/** Convierte texto pegado o CSV en filas. Detecta separador (; , tab |). */
export function textToRows(text) {
  const clean = String(text ?? '').replace(/^\uFEFF/, '').trim();
  if (!clean) return [];
  const res = Papa.parse(clean, { delimiter: '', skipEmptyLines: 'greedy' });
  const rows = res.data.map((r) => r.map((c) => (typeof c === 'string' ? c.trim() : c)));
  if (findHeader(rows).index > -1) return rows;

  // Sin cabecera reconocible: probamos el lector de texto plano (copiado desde la web del banco)
  const plain = plainTextToRows(clean);
  const lines = clean.split(/\r?\n/).filter((l) => l.trim()).length;
  if (plain.length - 1 >= lines * 0.5) return plain;

  const multiCol = rows.filter((r) => r.length > 2).length;
  if (multiCol >= Math.max(2, rows.length * 0.5)) return rows;
  return plain;
}

const DATE_RE = String.raw`(\d{1,2}[/.-]\d{1,2}[/.-]\d{2,4}|\d{4}-\d{2}-\d{2})`;
const AMOUNT_RE = String.raw`([-+−]?\s?\d{1,3}(?:\.\d{3})*(?:,\d{1,2})?|[-+−]?\d+(?:[.,]\d{1,2})?)\s?€?`;
const LINE_RE = new RegExp(String.raw`^${DATE_RE}\s+(?:${DATE_RE}\s+)?(.+?)\s+${AMOUNT_RE}(?:\s+${AMOUNT_RE})?\s*$`);

/** Extrae movimientos línea a línea: "12/03/2025 [12/03/2025] CONCEPTO -45,20 [1.234,56]". */
export function plainTextToRows(text) {
  const out = [['Fecha', 'Concepto', 'Importe', 'Saldo']];
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.replace(/\t+/g, ' ').replace(/\s{2,}/g, ' ').trim();
    const m = line.match(LINE_RE);
    if (!m) continue;
    const [, date, , desc, amount, balance] = m;
    out.push([date, desc, amount, balance ?? '']);
  }
  return out.length > 1 ? out : [];
}

// ─────────────────────────────────────────────────────────────
// Localización de cabecera y mapeo de columnas
// ─────────────────────────────────────────────────────────────

export function findHeader(rows) {
  const limit = Math.min(rows.length, MAX_HEADER_SCAN);
  for (let i = 0; i < limit; i++) {
    const row = rows[i];
    if (!row || row.filter((c) => String(c).trim()).length < 2) continue;
    const mapping = mapHeader(row);
    if (isUsableMapping(mapping)) return { index: i, mapping };
  }
  return { index: -1, mapping: null };
}

/** Sin cabecera: infiere columnas por contenido (fecha, importe, texto más largo). */
function inferMapping(rows) {
  const sample = rows.slice(0, 50).filter((r) => r && r.length >= 3);
  if (!sample.length) return null;
  const width = Math.max(...sample.map((r) => r.length));
  const stats = Array.from({ length: width }, (_, i) => {
    const vals = sample.map((r) => r[i]).filter((v) => v !== '' && v !== undefined && v !== null);
    return {
      i,
      date: vals.filter((v) => looksLikeDate(v)).length / sample.length,
      amount: vals.filter((v) => looksLikeAmount(v)).length / sample.length,
      textLen: vals.reduce((a, v) => a + (typeof v === 'string' && !looksLikeAmount(v) && !looksLikeDate(v) ? v.length : 0), 0),
    };
  });
  const date = stats.find((s) => s.date > 0.7);
  const amounts = stats.filter((s) => s.amount > 0.7 && s.i !== date?.i);
  const desc = [...stats].filter((s) => s.i !== date?.i).sort((a, b) => b.textLen - a.textLen)[0];
  if (!date || !amounts.length || !desc) return null;
  const mapping = { date: date.i, description: desc.i, amount: amounts[0].i };
  if (amounts[1]) mapping.balance = amounts[amounts.length - 1].i;
  return mapping;
}

// ─────────────────────────────────────────────────────────────
// Filas → movimientos normalizados
// ─────────────────────────────────────────────────────────────

const COMPLETED_STATES = new Set(['COMPLETED', 'COMPLETADO', 'COMPLETADA', 'COMPLETADOS', '']);

/**
 * @returns {{
 *   bank: {bankId, confidence, reason}, mapping, headerLabels: string[],
 *   transactions: Array<{date, valueDate, description, amount, balance, currency}>,
 *   skipped: { invalid: number, pending: number, foreignCurrency: number }
 * }}
 */
export function rowsToTransactions(rows, { fileName = '', bankOverride = null } = {}) {
  let { index, mapping } = findHeader(rows);
  let headerRow = [];
  let dataRows;

  if (index > -1) {
    headerRow = rows[index];
    dataRows = rows.slice(index + 1);
  } else {
    mapping = inferMapping(rows);
    dataRows = rows;
  }

  const preambleText = rows
    .slice(0, index > -1 ? index : 8)
    .map((r) => r.join(' '))
    .join(' ');

  const detected = detectBank({ fileName, preambleText, headerRow });
  const bank = bankOverride
    ? { bankId: bankOverride, confidence: 'manual', reason: 'Seleccionado manualmente' }
    : detected;

  const skipped = { invalid: 0, pending: 0, foreignCurrency: 0 };
  if (!mapping) return { bank, mapping: null, headerLabels: [], transactions: [], skipped, detected };

  const decimalHint = bank.bankId === 'revolut' ? 'dot' : 'auto';
  const transactions = [];

  for (const row of dataRows) {
    if (!row || row.every((c) => String(c).trim() === '')) continue;

    const date = parseDate(row[mapping.date]) ?? (mapping.valueDate !== undefined ? parseDate(row[mapping.valueDate]) : null);

    let amount;
    if (mapping.amount !== undefined) {
      amount = parseAmount(row[mapping.amount], decimalHint);
    } else {
      const debit = Math.abs(parseAmount(row[mapping.debit], decimalHint) || 0);
      const credit = Math.abs(parseAmount(row[mapping.credit], decimalHint) || 0);
      amount = Math.round((credit - debit) * 100) / 100;
    }

    const description = String(row[mapping.description] ?? '').replace(/\s+/g, ' ').trim();

    if (!date || !Number.isFinite(amount) || amount === 0 || !description) {
      skipped.invalid++;
      continue;
    }

    if (mapping.state !== undefined && !COMPLETED_STATES.has(normalizeText(row[mapping.state]))) {
      skipped.pending++;
      continue;
    }

    const currency = mapping.currency !== undefined ? String(row[mapping.currency] || 'EUR').trim().toUpperCase() : 'EUR';
    if (currency && currency !== 'EUR' && currency !== '€') {
      skipped.foreignCurrency++;
      continue;
    }

    if (mapping.fee !== undefined) {
      const fee = parseAmount(row[mapping.fee], decimalHint);
      if (Number.isFinite(fee) && fee !== 0) amount = Math.round((amount - Math.abs(fee)) * 100) / 100;
    }

    const balance = mapping.balance !== undefined ? parseAmount(row[mapping.balance], decimalHint) : NaN;

    transactions.push({
      date,
      valueDate: mapping.valueDate !== undefined ? parseDate(row[mapping.valueDate]) : null,
      description,
      amount,
      balance: Number.isFinite(balance) ? balance : null,
      currency: 'EUR',
      rawType: mapping.type !== undefined ? normalizeText(row[mapping.type]) : null,
    });
  }

  const headerLabels = Object.fromEntries(
    Object.entries(mapping).map(([field, i]) => [field, headerRow[i] ? String(headerRow[i]) : `Columna ${i + 1}`]),
  );

  return { bank, mapping, headerLabels, transactions, skipped, detected };
}

/** Atajo para texto pegado. */
export function parsePastedText(text, opts) {
  return rowsToTransactions(textToRows(text), { fileName: 'texto pegado', ...opts });
}
