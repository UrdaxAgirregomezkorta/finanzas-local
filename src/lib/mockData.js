import { daysInMonth } from './format.js';

// PRNG determinista (mulberry32) para que la demo sea siempre igual
function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Genera 6 meses completos de movimientos (hasta el mes anterior al actual)
 * para Santander, Kutxabank, Openbank y Revolut, con traspasos internos,
 * suscripciones, gastos hormiga y alguna devolución.
 */
export function generateMockTransactions(now = new Date()) {
  const r = rng(20240917);
  const between = (min, max) => Math.round((min + r() * (max - min)) * 100) / 100;
  const pick = (arr) => arr[Math.floor(r() * arr.length)];
  const out = [];

  const months = [];
  for (let i = 6; i >= 1; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    months.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
  }

  const add = (bank, ym, day, description, amount, rawType = null) => {
    const dim = daysInMonth(ym);
    const d = Math.min(Math.max(1, day), dim);
    out.push({ bank, date: `${ym}-${String(d).padStart(2, '0')}`, description, amount: Math.round(amount * 100) / 100, rawType });
  };
  const card = (m) => `COMPRA TARJ. 5540XXXXXXXX1234 ${m}`;
  const nextDay = (ym, d) => Math.min(d + 1, daysInMonth(ym));

  months.forEach((ym, mi) => {
    const dim = daysInMonth(ym);
    const rand = (n, fn) => { for (let i = 0; i < n; i++) fn(1 + Math.floor(r() * dim)); };

    // ───────── Santander: nómina y domiciliaciones ─────────
    add('santander', ym, 27, 'NOMINA ACME SOLUTIONS SL', 2780.4);
    add('santander', ym, 2, 'RECIBO BASIC-FIT SPAIN SAU', -29.99);
    add('santander', ym, 3, 'RECIBO MOVISTAR FIBRA Y MOVIL', -58.9);
    add('santander', ym, 5, 'RECIBO IBERDROLA CLIENTES SAU', -between(48, 92));
    add('santander', ym, 6, 'RECIBO MUTUA MADRILEÑA SEGURO AUTO', -41.37);
    add('santander', ym, 8, card('NETFLIX.COM'), -13.99);
    add('santander', ym, 12, card('CLAUDE.AI SUBSCRIPTION'), -18.0);
    add('santander', ym, 10, 'TRANSFERENCIA A FAVOR DE ACADEMIA DE IDIOMAS LINGUA', -85);
    add('santander', ym, 9 + Math.floor(r() * 12), card('MERCADONA BILBAO'), -between(42, 88));
    if (r() > 0.4) add('santander', ym, 14 + Math.floor(r() * 10), 'PAGO MOVIL EN FARMACIA ARANA', -between(6, 24));
    if (mi % 2 === 0) add('santander', ym, 18, 'RETIRADA EFECTIVO CAJERO SANTANDER', -60);
    if (r() > 0.5) add('santander', ym, 20, 'BIZUM ENVIADO A ANE CENA', -between(12, 25));
    if (r() > 0.6) add('santander', ym, 22, 'BIZUM RECIBIDO DE JON REGALO', 15);

    // Traspasos internos desde Santander
    add('santander', ym, 28, 'TRANSFERENCIA A FAVOR DE LUCIA MARTIN GARCIA KUTXABANK', -1100);
    add('kutxabank', ym, 28, 'TRANSFERENCIA DE LUCIA MARTIN GARCIA', 1100);
    add('santander', ym, 28, 'TRASPASO A OPENBANK AHORRO', -400);
    add('openbank', ym, 29, 'TRANSFERENCIA RECIBIDA LUCIA MARTIN GARCIA', 400);
    add('santander', ym, 1, 'TRANSFERENCIA INMEDIATA A REVOLUT', -250);
    add('revolut', ym, 1, 'Top-up by *4821', 250, 'TOPUP');
    add('santander', ym, 15, 'TRANSFERENCIA INMEDIATA A REVOLUT', -250);
    add('revolut', ym, nextDay(ym, 15), 'Top-up by *4821', 250, 'TOPUP');

    // ───────── Kutxabank: hipoteca y fijos ─────────
    add('kutxabank', ym, 2, `PRESTAMO HIPOTECARIO CUOTA ${String(40 + mi).padStart(3, '0')}/300`, -742.18);
    add('kutxabank', ym, 4, 'RECIBO COMUNIDAD DE PROPIETARIOS ELCANO 14', -65);
    if (mi % 2 === 1) add('kutxabank', ym, 10, 'RECIBO CONSORCIO DE AGUAS BILBAO BIZKAIA', -between(28, 36));
    add('kutxabank', ym, 15, 'RECIBO MAPFRE SEGURO HOGAR', -24.8);
    if (mi === 2) add('kutxabank', ym, 20, 'RECIBO IBI AYUNTAMIENTO DE BILBAO', -312.45);
    if (r() > 0.3) add('kutxabank', ym, 6 + Math.floor(r() * 20), 'COMPRA EROSKI CITY DEUSTO', -between(18, 52));

    // ───────── Openbank: operativa y colchón ─────────
    add('openbank', ym, dim, 'LIQUIDACION INTERESES CUENTA REMUNERADA', between(6, 11));
    if (mi % 3 === 1) add('openbank', ym, 17, 'DIVIDENDO IBERDROLA SA', 38.4);
    add('openbank', ym, 7, 'COMPRA REPSOL E.S. BIDEBARRIETA', -between(45, 68));
    add('openbank', ym, 21, 'COMPRA REPSOL E.S. BIDEBARRIETA', -between(45, 68));
    add('openbank', ym, 11 + Math.floor(r() * 8), 'COMPRA LIDL SUPERMERCADOS', -between(22, 48));
    if (r() > 0.4) add('openbank', ym, 16, 'COMPRA AMAZON.ES MARKETPLACE', -between(18, 55));
    if (mi % 2 === 0) {
      add('openbank', ym, 20, 'TRANSFERENCIA A REVOLUT LUCIA MARTIN', -150);
      add('revolut', ym, 21, 'Payment from Lucia Martin Garcia', 150, 'TRANSFER');
    }

    // ───────── Revolut: día a día ─────────
    // Suscripciones
    add('revolut', ym, 9, 'Spotify', -10.99, 'CARD_PAYMENT');
    add('revolut', ym, 13, 'GitHub', -3.71, 'CARD_PAYMENT');
    add('revolut', ym, 18, 'Amazon Prime', -4.99, 'CARD_PAYMENT');
    add('revolut', ym, 11, 'Apple.com/bill iCloud', -2.99, 'CARD_PAYMENT');
    add('revolut', ym, 24, 'Headspace', -12.99, 'CARD_PAYMENT');
    if (mi >= 3) add('revolut', ym, 22, 'Disney Plus', -9.99, 'CARD_PAYMENT');

    // Gastos hormiga
    rand(12 + Math.floor(r() * 5), (d) => add('revolut', ym, d, 'Cafeteria La Esquina', -pick([1.6, 1.8, 2.1, 2.4]), 'CARD_PAYMENT'));
    rand(3, (d) => add('revolut', ym, d, 'Starbucks', -between(4.2, 6.4), 'CARD_PAYMENT'));
    rand(6, (d) => add('revolut', ym, d, 'Panaderia Iturri', -between(1.5, 3.8), 'CARD_PAYMENT'));
    rand(4, (d) => add('revolut', ym, d, 'Vending Selecta Oficina', -pick([1.2, 1.5, 1.8, 2.0]), 'CARD_PAYMENT'));
    rand(3, (d) => add('revolut', ym, d, 'Kiosko Plaza Moyua', -between(1.5, 4.5), 'CARD_PAYMENT'));

    // Supermercado
    rand(4, (d) => add('revolut', ym, d, 'Mercadona', -between(24, 78), 'CARD_PAYMENT'));
    rand(2, (d) => add('revolut', ym, d, 'Lidl', -between(12, 38), 'CARD_PAYMENT'));
    rand(1, (d) => add('revolut', ym, d, 'Carrefour Express', -between(8, 26), 'CARD_PAYMENT'));

    // Ocio y restauración
    rand(2, (d) => add('revolut', ym, d, 'Glovo', -between(14, 29), 'CARD_PAYMENT'));
    rand(1, (d) => add('revolut', ym, d, 'Uber Eats', -between(16, 31), 'CARD_PAYMENT'));
    rand(3, (d) => add('revolut', ym, d, 'Bar Txoko Zaharra', -between(8.5, 26), 'CARD_PAYMENT'));
    rand(1, (d) => add('revolut', ym, d, 'Restaurante Arrantzale', -between(34, 72), 'CARD_PAYMENT'));
    if (mi % 2 === 0) rand(1, (d) => add('revolut', ym, d, 'Yelmo Cines Artea', -between(9, 18), 'CARD_PAYMENT'));

    // Transporte
    rand(5, (d) => add('revolut', ym, d, 'Metro Bilbao', -pick([1.75, 1.75, 2.6]), 'CARD_PAYMENT'));
    rand(1, (d) => add('revolut', ym, d, 'Renfe Viajeros', -between(18, 46), 'CARD_PAYMENT'));
    rand(1, (d) => add('revolut', ym, d, 'Cabify', -between(9, 19), 'CARD_PAYMENT'));

    // Compras
    rand(1, (d) => add('revolut', ym, d, 'Zara', -between(25, 62), 'CARD_PAYMENT'));
    rand(2, (d) => add('revolut', ym, d, 'Amazon', -between(12, 46), 'CARD_PAYMENT'));
    if (mi === 3) add('revolut', ym, 26, 'Amazon', 19.99, 'CARD_REFUND');
  });

  return out;
}
