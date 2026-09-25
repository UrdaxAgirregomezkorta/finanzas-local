// ─────────────────────────────────────────────────────────────
// Bancos soportados
// ─────────────────────────────────────────────────────────────
export const BANKS = {
  santander: {
    id: 'santander',
    name: 'Santander',
    role: 'Nómina y domiciliaciones',
    color: '#f07474',
    ibanCode: '0049',
  },
  kutxabank: {
    id: 'kutxabank',
    name: 'Kutxabank',
    role: 'Hipoteca y gastos fijos',
    color: '#4fc7b4',
    ibanCode: '2095',
  },
  openbank: {
    id: 'openbank',
    name: 'Openbank',
    role: 'Operativa y colchón',
    color: '#e58ac4',
    ibanCode: '0073',
  },
  revolut: {
    id: 'revolut',
    name: 'Revolut',
    role: 'Día a día y suscripciones',
    color: '#79a8f5',
    ibanCode: '1583',
  },
};

export const BANK_IDS = Object.keys(BANKS);

// ─────────────────────────────────────────────────────────────
// Categorías
// kind: 'income' suma a ingresos, 'expense' suma a gastos
// (un importe positivo en una categoría de gasto es una devolución y resta gasto).
// fixed: gasto comprometido (se oculta en la vista "solo discrecional").
// ─────────────────────────────────────────────────────────────
export const CATEGORIES = {
  fijos: { id: 'fijos', name: 'Gastos fijos', kind: 'expense', fixed: true, color: '#8b93b8' },
  supermercado: { id: 'supermercado', name: 'Supermercado', kind: 'expense', color: '#5fd3a4' },
  ocio: { id: 'ocio', name: 'Ocio y restauración', kind: 'expense', color: '#f2b36b' },
  suscripciones: { id: 'suscripciones', name: 'Suscripciones', kind: 'expense', color: '#b39cf5' },
  transporte: { id: 'transporte', name: 'Transporte', kind: 'expense', color: '#6fc3e8' },
  compras: { id: 'compras', name: 'Compras', kind: 'expense', color: '#e88fb0' },
  salud: { id: 'salud', name: 'Salud', kind: 'expense', color: '#7fd6c9' },
  efectivo: { id: 'efectivo', name: 'Efectivo y Bizum', kind: 'expense', color: '#c9b98a' },
  otros: { id: 'otros', name: 'Otros gastos', kind: 'expense', color: '#71717a' },
  ingresos: { id: 'ingresos', name: 'Nómina e ingresos', kind: 'income', color: '#5fd3a4' },
  rendimientos: { id: 'rendimientos', name: 'Rendimientos y ahorro', kind: 'income', color: '#9aa5ff' },
};

export const CATEGORY_IDS = Object.keys(CATEGORIES);
export const EXPENSE_CATEGORY_IDS = CATEGORY_IDS.filter((c) => CATEGORIES[c].kind === 'expense');

// Categorías que nunca cuentan como "gasto hormiga"
export const NON_ANT_CATEGORIES = new Set(['fijos', 'suscripciones', 'transporte', 'salud', 'efectivo', 'ingresos', 'rendimientos']);

