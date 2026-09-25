import { BANKS } from '../constants.js';
import { normalizeText } from '../format.js';

/**
 * Sinónimos de cabecera por campo lógico. Cubren los exportadores web/app de
 * Santander, Openbank, Kutxabank y Revolut (ES/EN), además de formatos genéricos.
 * Se comparan contra la cabecera normalizada (mayúsculas, sin tildes).
 */
export const COLUMN_SYNONYMS = {
  date: ['FECHA OPERACION', 'F OPERACION', 'FECHA OPER', 'FECHA DE OPERACION', 'FECHA', 'FECHA CONTABLE', 'FECHA MOVIMIENTO',
    'STARTED DATE', 'FECHA DE INICIO', 'DATE', 'COMPLETED DATE', 'FECHA DE FINALIZACION', 'FECHA COMPLETADA', 'DATA'],
  valueDate: ['FECHA VALOR', 'F VALOR', 'VALUE DATE'],
  description: ['CONCEPTO', 'DESCRIPCION', 'DESCRIPTION', 'CONCEPTO DESCRIPCION', 'MOVIMIENTO', 'DETALLE', 'CONCEPTO COMUN',
    'CONCEPTO PROPIO', 'OBSERVACIONES', 'REFERENCE', 'MERCHANT', 'CONCEPTE'],
  amount: ['IMPORTE', 'IMPORTE EUR', 'IMPORTE EUROS', 'IMPORTE E', 'AMOUNT', 'CANTIDAD', 'IMPORT', 'IMPORTE DIVISA'],
  debit: ['CARGO', 'CARGOS', 'DEBE', 'GASTO', 'GASTOS', 'DEBITO', 'SALIDA', 'PAID OUT'],
  credit: ['ABONO', 'ABONOS', 'HABER', 'INGRESO', 'INGRESOS', 'CREDITO', 'ENTRADA', 'PAID IN'],
  balance: ['SALDO', 'BALANCE', 'SALDO DISPONIBLE', 'SALDO CONTABLE', 'SALDO EUR'],
  currency: ['DIVISA', 'CURRENCY', 'MONEDA'],
  fee: ['COMISION', 'FEE', 'COMISIONES'],
  state: ['STATE', 'ESTADO'],
  type: ['TYPE', 'TIPO'],
  product: ['PRODUCT', 'PRODUCTO'],
};

/** Para cada celda de cabecera devuelve el campo lógico que mejor encaja (o null). */
export function mapHeader(headerRow) {
  const cells = headerRow.map((c) => normalizeText(c));
  const mapping = {};
  const used = new Set();

  // Primero coincidencias exactas, después parciales; los campos más específicos antes.
  const order = ['valueDate', 'date', 'description', 'amount', 'debit', 'credit', 'balance', 'currency', 'fee', 'state', 'type', 'product'];
  for (const pass of ['exact', 'partial']) {
    for (const field of order) {
      if (mapping[field] !== undefined) continue;
      const syns = COLUMN_SYNONYMS[field];
      const idx = cells.findIndex((c, i) => {
        if (used.has(i) || !c) return false;
        return pass === 'exact' ? syns.includes(c) : syns.some((s) => s.length > 3 && (c.startsWith(s) || c.endsWith(s)));
      });
      if (idx > -1) {
        mapping[field] = idx;
        used.add(idx);
      }
    }
  }
  return mapping;
}

export const isUsableMapping = (m) =>
  m.date !== undefined && m.description !== undefined && (m.amount !== undefined || m.debit !== undefined || m.credit !== undefined);

/**
 * Detecta el banco a partir del nombre de archivo, el preámbulo del extracto
 * (titular, IBAN, nombre del banco) y la firma de columnas.
 */
export function detectBank({ fileName = '', preambleText = '', headerRow = [] }) {
  const scores = { santander: 0, kutxabank: 0, openbank: 0, revolut: 0 };
  const reasons = {};
  const bump = (bank, pts, why) => {
    scores[bank] += pts;
    reasons[bank] = reasons[bank] || why;
  };

  const header = headerRow.map((c) => normalizeText(c));
  const has = (...names) => names.some((n) => header.includes(n));

  // 1) Firma inequívoca de Revolut
  if (has('STARTED DATE', 'FECHA DE INICIO') && has('PRODUCT', 'PRODUCTO')) bump('revolut', 10, 'columnas propias de Revolut');
  else if (has('COMPLETED DATE', 'FECHA DE FINALIZACION') && has('FEE', 'COMISION')) bump('revolut', 8, 'columnas propias de Revolut');

  // 2) IBAN español: el código de entidad identifica al banco
  const text = `${fileName} ${preambleText}`;
  const compact = text.toUpperCase().replace(/[\s-]+/g, '');
  const ibanRe = /ES\d{2}(\d{4})/g;
  let m;
  while ((m = ibanRe.exec(compact))) {
    const code = m[1];
    const bank = Object.values(BANKS).find((b) => b.ibanCode === code);
    if (bank) bump(bank.id, 8, `IBAN con código de entidad ${code}`);
  }
  if (/LT\d{2}3250/.test(compact)) bump('revolut', 8, 'IBAN lituano de Revolut');

  // 3) Nombre del banco en archivo o cabecera del extracto
  const names = { santander: ['SANTANDER'], kutxabank: ['KUTXABANK', 'KUTXA', 'CAJASUR'], openbank: ['OPENBANK'], revolut: ['REVOLUT'] };
  for (const [bank, kws] of Object.entries(names)) {
    const inFile = kws.some((k) => normalizeText(fileName).includes(k));
    const inPreamble = kws.some((k) => normalizeText(preambleText).includes(k));
    if (inFile) bump(bank, 5, 'nombre del archivo');
    if (inPreamble) bump(bank, 4, 'nombre del banco en el extracto');
  }

  // 4) Firma de columnas (pista débil; Santander y Openbank comparten plataforma)
  if (has('FECHA OPERACION', 'FECHA OPER') && has('FECHA VALOR') && has('IMPORTE EUR')) bump('santander', 2, 'formato de columnas Santander');
  else if (has('FECHA OPERACION') && has('FECHA VALOR') && has('IMPORTE')) {
    bump('openbank', 1.5, 'formato de columnas Openbank/Santander');
    bump('santander', 1, 'formato de columnas Openbank/Santander');
  }
  if (has('FECHA') && has('FECHA VALOR') && has('CONCEPTO') && !has('FECHA OPERACION')) bump('kutxabank', 1.5, 'formato de columnas Kutxabank');

  const ranked = Object.entries(scores).sort((a, b) => b[1] - a[1]);
  const [bestId, best] = ranked[0];
  const second = ranked[1][1];
  if (best <= 0) return { bankId: null, confidence: 'none', reason: 'No se ha podido identificar el banco' };
  const confidence = best >= 5 && best - second >= 3 ? 'high' : best - second >= 1 ? 'medium' : 'low';
  return { bankId: bestId, confidence, reason: reasons[bestId] };
}
