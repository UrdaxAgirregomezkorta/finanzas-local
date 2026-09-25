import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseAmount, parseDate } from '../src/lib/parsers/normalize.js';
import { rowsToTransactions, textToRows, parsePastedText } from '../src/lib/parsers/index.js';
import { categorizeOne } from '../src/lib/categorize.js';
import { generateMockTransactions } from '../src/lib/mockData.js';
import { prepareTransactions, mergeAndDetect } from '../src/lib/pipeline.js';
import { computeKpis, detectSubscriptions, antExpenses, bankBreakdown, availableMonths } from '../src/lib/analytics.js';
import { DEFAULT_SETTINGS } from '../src/lib/constants.js';
import { toggleTransferFlag } from '../src/lib/transfers.js';

test('importes en formatos españoles y anglosajones', () => {
  assert.equal(parseAmount('-1.234,56'), -1234.56);
  assert.equal(parseAmount('1.234,56 €'), 1234.56);
  assert.equal(parseAmount('−45,20'), -45.2);
  assert.equal(parseAmount('45,20-'), -45.2);
  assert.equal(parseAmount('(12,00)'), -12);
  assert.equal(parseAmount('-4.99', 'dot'), -4.99);
  assert.equal(parseAmount('1,234.56'), 1234.56);
  assert.equal(parseAmount('1.234'), 1234);
  assert.equal(parseAmount('€ -8,5'), -8.5);
  assert.equal(parseAmount(-12.3), -12.3);
});

test('fechas', () => {
  assert.equal(parseDate('05/03/2025'), '2025-03-05');
  assert.equal(parseDate('5-3-25'), '2025-03-05');
  assert.equal(parseDate('2025-03-05 10:22:01'), '2025-03-05');
  assert.equal(parseDate(45721), '2025-03-05');
  assert.equal(parseDate('31/02/2025'), null);
});

test('Revolut CSV se detecta y filtra pendientes', () => {
  const csv = `Type,Product,Started Date,Completed Date,Description,Amount,Fee,Currency,State,Balance
CARD_PAYMENT,Current,2025-03-01 09:10:11,2025-03-02 10:00:00,Starbucks,-4.50,0.00,EUR,COMPLETED,120.50
TOPUP,Current,2025-03-01 08:00:00,2025-03-01 08:00:01,Top-up by *4821,300.00,0.00,EUR,COMPLETED,125.00
CARD_PAYMENT,Current,2025-03-03 09:10:11,,Glovo,-18.20,0.00,EUR,PENDING,
CARD_PAYMENT,Current,2025-03-03 09:10:11,2025-03-04 09:00:00,Uber,-12.00,0.00,USD,COMPLETED,`;
  const r = rowsToTransactions(textToRows(csv), { fileName: 'account-statement.csv' });
  assert.equal(r.bank.bankId, 'revolut');
  assert.equal(r.transactions.length, 2);
  assert.equal(r.skipped.pending, 1);
  assert.equal(r.skipped.foreignCurrency, 1);
  assert.equal(r.transactions[0].amount, -4.5);
});

test('Santander con preámbulo e IBAN', () => {
  const rows = [
    ['Movimientos de cuenta'], ['Cuenta', 'ES21 0049 1234 5612 3456 7890'], [''],
    ['Fecha Operación', 'Fecha Valor', 'Concepto', 'Importe', 'Saldo'],
    ['03/03/2025', '03/03/2025', 'RECIBO IBERDROLA CLIENTES SAU', '-62,15', '1.234,56'],
    ['28/02/2025', '28/02/2025', 'NOMINA ACME SOLUTIONS SL', '2.485,32', '1.296,71'],
  ];
  const r = rowsToTransactions(rows, {});
  assert.equal(r.bank.bankId, 'santander');
  assert.equal(r.bank.confidence, 'high');
  assert.equal(r.transactions[1].amount, 2485.32);
});

