import { useCallback, useRef, useState } from 'react';
import { UploadCloud, FileSpreadsheet, ClipboardPaste, Trash2, Check, X, Database, FlaskConical, AlertTriangle, History } from 'lucide-react';
import { useFinance } from '../../hooks/useFinance.jsx';
import { useToast } from '../ui/Toast.jsx';
import { readFile, rowsToTransactions, textToRows } from '../../lib/parsers/index.js';
import { BANKS, BANK_IDS } from '../../lib/constants.js';
import { fmtDate, uid } from '../../lib/format.js';
import { Panel, PanelHeader, Button, Chip, Segmented, Badge, BankTag, Select, Switch, EmptyState, Money, cx } from '../ui/primitives.jsx';

const FIELD_LABELS = {
  date: 'Fecha', valueDate: 'Fecha valor', description: 'Concepto', amount: 'Importe', debit: 'Cargo', credit: 'Abono',
  balance: 'Saldo', currency: 'Divisa', fee: 'Comisión', state: 'Estado', type: 'Tipo', product: 'Producto',
};
const CONF = {
  high: { tone: 'gain', label: 'Detectado' },
  medium: { tone: 'warn', label: 'Probable' },
  low: { tone: 'warn', label: 'Dudoso, revísalo' },
  manual: { tone: 'accent', label: 'Elegido a mano' },
  none: { tone: 'loss', label: 'Sin identificar' },
};

function parseRows(rows, fileName, bankOverride) {
  const result = rowsToTransactions(rows, { fileName, bankOverride });
  const dates = result.transactions.map((t) => t.date).sort();
  return { ...result, range: dates.length ? [dates[0], dates[dates.length - 1]] : null };
}