// ─────────────────────────────────────────────────────────────
// Reglas del sistema (palabras clave). Gana la coincidencia más larga;
// las reglas del usuario siempre tienen prioridad.
// Palabras de ≤ 4 caracteres se comparan como palabra completa.
// ─────────────────────────────────────────────────────────────
export const SYSTEM_RULES = {
  fijos: [
    'hipoteca', 'prestamo hipotecario', 'cuota prestamo', 'alquiler', 'arrendamiento', 'comunidad de propietarios',
    'comunidad prop', 'cdad prop', 'iberdrola', 'endesa', 'naturgy', 'holaluz', 'repsol luz', 'totalenergies',
    'octopus energy', 'factor energia', 'som energia', 'canal de isabel', 'aguas de', 'aigues de', 'consorcio de aguas',
    'emasesa', 'emaya', 'movistar', 'vodafone', 'orange', 'digi', 'masmovil', 'jazztel', 'pepephone', 'lowi',
    'simyo', 'yoigo', 'euskaltel', 'finetwork', 'fibra', 'mapfre', 'mutua madrilena', 'axa', 'allianz', 'sanitas',
    'adeslas', 'linea directa', 'generali', 'zurich', 'ocaso', 'santalucia', 'seguro', 'ibi', 'impuesto bienes inmuebles',
    'guarderia', 'colegio',
  ],
  supermercado: [
    'mercadona', 'carrefour', 'lidl', 'dia', 'supermercados dia', 'aldi', 'eroski', 'alcampo', 'consum', 'bm supermercados',
    'caprabo', 'bonpreu', 'bon preu', 'hipercor', 'supercor', 'ahorramas', 'gadis', 'froiz', 'condis', 'masymas', 'spar',
    'simply', 'coviran', 'hiperber', 'lupa', 'mercado', 'pescaderia', 'panaderia', 'fruteria', 'carniceria', 'charcuteria',
    'forn', 'fleca', 'horno',
  ],
  ocio: [
    'bar', 'restaurante', 'restaurant', 'rest', 'cafeteria', 'cafe', 'taberna', 'cerveceria', 'pizzeria', 'asador',
    'sidreria', 'glovo', 'uber eats', 'ubereats', 'just eat', 'deliveroo', 'telepizza', 'dominos', 'burger king',
    'mcdonalds', 'kfc', 'starbucks', 'montaditos', 'vips', 'goiko', 'foster', 'tgb', 'cine', 'cinesa', 'yelmo', 'kinepolis',
    'ocine', 'ticketmaster', 'entradas', 'teatro', 'museo', 'bowling', 'pub', 'discoteca', 'txoko', 'kiosko', 'vending',
    'snack', 'heladeria', 'churreria', 'pasteleria', 'tapas', 'pintxos',
  ],
  suscripciones: [
    'netflix', 'spotify', 'claude', 'anthropic', 'github', 'amazon prime', 'prime video', 'amzn prime', 'disney plus',
    'disneyplus', 'hbo', 'max com', 'apple com bill', 'icloud', 'google one', 'youtube premium', 'google youtube',
    'dazn', 'filmin', 'movistar plus', 'chatgpt', 'openai', 'notion', 'adobe', 'microsoft 365', 'audible',
    'kindle unlimited', 'playstation', 'xbox', 'nintendo', 'patreon', 'gimnasio', 'basic fit', 'basicfit', 'mcfit',
    'altafit', 'anytime fitness', 'viva gym', 'dreamfit', 'duolingo', 'figma', 'dropbox', '1password',
  ],
  transporte: [
    'gasolinera', 'repsol', 'cepsa', 'moeve', 'galp', 'shell', 'petronor', 'ballenoil', 'plenoil', 'petroprix', 'bp',
    'estacion de servicio', 'e s ', 'renfe', 'ouigo', 'iryo', 'alsa', 'metro', 'emt', 'tmb', 'bilbobus', 'bizkaibus',
    'euskotren', 'fgc', 'tram', 'peaje', 'autopista', 'via t', 'audasa', 'abertis', 'cabify', 'uber', 'bolt', 'freenow',
    'free now', 'bicing', 'bizi', 'parking', 'aparcamiento', 'ora', 'itv', 'taller', 'vueling', 'iberia', 'ryanair',
  ],
  compras: [
    'amazon', 'amzn', 'aliexpress', 'zara', 'primark', 'mango', 'pull bear', 'bershka', 'el corte ingles', 'decathlon',
    'ikea', 'leroy merlin', 'mediamarkt', 'media markt', 'pccomponentes', 'fnac', 'shein', 'temu', 'zalando',
    'sephora', 'druni', 'primor', 'action', 'tiger', 'apple store', 'wallapop', 'vinted',
  ],
  salud: ['farmacia', 'parafarmacia', 'clinica', 'dentista', 'dental', 'optica', 'hospital', 'fisioterapia', 'veterinario', 'psicolog'],
  efectivo: ['cajero', 'retirada efectivo', 'reintegro', 'disposicion efectivo', 'bizum'],
  ingresos: ['nomina', 'salario', 'haberes', 'pension', 'devolucion hacienda', 'aeat devolucion', 'prestacion', 'factura cobrada'],
  rendimientos: [
    'dividendo', 'intereses', 'liquidacion intereses', 'abono intereses', 'rendimiento', 'remuneracion', 'cupon',
    'interest', 'savings', 'vault',
  ],
};

export const DEFAULT_SETTINGS = {
  ownerName: 'Lucía Martín',
  antThreshold: 8,
  savingsTargetPct: 20,
  transferWindowDays: 2,
  keywordSingleLegTransfers: true,
};

// Palabras que indican un traspaso entre cuentas propias
export const TRANSFER_KEYWORDS = [
  'traspaso', 'transferencia', 'transf', 'trf', 'top up', 'topup', 'recarga', 'cuenta propia', 'entre cuentas',
  'transfer to', 'transfer from', 'money added', 'to eur', 'from eur', 'a revolut', 'desde revolut', 'santander',
  'kutxabank', 'openbank', 'revolut', 'apple pay deposit',
];
