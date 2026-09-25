import { useEffect, useMemo, useState } from 'react';
import { Search, ArrowUpDown, ArrowUp, ArrowDown, ArrowLeftRight, Download, FilterX, ChevronLeft, ChevronRight, Rows3, Link2 } from 'lucide-react';
import { useFinance } from '../../hooks/useFinance.jsx';
import { useToast } from '../ui/Toast.jsx';
import { BANKS, BANK_IDS, CATEGORIES, CATEGORY_IDS } from '../../lib/constants.js';
import { txType } from '../../lib/analytics.js';
import { fmtDate, fmtEUR, normalizeText } from '../../lib/format.js';
import { exportCSV, exportJSON } from '../../lib/exporters.js';
import { totals } from '../../lib/analytics.js';
import { Panel, Chip, Segmented, Select, Input, Button, IconButton, Money, BankTag, Badge, EmptyState, Switch, cx } from '../ui/primitives.jsx';

export const EMPTY_FILTERS = { banks: [], category: 'all', type: 'all', from: '', to: '', q: '' };

const TYPE_OPTIONS = [
  { value: 'all', label: 'Todos' },
  { value: 'income', label: 'Ingresos' },
  { value: 'expense', label: 'Gastos' },
  { value: 'transfer', label: 'Traspasos' },
];

function applyFilters(txs, f) {
  const q = normalizeText(f.q);
  return txs.filter((t) => {
    if (f.banks.length && !f.banks.includes(t.bank)) return false;
    if (f.category !== 'all' && (t.is_internal_transfer || t.category !== f.category)) return false;
    if (f.type !== 'all' && txType(t) !== f.type) return false;
    if (f.from && t.date < f.from) return false;
    if (f.to && t.date > f.to) return false;
    if (q && !normalizeText(t.description).includes(q)) return false;
    return true;
  });
}

function CategoryPicker({ tx, onChange }) {
  if (tx.is_internal_transfer) {
    return (
      <Badge tone="accent" title="No computa como gasto ni como ingreso">
        <Link2 className="h-3 w-3" aria-hidden /> Traspaso interno
      </Badge>
    );
  }
  const cat = CATEGORIES[tx.category];
  return (
    <label className="relative inline-flex max-w-full items-center">
      <span className="pointer-events-none absolute left-2 h-2 w-2 rounded-sm" style={{ background: cat?.color }} aria-hidden />
      <span className="sr-only">Categoría</span>
      <select
        value={tx.category}
        onChange={(e) => onChange(e.target.value)}
        className="h-7 max-w-full cursor-pointer appearance-none truncate rounded-md border border-transparent bg-transparent pl-6 pr-2 text-[13px] text-zinc-300 outline-none transition-colors hover:border-zinc-700 hover:bg-zinc-900 focus:border-accent/60"
      >
        {CATEGORY_IDS.map((id) => (
          <option key={id} value={id}>{CATEGORIES[id].name}</option>
        ))}
      </select>
      {tx.categorySource === 'manual' && <span className="ml-1 h-1 w-1 rounded-full bg-accent" title="Asignada a mano" />}
    </label>
  );
}

function SortHeader({ label, sortKey, sort, onSort, align = 'left' }) {
  const active = sort.key === sortKey;
  const Icon = !active ? ArrowUpDown : sort.dir === 'asc' ? ArrowUp : ArrowDown;
  return (
    <button
      type="button"
      onClick={() => onSort(sortKey)}
      className={cx('inline-flex items-center gap-1 hover:text-zinc-200', active && 'text-zinc-200', align === 'right' && 'flex-row-reverse')}
      aria-sort={active ? (sort.dir === 'asc' ? 'ascending' : 'descending') : 'none'}
    >
      {label}
      <Icon className="h-3 w-3" aria-hidden />
    </button>
  );
}