function PendingCard({ item, onChangeBank, onImport, onDiscard }) {
  const { result } = item;
  const bankId = result.bank.bankId;
  const conf = CONF[result.bank.confidence] ?? CONF.none;
  const ok = result.transactions.length > 0 && bankId;
  const skippedTotal = result.skipped.invalid + result.skipped.pending + result.skipped.foreignCurrency;

  return (
    <Panel tone="raised" className="animate-fade-in">
      <div className="flex flex-wrap items-start justify-between gap-3 px-5 pt-4">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-zinc-700/70 bg-zinc-900">
            {item.kind === 'text' && item.fileName === 'texto pegado' ? <ClipboardPaste className="h-4 w-4 text-zinc-400" /> : <FileSpreadsheet className="h-4 w-4 text-zinc-400" />}
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm text-zinc-100">{item.fileName}</p>
            <p className="text-[12.5px] text-zinc-500">
              {result.transactions.length} movimientos
              {result.range && <> del {fmtDate(result.range[0])} al {fmtDate(result.range[1])}</>}
              {skippedTotal > 0 && <>, {skippedTotal} {skippedTotal === 1 ? 'fila omitida' : 'filas omitidas'}</>}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Badge tone={conf.tone} title={result.bank.reason}>{conf.label}</Badge>
          <Select value={bankId ?? ''} onChange={(v) => onChangeBank(v || null)} aria-label="Banco del extracto" className="h-8 w-[140px] text-[13px]">
            <option value="">Elige banco</option>
            {BANK_IDS.map((id) => <option key={id} value={id}>{BANKS[id].name}</option>)}
          </Select>
        </div>
      </div>

      {result.bank.reason && result.bank.confidence !== 'manual' && bankId && (
        <p className="px-5 pt-2 text-[12.5px] text-zinc-500">Identificado por {result.bank.reason}.</p>
      )}

      {result.mapping ? (
        <div className="flex flex-wrap gap-1.5 px-5 pt-3">
          {Object.entries(result.headerLabels).map(([field, label]) => (
            <span key={field} className="rounded-md border border-zinc-800 bg-ink-950/60 px-2 py-0.5 text-[11.5px] text-zinc-400">
              <span className="text-zinc-200">{FIELD_LABELS[field] ?? field}</span> ← {label}
            </span>
          ))}
        </div>
      ) : (
        <p className="mx-5 mt-3 flex items-center gap-2 rounded-lg bg-loss/10 px-3 py-2 text-[13px] text-loss">
          <AlertTriangle className="h-4 w-4 shrink-0" aria-hidden />
          No se han encontrado columnas de fecha, concepto e importe. Comprueba que el archivo es un extracto de movimientos.
        </p>
      )}

      {(result.skipped.pending > 0 || result.skipped.foreignCurrency > 0) && (
        <p className="px-5 pt-2 text-[12.5px] text-zinc-500">
          {result.skipped.pending > 0 && <>{result.skipped.pending === 1 ? '1 movimiento pendiente o rechazado no se importa. ' : `${result.skipped.pending} pendientes o rechazados no se importan. `}</>}
          {result.skipped.foreignCurrency > 0 && <>{result.skipped.foreignCurrency === 1 ? '1 movimiento en otra divisa no se importa.' : `${result.skipped.foreignCurrency} en otra divisa no se importan.`}</>}
        </p>
      )}

      {result.transactions.length > 0 && (
        <div className="mx-5 mt-3 overflow-x-auto rounded-lg border border-zinc-800">
          <table className="w-full min-w-[480px] text-[12.5px]">
            <tbody>
              {result.transactions.slice(0, 5).map((t, i) => (
                <tr key={i} className="border-b border-zinc-800/70 last:border-0">
                  <td className="num whitespace-nowrap px-3 py-1.5 font-mono text-zinc-500">{fmtDate(t.date)}</td>
                  <td className="max-w-[320px] truncate px-3 py-1.5 text-zinc-300">{t.description}</td>
                  <td className="whitespace-nowrap px-3 py-1.5 text-right"><Money value={t.amount} signed /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="flex flex-wrap items-center justify-end gap-2 px-5 py-4">
        <Button variant="ghost" icon={X} onClick={onDiscard}>Descartar</Button>
        <Button variant="primary" icon={Check} disabled={!ok} onClick={onImport}>
          {bankId ? `Importar ${result.transactions.length} en ${BANKS[bankId].name}` : 'Elige el banco para importar'}
        </Button>
      </div>
    </Panel>
  );
}

export function ImportView() {
  const { importParsed, isDemo, batches, removeBatch, loadDemo, clearAll } = useFinance();
  const toast = useToast();
  const [mode, setMode] = useState('files');
  const [bankHint, setBankHint] = useState(null);
  const [pending, setPending] = useState([]);
  const [dragging, setDragging] = useState(false);
  const [pasted, setPasted] = useState('');
  const [removeDemo, setRemoveDemo] = useState(true);
  const [confirmClear, setConfirmClear] = useState(false);
  const inputRef = useRef(null);

  const addFiles = useCallback(async (files) => {
    for (const file of files) {
      try {
        const { rows, fileName, kind } = await readFile(file);
        const result = parseRows(rows, fileName, bankHint);
        setPending((p) => [...p, { id: uid('pending'), fileName, kind, rows, result }]);
      } catch (e) {
        console.error(e);
        toast({ tone: 'error', title: `No se pudo leer ${file.name}`, description: 'Usa un CSV, XLSX o XLS exportado desde tu banco.' });
      }
    }
  }, [bankHint, toast]);

  const onDrop = (e) => {
    e.preventDefault();
    setDragging(false);
    const files = [...(e.dataTransfer?.files ?? [])];
    if (files.length) addFiles(files);
  };

  const parsePaste = () => {
    const rows = textToRows(pasted);
    const result = parseRows(rows, 'texto pegado', bankHint);
    if (!result.transactions.length) {
      toast({ tone: 'error', title: 'No se han reconocido movimientos', description: 'Cada línea necesita al menos una fecha, un concepto y un importe.' });
      return;
    }
    setPending((p) => [...p, { id: uid('pending'), fileName: 'texto pegado', kind: 'text', rows, result }]);
    setPasted('');
  };

  const changeBank = (id, bank) =>
    setPending((p) => p.map((it) => (it.id === id ? { ...it, result: parseRows(it.rows, it.fileName, bank) } : it)));

  const doImport = (item) => {
    const res = importParsed({
      bank: item.result.bank.bankId,
      fileName: item.fileName,
      transactions: item.result.transactions,
      removeDemo: isDemo && removeDemo,
    });
    setPending((p) => p.filter((x) => x.id !== item.id));
    toast({
      title: `${res.added} movimientos importados en ${BANKS[item.result.bank.bankId].name}`,
      description: [
        res.duplicates > 0 && `${res.duplicates} ya existían y se han omitido.`,
        res.transfersDetected > 0 && (res.transfersDetected === 1 ? "1 traspaso interno neutralizado." : `${res.transfersDetected} traspasos internos neutralizados.`),
      ].filter(Boolean).join(' ') || undefined,
    });
  };

  const realBatches = [...batches].reverse();

  return (
    <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_340px]">
      <div className="flex flex-col gap-5">
        <Panel>
          <PanelHeader
            title="Añadir extractos"
            description="Excel o CSV de Santander, Kutxabank, Openbank o Revolut, o texto copiado de la web del banco. Se procesa en tu navegador."
            actions={
              <Segmented
                label="Origen"
                value={mode}
                onChange={setMode}
                options={[{ value: 'files', label: 'Archivos' }, { value: 'paste', label: 'Pegar texto' }]}
              />
            }
          />
          <div className="flex flex-wrap items-center gap-2 px-5 pt-4">
            <span className="mr-1 text-[13px] text-zinc-500">Banco</span>
            <Chip active={bankHint === null} onClick={() => setBankHint(null)}>Detectar automáticamente</Chip>
            {BANK_IDS.map((id) => (
              <Chip key={id} active={bankHint === id} onClick={() => setBankHint(id)} color={BANKS[id].color}>{BANKS[id].name}</Chip>
            ))}
          </div>

          <div className="p-5">
            {mode === 'files' ? (
              <div
                onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
                onDragLeave={() => setDragging(false)}
                onDrop={onDrop}
                onClick={() => inputRef.current?.click()}
                onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && inputRef.current?.click()}
                role="button"
                tabIndex={0}
                aria-label="Subir extractos"
                className={cx(
                  'flex cursor-pointer flex-col items-center justify-center rounded-xl border border-dashed px-6 py-12 text-center transition-colors',
                  dragging ? 'border-accent/70 bg-accent/[0.06]' : 'border-zinc-700/80 bg-ink-950/40 hover:border-zinc-600 hover:bg-ink-950/70',
                )}
              >
                <UploadCloud className={cx('h-7 w-7 transition-transform', dragging ? 'scale-110 text-accent' : 'text-zinc-500')} strokeWidth={1.5} aria-hidden />
                <p className="mt-3 text-sm text-zinc-200">Arrastra aquí tus extractos o haz clic para elegirlos</p>
                <p className="mt-1 text-[12.5px] text-zinc-500">CSV, XLSX, XLS u ODS. Puedes soltar varios a la vez.</p>
                <input
                  ref={inputRef}
                  type="file"
                  multiple
                  accept=".csv,.txt,.tsv,.xlsx,.xls,.xlsm,.ods"
                  className="hidden"
                  onChange={(e) => { addFiles([...e.target.files]); e.target.value = ''; }}
                />
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                <textarea
                  value={pasted}
                  onChange={(e) => setPasted(e.target.value)}
                  rows={9}
                  spellCheck={false}
                  placeholder={'Pega filas copiadas de la banca online, por ejemplo:\n12/03/2025  COMPRA TARJ. MERCADONA BILBAO   -45,20   1.234,56\n13/03/2025  BIZUM RECIBIDO DE JON            15,00   1.249,56'}
                  className="w-full resize-y rounded-xl border border-zinc-800 bg-ink-950/60 p-4 font-mono text-[12.5px] leading-relaxed text-zinc-200 outline-none placeholder:text-zinc-600 focus:border-accent/60"
                />
                <div className="flex justify-end">
                  <Button variant="primary" icon={ClipboardPaste} disabled={!pasted.trim()} onClick={parsePaste}>Analizar texto</Button>
                </div>
              </div>
            )}
            {isDemo && (
              <div className="mt-4 rounded-lg border border-zinc-800 bg-ink-950/40 px-4 py-3">
                <Switch checked={removeDemo} onChange={setRemoveDemo} label="Quitar los datos de ejemplo al importar" description="Así tus métricas solo reflejan tus cuentas reales." />
              </div>
            )}
          </div>
        </Panel>

        {pending.length > 1 && (
          <div className="flex justify-end">
            <Button
              variant="primary"
              icon={Check}
              onClick={() => pending.filter((p) => p.result.bank.bankId && p.result.transactions.length).forEach(doImport)}
            >
              Importar todos
            </Button>
          </div>
        )}
        {pending.map((item) => (
          <PendingCard
            key={item.id}
            item={item}
            onChangeBank={(b) => changeBank(item.id, b)}
            onImport={() => doImport(item)}
            onDiscard={() => setPending((p) => p.filter((x) => x.id !== item.id))}
          />
        ))}
      </div>

      <div className="flex flex-col gap-5">
        <Panel>
          <PanelHeader title="Importaciones" description="Eliminar una importación borra sus movimientos." />
          {realBatches.length === 0 ? (
            <EmptyState icon={History} title="Aún no has importado nada" />
          ) : (
            <ul className="mt-3 divide-y divide-zinc-800/70">
              {realBatches.map((b) => (
                <li key={b.id} className="flex items-center gap-3 px-5 py-2.5">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <BankTag bank={b.bank} />
                      {b.isDemo && <Badge>Ejemplo</Badge>}
                    </div>
                    <p className="mt-0.5 truncate text-[12px] text-zinc-500" title={b.fileName}>
                      {b.count} movimientos, {new Date(b.importedAt).toLocaleDateString('es-ES')}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => removeBatch(b.id)}
                    aria-label={`Eliminar importación de ${BANKS[b.bank]?.name}`}
                    className="rounded-md p-1.5 text-zinc-600 hover:bg-zinc-800 hover:text-loss"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <Panel>
          <PanelHeader title="Tus datos" description="Se guardan automáticamente en IndexedDB, dentro de este navegador." />
          <div className="flex flex-col gap-2 p-5">
            <Button icon={FlaskConical} onClick={() => { loadDemo(); toast({ title: 'Datos de ejemplo cargados' }); }}>
              Cargar datos de ejemplo
            </Button>
            {confirmClear ? (
              <div className="flex gap-2">
                <Button
                  variant="danger"
                  className="flex-1"
                  icon={Trash2}
                  onClick={async () => { await clearAll(); setConfirmClear(false); toast({ tone: 'info', title: 'Todos los datos se han borrado' }); }}
                >
                  Borrar definitivamente
                </Button>
                <Button variant="ghost" onClick={() => setConfirmClear(false)}>Cancelar</Button>
              </div>
            ) : (
              <Button variant="ghost" icon={Database} onClick={() => setConfirmClear(true)}>Borrar todos los datos</Button>
            )}
          </div>
        </Panel>

        <Panel>
          <PanelHeader title="Qué descargar de cada banco" />
          <dl className="flex flex-col gap-3 p-5 text-[13px]">
            {[
              ['santander', 'Movimientos de la cuenta en Excel desde la banca online.'],
              ['kutxabank', 'Consulta de movimientos exportada a Excel o CSV.'],
              ['openbank', 'Movimientos de la cuenta en Excel desde la web.'],
              ['revolut', 'Extracto en formato Excel/CSV desde la app. Se ignoran pendientes y otras divisas.'],
            ].map(([id, text]) => (
              <div key={id}>
                <dt><BankTag bank={id} className="text-zinc-200" /></dt>
                <dd className="mt-0.5 pl-3.5 text-zinc-500">{text}</dd>
              </div>
            ))}
          </dl>
        </Panel>
      </div>
    </div>
  );
}