test('Kutxabank con columnas Cargo/Abono y separador ;', () => {
  const csv = `Kutxabank - Extracto;;;;
Fecha;Concepto;Fecha valor;Cargo;Abono;Saldo
02/03/2025;PRESTAMO HIPOTECARIO CUOTA;02/03/2025;742,18;;3.100,00
28/02/2025;TRANSFERENCIA DE LUCIA MARTIN;28/02/2025;;1.100,00;3.842,18`;
  const r = rowsToTransactions(textToRows(csv), {});
  assert.equal(r.bank.bankId, 'kutxabank');
  assert.deepEqual(r.transactions.map((t) => t.amount), [-742.18, 1100]);
});

test('texto plano pegado', () => {
  const r = parsePastedText(`12/03/2025 COMPRA TARJ MERCADONA BILBAO -45,20 1.234,56
13/03/2025 13/03/2025 BIZUM RECIBIDO DE JON 15,00 1.249,56
basura sin formato`);
  assert.equal(r.transactions.length, 2);
  assert.equal(r.transactions[0].amount, -45.2);
  assert.equal(r.transactions[1].description, 'BIZUM RECIBIDO DE JON');
});

test('categorías', () => {
  assert.equal(categorizeOne('DIVIDENDO IBERDROLA SA', 38.4).category, 'rendimientos');
  assert.equal(categorizeOne('RECIBO IBERDROLA', -50).category, 'fijos');
  assert.equal(categorizeOne('Uber Eats', -20).category, 'ocio');
  assert.equal(categorizeOne('Uber', -20).category, 'transporte');
  assert.equal(categorizeOne('Amazon Prime', -4.99).category, 'suscripciones');
  assert.equal(categorizeOne('DIARIO EL CORREO', -2).category, 'otros');
  assert.equal(categorizeOne('CARD TRANSACTION', -2).category, 'otros');
  assert.equal(categorizeOne('MERCADONA', -30, [{ keyword: 'mercadona', category: 'ocio' }]).category, 'ocio');
});

test('pipeline completo con datos de ejemplo', () => {
  const raw = generateMockTransactions(new Date(2026, 8, 24));
  let all = [];
  for (const bank of ['santander', 'kutxabank', 'openbank', 'revolut']) {
    const { fresh } = prepareTransactions(raw.filter((t) => t.bank === bank), { bank, batchId: 'demo', userRules: [] });
    all = all.concat(fresh);
  }
  all = mergeAndDetect([], all, DEFAULT_SETTINGS);
  const transfers = all.filter((t) => t.is_internal_transfer);
  const months = availableMonths(all);
  console.log('movimientos', all.length, 'traspasos', transfers.length, 'meses', months);
  // 4 pares/mes + 1 par cada 2 meses
  assert.equal(transfers.length, 6 * 8 + 3 * 2);
  assert.ok(transfers.every((t) => t.transferPairId));
  const academy = all.find((t) => t.description.includes('ACADEMIA'));
  assert.equal(academy.is_internal_transfer, false);

  const k = computeKpis(all, months[0], DEFAULT_SETTINGS);
  console.log('KPIs', months[0], k);
  assert.ok(k.income > 2700 && k.income < 2900);

  const subs = detectSubscriptions(all);
  console.log('suscripciones', subs.items.map((s) => `${s.name} ${s.frequency} ${s.amount} ${s.active}`), subs.annualTotal);
  assert.ok(subs.items.some((s) => s.name === 'Headspace'));

  const ants = antExpenses(all, months[0], 8);
  console.log('hormiga', ants.total, ants.count, ants.monthlyAvg, ants.items.slice(0, 5).map((i) => i.name));
  const banks = bankBreakdown(all);
  console.log('fuga', banks.leakId, banks.rows.map((r) => `${r.name}:${r.discretionary}`));

  // Reimportar no duplica
  const hashes = new Set(all.map((t) => t.hash));
  const again = prepareTransactions(raw.filter((t) => t.bank === 'revolut'), { bank: 'revolut', batchId: 'x', userRules: [], existingHashes: hashes });
  assert.equal(again.fresh.length, 0);

  // Desmarcar una pata desmarca ambas
  const t0 = transfers[0];
  const toggled = toggleTransferFlag(all, t0.id);
  assert.equal(toggled.find((t) => t.id === t0.transferPairId).is_internal_transfer, false);
  const redetected = mergeAndDetect(toggled, [], DEFAULT_SETTINGS);
  assert.equal(redetected.find((t) => t.id === t0.id).is_internal_transfer, false);
});