export function TransactionsTable({ filters, setFilters }) {
  const { transactions, setCategory, restoreSnapshot, toggleTransfer } = useFinance();
  const toast = useToast();
  const [sort, setSort] = useState({ key: 'date', dir: 'desc' });
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(25);
  const [remember, setRemember] = useState(true);

  const filtered = useMemo(() => applyFilters(transactions, filters), [transactions, filters]);
  const sorted = useMemo(() => {
    const dir = sort.dir === 'asc' ? 1 : -1;
    return [...filtered].sort((a, b) =>
      sort.key === 'amount' ? (a.amount - b.amount) * dir || b.date.localeCompare(a.date) : a.date.localeCompare(b.date) * dir || a.amount - b.amount,
    );
  }, [filtered, sort]);
  const summary = useMemo(() => totals(filtered), [filtered]);

  const pages = Math.max(1, Math.ceil(sorted.length / pageSize));
  useEffect(() => setPage(0), [filters, pageSize, sort]);
  const safePage = Math.min(page, pages - 1);
  const rows = sorted.slice(safePage * pageSize, safePage * pageSize + pageSize);

  const set = (patch) => setFilters((f) => ({ ...f, ...patch }));
  const toggleBank = (id) => set({ banks: filters.banks.includes(id) ? filters.banks.filter((b) => b !== id) : [...filters.banks, id] });
  const onSort = (key) => setSort((s) => ({ key, dir: s.key === key && s.dir === 'desc' ? 'asc' : 'desc' }));
  const hasFilters = JSON.stringify(filters) !== JSON.stringify(EMPTY_FILTERS);

  const changeCategory = (tx, category) => {
    const res = setCategory(tx.id, category, { remember });
    if (!res) return;
    toast({
      title: res.rule ? `Regla guardada: «${res.rule.keyword}» → ${CATEGORIES[category].name}` : `Categoría cambiada a ${CATEGORIES[category].name}`,
      description: res.rule ? `${res.affected} movimiento${res.affected === 1 ? '' : 's'} actualizado${res.affected === 1 ? '' : 's'}. Se aplicará en futuras importaciones.` : undefined,
      action: { label: 'Deshacer', onClick: () => restoreSnapshot(res.snapshot) },
    });
  };

  const onToggleTransfer = (tx) => {
    toggleTransfer(tx.id);
    toast({
      tone: 'info',
      title: tx.is_internal_transfer ? 'Desmarcado como traspaso' : 'Marcado como traspaso interno',
      description: tx.is_internal_transfer ? 'Vuelve a contar como ingreso o gasto.' : 'Ya no cuenta como ingreso ni como gasto.',
    });
  };

  const exportSummary = { movimientos: filtered.length, ingresos: summary.income, gastos: summary.expenses, ahorro_neto: summary.net, traspasos_neutralizados: summary.transfersVolume, filtros: filters };

  return (
    <div className="flex flex-col gap-4">
      {/* Filtros */}
      <Panel className="flex flex-col gap-3 p-3 sm:p-4">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative min-w-[200px] flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" aria-hidden />
            <Input
              value={filters.q}
              onChange={(e) => set({ q: e.target.value })}
              placeholder="Buscar en el concepto"
              aria-label="Buscar en el concepto"
              className="w-full pl-9"
            />
          </div>
          <Segmented label="Tipo" options={TYPE_OPTIONS} value={filters.type} onChange={(type) => set({ type })} />
          <Select value={filters.category} onChange={(category) => set({ category })} aria-label="Categoría" className="w-[190px]">
            <option value="all">Todas las categorías</option>
            {CATEGORY_IDS.map((id) => <option key={id} value={id}>{CATEGORIES[id].name}</option>)}
          </Select>
          <div className="flex items-center gap-1.5">
            <Input type="date" value={filters.from} onChange={(e) => set({ from: e.target.value })} aria-label="Desde" className="w-[142px] [color-scheme:dark]" />
            <span className="text-zinc-600">a</span>
            <Input type="date" value={filters.to} onChange={(e) => set({ to: e.target.value })} aria-label="Hasta" className="w-[142px] [color-scheme:dark]" />
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {BANK_IDS.map((id) => (
            <Chip key={id} active={filters.banks.length === 0 || filters.banks.includes(id)} onClick={() => toggleBank(id)} color={BANKS[id].color}>
              {BANKS[id].name}
            </Chip>
          ))}
          {hasFilters && (
            <Button size="sm" variant="ghost" icon={FilterX} onClick={() => setFilters(EMPTY_FILTERS)}>
              Quitar filtros
            </Button>
          )}
          <div className="ml-auto flex items-center gap-2">
            <Button size="sm" icon={Download} onClick={() => exportCSV(sorted)} disabled={!sorted.length} title="Exporta los movimientos filtrados">
              Exportar CSV
            </Button>
            <Button size="sm" icon={Download} onClick={() => exportJSON(sorted, exportSummary)} disabled={!sorted.length} title="Exporta los movimientos filtrados">
              Exportar JSON
            </Button>
          </div>
        </div>
      </Panel>

      {/* Resumen del filtro */}
      <div className="flex flex-wrap items-center justify-between gap-3 px-1 text-[13px] text-zinc-500">
        <p>
          <span className="num font-mono text-zinc-200">{filtered.length.toLocaleString('es-ES')}</span> movimientos. Ingresos{' '}
          <span className="num font-mono text-gain">{fmtEUR(summary.income)}</span>, gastos{' '}
          <span className="num font-mono text-zinc-200">{fmtEUR(summary.expenses)}</span>
          {summary.transfersCount > 0 && <>, {summary.transfersCount} traspasos neutralizados</>}.
        </p>
        <div className="w-full sm:w-auto">
          <Switch checked={remember} onChange={setRemember} label="Recordar cambios de categoría como regla" />
        </div>
      </div>

      <Panel className="overflow-hidden">
        {rows.length === 0 ? (
          <EmptyState icon={Rows3} title="Ningún movimiento coincide con los filtros" action={hasFilters && <Button size="sm" onClick={() => setFilters(EMPTY_FILTERS)}>Quitar filtros</Button>}>
            Prueba con otro texto, amplía el rango de fechas o activa más bancos.
          </EmptyState>
        ) : (
          <>
            {/* Escritorio */}
            <div className="hidden overflow-x-auto md:block">
              <table className="w-full text-left text-[13px]">
                <thead className="sticky top-0 bg-ink-900/95 backdrop-blur">
                  <tr className="border-b border-zinc-800 text-[12px] text-zinc-500">
                    <th className="w-[108px] px-4 py-2.5 font-normal"><SortHeader label="Fecha" sortKey="date" sort={sort} onSort={onSort} /></th>
                    <th className="px-3 py-2.5 font-normal">Concepto</th>
                    <th className="w-[124px] px-3 py-2.5 font-normal">Banco</th>
                    <th className="w-[210px] px-3 py-2.5 font-normal">Categoría</th>
                    <th className="w-[130px] px-3 py-2.5 text-right font-normal"><SortHeader label="Importe" sortKey="amount" sort={sort} onSort={onSort} align="right" /></th>
                    <th className="w-[52px] px-2 py-2.5"><span className="sr-only">Traspaso</span></th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((t) => (
                    <tr key={t.id} className={cx('group border-b border-zinc-800/60 transition-colors last:border-0 hover:bg-zinc-800/25', t.is_internal_transfer && 'bg-accent/[0.025]')}>
                      <td className="num whitespace-nowrap px-4 py-2 font-mono text-[12.5px] text-zinc-400">{fmtDate(t.date)}</td>
                      <td className="max-w-0 px-3 py-2">
                        <p className={cx('truncate', t.is_internal_transfer ? 'text-zinc-400' : 'text-zinc-200')} title={t.description}>{t.description}</p>
                      </td>
                      <td className="px-3 py-2"><BankTag bank={t.bank} /></td>
                      <td className="px-3 py-2"><CategoryPicker tx={t} onChange={(c) => changeCategory(t, c)} /></td>
                      <td className="whitespace-nowrap px-3 py-2 text-right">
                        <Money value={t.amount} signed muted={t.is_internal_transfer} />
                      </td>
                      <td className="px-2 py-2 text-right">
                        <IconButton
                          icon={ArrowLeftRight}
                          label={t.is_internal_transfer ? 'Desmarcar traspaso interno' : 'Marcar como traspaso interno'}
                          active={t.is_internal_transfer}
                          onClick={() => onToggleTransfer(t)}
                          className={cx(!t.is_internal_transfer && 'opacity-0 focus:opacity-100 group-hover:opacity-100')}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Móvil */}
            <ul className="divide-y divide-zinc-800/60 md:hidden">
              {rows.map((t) => (
                <li key={t.id} className="flex items-start gap-3 px-4 py-3">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13.5px] text-zinc-200">{t.description}</p>
                    <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px] text-zinc-500">
                      <span className="num font-mono">{fmtDate(t.date)}</span>
                      <BankTag bank={t.bank} className="text-[12px] text-zinc-400" />
                    </div>
                    <div className="mt-1 -ml-2"><CategoryPicker tx={t} onChange={(c) => changeCategory(t, c)} /></div>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <Money value={t.amount} signed muted={t.is_internal_transfer} className="text-[13.5px]" />
                    <IconButton icon={ArrowLeftRight} label={t.is_internal_transfer ? 'Desmarcar traspaso interno' : 'Marcar como traspaso interno'} active={t.is_internal_transfer} onClick={() => onToggleTransfer(t)} />
                  </div>
                </li>
              ))}
            </ul>

            {/* Paginación */}
            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-zinc-800 px-4 py-2.5 text-[12.5px] text-zinc-500">
              <div className="flex items-center gap-2">
                <span>Filas</span>
                <Select value={String(pageSize)} onChange={(v) => setPageSize(Number(v))} aria-label="Filas por página" className="h-7 text-xs">
                  {[25, 50, 100].map((n) => <option key={n} value={n}>{n}</option>)}
                </Select>
              </div>
              <div className="flex items-center gap-2">
                <span className="num font-mono">
                  {safePage * pageSize + 1}–{Math.min(sorted.length, (safePage + 1) * pageSize)} de {sorted.length.toLocaleString('es-ES')}
                </span>
                <IconButton icon={ChevronLeft} label="Página anterior" onClick={() => setPage(Math.max(0, safePage - 1))} disabled={safePage === 0} className="disabled:opacity-30" />
                <IconButton icon={ChevronRight} label="Página siguiente" onClick={() => setPage(Math.min(pages - 1, safePage + 1))} disabled={safePage >= pages - 1} className="disabled:opacity-30" />
              </div>
            </div>
          </>
        )}
      </Panel>
    </div>
  );
}
