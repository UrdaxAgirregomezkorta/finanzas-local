import { useMemo } from 'react';
import { ResponsiveContainer, BarChart, Bar, XAxis, Tooltip, Cell } from 'recharts';
import { Coffee, Repeat, Landmark, AlertTriangle, CalendarClock } from 'lucide-react';
import { antExpenses, detectSubscriptions, bankBreakdown, filterByPeriod } from '../../lib/analytics.js';
import { fmtEUR, fmtEUR0, fmtPct, fmtDate, fmtMonth } from '../../lib/format.js';
import { CATEGORIES } from '../../lib/constants.js';
import { Panel, PanelHeader, Badge, BankTag, BankDot, EmptyState, ChartTooltip, cx } from '../ui/primitives.jsx';

function Stat({ label, value, tone, big }) {
  return (
    <div>
      <p className="text-[12.5px] text-zinc-500">{label}</p>
      <p className={cx('num mt-1 font-mono tracking-tight', big ? 'text-[28px] font-medium' : 'text-lg', tone ?? 'text-zinc-100')}>{value}</p>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Gastos hormiga
// ─────────────────────────────────────────────────────────────
export function AntExpenses({ allTransactions, period, threshold }) {
  const data = useMemo(() => antExpenses(allTransactions, period, threshold), [allTransactions, period, threshold]);
  const max = data.items[0]?.total ?? 1;

  return (
    <Panel>
      <PanelHeader
        title="Gastos hormiga"
        description={`Compras de ${fmtEUR(threshold)} o menos en cafeterías, snacks y caprichos. El umbral se cambia en Reglas y ajustes.`}
      />
      {data.count === 0 && data.monthlyAvg === 0 ? (
        <EmptyState icon={Coffee} title="No hay micro-gastos en este periodo" />
      ) : (
        <>
          <div className="grid grid-cols-2 gap-5 px-5 pt-5 sm:grid-cols-[1fr_1fr_1.3fr_1.4fr] sm:items-end">
            <Stat label={period === 'all' ? 'Acumulado total' : `En ${fmtMonth(period)}`} value={fmtEUR(data.total)} />
            <Stat label="Nº de compras" value={data.count.toLocaleString('es-ES')} />
            <Stat label="Media mensual" value={fmtEUR(data.monthlyAvg)} />
            <Stat label="Proyección anual" value={fmtEUR0(data.annualProjection)} tone="text-amber-300" big />
          </div>

          <div className="grid gap-6 px-5 pb-5 pt-5 lg:grid-cols-[1fr_240px]">
            <ul className="flex flex-col gap-2">
              {data.items.slice(0, 8).map((it) => (
                <li key={it.key} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-1">
                  <div className="flex min-w-0 items-center gap-2">
                    {it.banks.map((b) => <BankDot key={b} bank={b} />)}
                    <span className="truncate text-[13px] text-zinc-200">{it.name}</span>
                    <span className="num shrink-0 font-mono text-[11.5px] text-zinc-500">
                      {it.count} × {fmtEUR(it.avg)}
                    </span>
                  </div>
                  <span className="num font-mono text-[13px] text-zinc-100">{fmtEUR(it.total)}</span>
                  <div className="col-span-2 h-1 overflow-hidden rounded-full bg-zinc-800/80">
                    <div className="h-full origin-left animate-grow-x rounded-full bg-amber-300/70" style={{ width: `${(it.total / max) * 100}%` }} />
                  </div>
                </li>
              ))}
            </ul>
            <div>
              <p className="text-[12.5px] text-zinc-500">Últimos meses</p>
              <div className="mt-2 h-[140px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={data.byMonth} margin={{ top: 4, right: 0, left: 0, bottom: 0 }}>
                    <XAxis dataKey="label" stroke="#52525b" fontSize={10.5} tickLine={false} axisLine={false} />
                    <Tooltip cursor={{ fill: '#ffffff08' }} content={<ChartTooltip />} />
                    <Bar dataKey="total" name="Hormiga" radius={[3, 3, 0, 0]} maxBarSize={24}>
                      {data.byMonth.map((d) => (
                        <Cell key={d.month} fill="#fcd34d" fillOpacity={period === 'all' || d.month === period ? 0.85 : 0.3} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        </>
      )}
    </Panel>
  );
}

// ─────────────────────────────────────────────────────────────
// Suscripciones activas
// ─────────────────────────────────────────────────────────────
const FREQ_LABEL = { semanal: 'Semanal', mensual: 'Mensual', trimestral: 'Trimestral', anual: 'Anual' };

export function Subscriptions({ allTransactions }) {
  const subs = useMemo(() => detectSubscriptions(allTransactions), [allTransactions]);

  return (
    <Panel>
      <PanelHeader
        title="Suscripciones y cobros periódicos"
        description="Detectadas por repetición de importe y frecuencia en todo el histórico."
      />
      {subs.items.length === 0 ? (
        <EmptyState icon={Repeat} title="No se han detectado cobros periódicos" />
      ) : (
        <>
          <div className="mx-5 mt-4 flex flex-wrap items-center gap-x-6 gap-y-2 rounded-lg border border-amber-400/15 bg-amber-400/[0.05] px-4 py-3">
            <AlertTriangle className="h-4 w-4 shrink-0 text-amber-300" strokeWidth={1.75} aria-hidden />
            <p className="min-w-0 flex-1 text-[13px] text-zinc-300">
              Pagas <span className="num font-mono text-amber-200">{fmtEUR(subs.annualTotal)}</span> al año en {subs.activeCount} suscripciones
              activas, <span className="num font-mono text-zinc-100">{fmtEUR(subs.monthlyTotal)}</span> al mes.
            </p>
          </div>
          <div className="overflow-x-auto px-2 pb-3 pt-2">
            <table className="w-full min-w-[640px] text-left text-[13px]">
              <thead>
                <tr className="text-[12px] text-zinc-500">
                  <th className="px-3 py-2 font-normal">Servicio</th>
                  <th className="px-3 py-2 font-normal">Cuenta</th>
                  <th className="px-3 py-2 font-normal">Frecuencia</th>
                  <th className="px-3 py-2 text-right font-normal">Cuota</th>
                  <th className="px-3 py-2 font-normal">Próximo cobro</th>
                  <th className="px-3 py-2 text-right font-normal">Coste anual</th>
                </tr>
              </thead>
              <tbody>
                {subs.items.map((s) => (
                  <tr key={s.key} className={cx('border-t border-zinc-800/70', !s.active && 'opacity-50')}>
                    <td className="px-3 py-2.5">
                      <div className="flex items-center gap-2">
                        <span className="text-zinc-100">{s.name}</span>
                        {!s.active && <Badge>Sin cobros recientes</Badge>}
                        {s.priceChanged && <Badge tone="warn" title="El último cobro difiere del anterior">Precio cambiado</Badge>}
                        {s.estimated && <Badge title="Un único cobro: frecuencia estimada">Estimada</Badge>}
                        {s.category !== 'suscripciones' && <Badge tone="accent" title={`Categoría: ${CATEGORIES[s.category]?.name}`}>Detectada</Badge>}
                      </div>
                    </td>
                    <td className="px-3 py-2.5"><BankTag bank={s.bank} /></td>
                    <td className="px-3 py-2.5 text-zinc-400">{FREQ_LABEL[s.frequency]} <span className="text-zinc-600">({s.charges} cobros)</span></td>
                    <td className="num px-3 py-2.5 text-right font-mono text-zinc-200">{fmtEUR(s.amount)}</td>
                    <td className="px-3 py-2.5 text-zinc-400">
                      <span className="inline-flex items-center gap-1.5">
                        <CalendarClock className="h-3.5 w-3.5 text-zinc-600" aria-hidden />
                        {s.active ? fmtDate(s.nextCharge) : '—'}
                      </span>
                    </td>
                    <td className="num px-3 py-2.5 text-right font-mono text-zinc-50">{fmtEUR(s.annualCost)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </Panel>
  );
}

// ─────────────────────────────────────────────────────────────
// Gasto por banco
// ─────────────────────────────────────────────────────────────
export function BankComparison({ allTransactions, period, threshold }) {
  const txs = useMemo(() => filterByPeriod(allTransactions, period), [allTransactions, period]);
  const { rows, leakId } = useMemo(() => bankBreakdown(txs, threshold), [txs, threshold]);
  const maxTotal = Math.max(1, ...rows.map((r) => r.expenses));
  const leak = rows.find((r) => r.id === leakId);

  return (
    <Panel>
      <PanelHeader
        title="Gasto por banco"
        description="Gasto fijo frente a prescindible en cada cuenta. Los traspasos no computan."
      />
      {!leak ? (
        <EmptyState icon={Landmark} title="Sin gasto en este periodo" />
      ) : (
        <>
          <p className="mx-5 mt-4 text-[13px] leading-relaxed text-zinc-400">
            <span className="text-zinc-100">{leak.name}</span> concentra el{' '}
            <span className="num font-mono text-zinc-100">{fmtPct(leak.share)}</span> del gasto prescindible (
            <span className="num font-mono">{fmtEUR(leak.discretionary)}</span>)
            {leak.topCategory && <>, sobre todo en {leak.topCategory.name.toLowerCase()}</>}.
          </p>
          <div className="flex flex-col gap-5 px-5 pb-5 pt-5">
            {rows.map((r) => (
              <div key={r.id}>
                <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                  <div className="flex items-center gap-2">
                    <BankTag bank={r.id} className="text-sm text-zinc-100" />
                    <span className="text-[12px] text-zinc-600">{r.role}</span>
                    {r.id === leakId && <Badge tone="loss">Mayor fuga</Badge>}
                  </div>
                  <span className="num font-mono text-[13px] text-zinc-100">{fmtEUR(r.expenses)}</span>
                </div>
                <div className="mt-2 flex h-2 w-full overflow-hidden rounded-full bg-zinc-800/60">
                  <div className="h-full bg-zinc-500/60" style={{ width: `${(Math.max(0, r.fixed) / maxTotal) * 100}%` }} title={`Fijo: ${fmtEUR(r.fixed)}`} />
                  <div className="h-full" style={{ width: `${(Math.max(0, r.discretionary) / maxTotal) * 100}%`, background: r.color }} title={`Prescindible: ${fmtEUR(r.discretionary)}`} />
                </div>
                <dl className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 text-[12px] sm:grid-cols-4">
                  <div className="flex justify-between gap-2 sm:block"><dt className="text-zinc-500">Fijo</dt><dd className="num font-mono text-zinc-300">{fmtEUR(r.fixed)}</dd></div>
                  <div className="flex justify-between gap-2 sm:block"><dt className="text-zinc-500">Prescindible</dt><dd className="num font-mono text-zinc-300">{fmtEUR(r.discretionary)}</dd></div>
                  <div className="flex justify-between gap-2 sm:block"><dt className="text-zinc-500">Hormiga</dt><dd className="num font-mono text-zinc-300">{fmtEUR(r.ant)}</dd></div>
                  <div className="flex justify-between gap-2 sm:block"><dt className="text-zinc-500">Suscripciones</dt><dd className="num font-mono text-zinc-300">{fmtEUR(r.subscriptions)}</dd></div>
                </dl>
              </div>
            ))}
          </div>
        </>
      )}
    </Panel>
  );
}
