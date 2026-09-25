import { BANKS, CATEGORIES } from './constants.js';
import { txType } from './analytics.js';

const TYPE_LABEL = { income: 'Ingreso', expense: 'Gasto', transfer: 'Traspaso' };

function download(content, fileName, mime) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

const stamp = () => new Date().toISOString().slice(0, 10);

export function toExportRows(transactions) {
  return transactions.map((t) => ({
    fecha: t.date,
    banco: BANKS[t.bank]?.name ?? t.bank,
    concepto: t.description,
    importe: t.amount,
    tipo: TYPE_LABEL[txType(t)],
    categoria: t.is_internal_transfer ? 'Traspaso interno' : CATEGORIES[t.category]?.name ?? t.category,
    is_internal_transfer: !!t.is_internal_transfer,
    traspaso_confianza: t.transferConfidence ?? '',
    computa_en_balance: !t.is_internal_transfer,
  }));
}

export function exportCSV(transactions, name = 'balance-consolidado') {
  const rows = toExportRows(transactions);
  const headers = Object.keys(rows[0] ?? { fecha: '' });
  const esc = (v) => {
    const s = typeof v === 'number' ? v.toFixed(2).replace('.', ',') : String(v ?? '');
    return /[;"\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  // Separador ';' y BOM para que Excel en español lo abra correctamente
  const csv = '\uFEFF' + [headers.join(';'), ...rows.map((r) => headers.map((h) => esc(r[h])).join(';'))].join('\r\n');
  download(csv, `${name}-${stamp()}.csv`, 'text/csv;charset=utf-8');
}

export function exportJSON(transactions, summary, name = 'balance-consolidado') {
  const payload = { exportado: new Date().toISOString(), resumen: summary, movimientos: toExportRows(transactions) };
  download(JSON.stringify(payload, null, 2), `${name}-${stamp()}.json`, 'application/json');
}
