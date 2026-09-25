# Balance · finanzas personales local-first

Panel para consolidar, auditar y visualizar las cuentas de **Santander, Kutxabank, Openbank y Revolut** en un único sitio. Todo el parseo, la categorización y los cálculos ocurren en tu navegador; los datos se guardan en IndexedDB y nunca salen de tu equipo.

## Puesta en marcha

Requisitos: Node.js 18 o superior.

```bash
npm install
npm run dev        # http://localhost:5173
```

Otros comandos:

```bash
npm test           # tests del núcleo (parsers, traspasos, KPIs) con node:test
npm run build      # build de producción en dist/
npm run preview    # sirve el build
```

La primera vez se cargan seis meses de datos de ejemplo para que puedas recorrer la app. Al importar tus extractos puedes quitarlos con un interruptor (activado por defecto).

## Qué hace

**Ingesta.** Arrastra uno o varios CSV/XLSX/XLS/ODS o pega texto copiado de la web del banco. El banco se detecta por, en este orden: cabeceras propias de Revolut, código de entidad del IBAN (0049 Santander, 2095 Kutxabank, 0073 Openbank), nombre del banco en el archivo o preámbulo, y firma de columnas. Siempre puedes corregir el banco antes de importar. Las columnas se normalizan con un diccionario de sinónimos (Fecha operación, F. valor, Concepto, Importe, Cargo/Abono, Started Date…), se admiten importes en formato español o anglosajón, fechas `dd/mm/aaaa`, ISO o serial de Excel, y CSV en UTF-8 o Windows-1252. En Revolut se descartan operaciones pendientes/revertidas y otras divisas, y se resta la comisión. Reimportar el mismo extracto no duplica movimientos.

**Traspasos internos.** Ver `src/lib/transfers.js`. Una salida en un banco y una entrada del mismo importe al céntimo en otro banco, con como máximo ±2 días de diferencia (configurable), forman un par candidato. Cada par se puntúa por cercanía y señales del concepto (palabras como traspaso/transferencia/top-up, tu nombre como titular, mención del otro banco, tipo TOPUP de Revolut) y se asignan de forma voraz de mayor a menor puntuación, así que un mismo movimiento nunca se usa dos veces. Ambas patas quedan con `is_internal_transfer: true` y dejan de contar como gasto o ingreso. Opcionalmente se neutralizan también traspasos sin pareja con conceptos inequívocos (útil si todavía no has importado la otra cuenta). Nóminas, Bizum, recibos, intereses o hipoteca nunca se marcan. Desde la vista *Traspasos* o desde la tabla puedes marcar o desmarcar a mano; esas decisiones se respetan en detecciones posteriores.

**Categorías.** Reglas por palabra clave (Gastos fijos, Supermercado, Ocio y restauración, Suscripciones, Transporte, Compras, Salud, Efectivo, Nómina e ingresos, Rendimientos y ahorro). Gana la coincidencia más específica y las reglas de ingreso solo aplican a abonos. Cambiar la categoría en la tabla puede crear una regla propia (interruptor *Recordar*), que se aplica a los movimientos existentes y a futuras importaciones, con opción de deshacer. Las reglas se gestionan en *Reglas y ajustes*.

**Métricas.** Ingresos netos reales, gastos consolidados, tasa de ahorro (% y €) y *libre para gastar* = ingresos − fijos − objetivo de ahorro (20 % por defecto) − gasto variable, con variación frente al mes anterior. Las devoluciones restan gasto en lugar de sumar ingreso.

**Auditoría.** Gastos hormiga (≤ 8 € configurable, en categorías discrecionales) con acumulado mensual y proyección anual; suscripciones detectadas por repetición de importe y frecuencia (semanal, mensual, trimestral, anual) con coste anualizado, subidas de precio y próximo cobro; y comparativa por banco de gasto fijo frente a prescindible para señalar la mayor fuga.

**Gráficos.** Donut por categoría con opción de ocultar fijos (clic para ir a la tabla filtrada), barras de ingresos frente a gastos por mes con ahorro neto (clic para cambiar de mes) y flujo acumulado día a día comparado con el mes anterior.

**Tabla.** Búsqueda en vivo, filtros por banco, categoría, rango de fechas y tipo (ingreso, gasto, traspaso), ordenación por fecha o importe, paginación, y exportación a CSV (`;`, UTF-8 con BOM, abre bien en Excel) o JSON del conjunto filtrado, incluido el campo `is_internal_transfer`.

## Estructura

```
src/
├── App.jsx                     composición de vistas, periodo y navegación por hash
├── main.jsx / index.css
├── hooks/useFinance.jsx        estado global, acciones y autoguardado en IndexedDB
├── lib/
│   ├── constants.js            bancos, categorías, reglas incluidas, ajustes por defecto
│   ├── format.js               formato es-ES, fechas, normalización de conceptos
│   ├── categorize.js           motor de reglas
│   ├── transfers.js            detección y gestión de traspasos internos
│   ├── analytics.js            KPIs, series, gastos hormiga, suscripciones, por banco
│   ├── pipeline.js             normalización, deduplicado y fusión de importaciones
│   ├── storage.js              IndexedDB con respaldo en localStorage
│   ├── exporters.js            CSV y JSON
│   ├── mockData.js             seis meses de datos de ejemplo deterministas
│   └── parsers/                lectura de archivos, detección de banco y columnas
└── components/
    ├── layout/                 barra lateral, navegación móvil, cabeceras
    ├── dashboard/              libre para gastar, KPIs, gráficos, fugas
    ├── audit/                  gastos hormiga, suscripciones, gasto por banco
    ├── transactions/           tabla de movimientos
    ├── transfers/              movimientos entre cuentas
    ├── import/                 ingesta y historial de importaciones
    ├── settings/               reglas y ajustes
    └── ui/                     primitivas y avisos
tests/core.test.js
```

## Notas

- **Formatos de los bancos.** Los exportadores de la banca online cambian con el tiempo. Si un archivo no se reconoce, la vista previa muestra qué columna se ha asignado a cada campo; en la mayoría de casos basta con elegir el banco a mano. Para añadir un nombre de columna nuevo, amplía `COLUMN_SYNONYMS` en `src/lib/parsers/banks.js`.
- **Excel.** Se usa `xlsx` 0.18.5 de npm, que se carga solo cuando importas un Excel. SheetJS publica versiones más recientes en su propio CDN (`https://cdn.sheetjs.com`); si quieres usarlas, sustituye la dependencia por la URL del tarball que indican en su documentación.
- **Privacidad.** No hay backend, analítica ni peticiones externas; las tipografías (IBM Plex) van empaquetadas. Borrar los datos del sitio en el navegador o usar *Borrar todos los datos* elimina todo.
- **Copia de seguridad.** Exporta a JSON desde la tabla de movimientos.
