import { useMemo, useState } from 'react';
import {
  PieChart, Pie, Cell, ResponsiveContainer, Tooltip, ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid,
  AreaChart, Area, ReferenceLine,
} from 'recharts';
import { PieChart as PieIcon } from 'lucide-react';
import { expensesByCategory, monthlySeries, cumulativeFlow } from '../../lib/analytics.js';
import { fmtEUR, fmtEUR0, fmtMonth, fmtPct } from '../../lib/format.js';
import { Panel, PanelHeader, Segmented, ChartTooltip, EmptyState, cx } from '../ui/primitives.jsx';

const AXIS = { stroke: '#52525b', fontSize: 11, tickLine: false, axisLine: false };
const GRID = { stroke: '#27272a', strokeDasharray: '2 4', vertical: false };
const compactEUR = (v) => (Math.abs(v) >= 1000 ? `${(v / 1000).toLocaleString('es-ES', { maximumFractionDigits: 1 })}k` : `${Math.round(v)}`);

// ─────────────────────────────────────────────────────────────
// Donut de gasto por categoría
// ─────────────────────────────────────────────────────────────
export function CategoryDonut({ transactions, onSelectCategory }) {
  const [mode, setMode] = useState('all');
  const [hover, setHover] = useState(null);
  const data = useMemo(() => expensesByCategory(transactions, { discretionaryOnly: mode === 'disc' }), [transactions, mode]);
  const total = data.reduce((a, d) => a + d.value, 0);
  const focus = hover !== null ? data[hover] : null;

  return (
    <Panel className="flex flex-col">
      <PanelHeader
        title="Gasto por categoría"
        description="Pulsa una categoría para ver sus movimientos."
        actions={
          <Segmented
            size="sm"
            label="Tipo de gasto"
            value={mode}
            onChange={setMode}
            options={[{ value: 'all', label: 'Todo' }, { value: 'disc', label: 'Sin fijos' }]}
          />
        }
      />
      {data.length === 0 ? (
        <EmptyState icon={PieIcon} title="Sin gastos en este periodo" />
      ) : (
        <div className="grid flex-1 grid-cols-1 items-center gap-2 px-3 pb-4 sm:grid-cols-[184px_minmax(0,1fr)] sm:px-5">
          <div className="relative mx-auto h-[184px] w-[184px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={data}
                  dataKey="value"
                  nameKey="name"
                  innerRadius={62}
                  outerRadius={86}
                  paddingAngle={1.5}
                  stroke="none"
                  onMouseEnter={(_, i) => setHover(i)}
                  onMouseLeave={() => setHover(null)}
                  onClick={(d) => onSelectCategory?.(d.id)}
                  isAnimationActive
                  animationDuration={500}
                  className="cursor-pointer outline-none"
                >
                  {data.map((d, i) => (
                    <Cell key={d.id} fill={d.color} opacity={hover === null || hover === i ? 1 : 0.28} />
                  ))}
                </Pie>
              </PieChart>
            </ResponsiveContainer>
            <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
              <span className="max-w-[110px] truncate text-[11.5px] text-zinc-500">{focus ? focus.name : mode === 'disc' ? 'Discrecional' : 'Total gastado'}</span>
              <span className="num mt-0.5 font-mono text-lg text-zinc-50">{fmtEUR0(focus ? focus.value : total)}</span>
              {focus && <span className="num font-mono text-[11px] text-zinc-500">{fmtPct(focus.value / total)}</span>}
            </div>
          </div>
          <ul className="flex min-w-0 flex-col">
            {data.map((d, i) => (
              <li key={d.id}>
                <button
                  type="button"
                  onMouseEnter={() => setHover(i)}
                  onMouseLeave={() => setHover(null)}
                  onFocus={() => setHover(i)}
                  onBlur={() => setHover(null)}
                  onClick={() => onSelectCategory?.(d.id)}
                  className={cx(
                    'flex w-full items-center gap-2.5 rounded-md px-2 py-1.5 text-left text-[13px] transition-colors',
                    hover === i ? 'bg-zinc-800/60' : 'hover:bg-zinc-800/40',
                  )}
                >
                  <span className="h-2 w-2 shrink-0 rounded-sm" style={{ background: d.color }} aria-hidden />
                  <span className="min-w-0 flex-1 truncate text-zinc-300">{d.name}</span>
                  <span className="num w-11 shrink-0 text-right font-mono text-[11.5px] text-zinc-500">{fmtPct(d.value / total)}</span>
                  <span className="num w-16 shrink-0 text-right font-mono text-zinc-200">{fmtEUR0(d.value)}</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </Panel>
  );
}

// ─────────────────────────────────────────────────────────────
// Ingresos vs gastos mes a mes
// ─────────────────────────────────────────────────────────────
export function MonthlyBars({ allTransactions, period, onSelectMonth }) {
  const data = useMemo(() => monthlySeries(allTransactions, 12), [allTransactions]);
  return (
    <Panel>
      <PanelHeader title="Ingresos y gastos por mes" description="Sin traspasos internos. Pulsa un mes para analizarlo." />
      <div className="h-[260px] px-2 pb-3 pt-4">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart
            data={data}
            barGap={3}
            margin={{ top: 4, right: 12, left: 0, bottom: 0 }}
            onClick={(e) => e?.activePayload && onSelectMonth?.(e.activePayload[0].payload.month)}
          >
            <CartesianGrid {...GRID} />
            <XAxis dataKey="label" {...AXIS} />
            <YAxis {...AXIS} width={44} tickFormatter={compactEUR} />
            <Tooltip cursor={{ fill: '#ffffff08' }} content={<ChartTooltip labelFormatter={(l) => l} />} />
            <Bar dataKey="income" name="Ingresos" radius={[3, 3, 0, 0]} maxBarSize={22} className="cursor-pointer">
              {data.map((d) => (
                <Cell key={d.month} fill="#5fd3a4" fillOpacity={period === 'all' || d.month === period ? 0.9 : 0.35} />
              ))}
            </Bar>
            <Bar dataKey="expenses" name="Gastos" radius={[3, 3, 0, 0]} maxBarSize={22} className="cursor-pointer">
              {data.map((d) => (
                <Cell key={d.month} fill="#a1a1aa" fillOpacity={period === 'all' || d.month === period ? 0.85 : 0.3} />
              ))}
            </Bar>
            <Line dataKey="net" name="Ahorro neto" stroke="#9aa5ff" strokeWidth={1.75} dot={{ r: 2.5, fill: '#9aa5ff', strokeWidth: 0 }} type="monotone" />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </Panel>
  );
}

// ─────────────────────────────────────────────────────────────
// Flujo neto acumulado a lo largo del mes
// ─────────────────────────────────────────────────────────────
export function BalanceFlow({ allTransactions, period }) {
  const { month, prev, data } = useMemo(() => cumulativeFlow(allTransactions, period), [allTransactions, period]);
  const last = [...data].reverse().find((d) => d.actual !== null);
  return (
    <Panel>
      <PanelHeader
        title="Evolución del saldo en el mes"
        description={
          month
            ? `Flujo neto acumulado día a día en ${fmtMonth(month)}${prev ? `, frente a ${fmtMonth(prev)}` : ''}.`
            : 'Sin datos.'
        }
        actions={last && <span className={cx('num font-mono text-sm', last.actual >= 0 ? 'text-gain' : 'text-loss')}>{fmtEUR(last.actual)}</span>}
      />
      <div className="h-[260px] px-2 pb-3 pt-4">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 4, right: 12, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="flowFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#9aa5ff" stopOpacity={0.28} />
                <stop offset="100%" stopColor="#9aa5ff" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid {...GRID} />
            <XAxis dataKey="day" {...AXIS} interval={4} />
            <YAxis {...AXIS} width={44} tickFormatter={compactEUR} />
            <ReferenceLine y={0} stroke="#3f3f46" />
            <Tooltip content={<ChartTooltip labelFormatter={(d) => `Día ${d}`} />} />
            {prev && (
              <Area dataKey="previous" name={fmtMonth(prev, { short: true })} type="monotone" stroke="#71717a" strokeDasharray="4 4" strokeWidth={1.25} fill="none" />
            )}
            <Area dataKey="actual" name={fmtMonth(month, { short: true })} type="monotone" stroke="#9aa5ff" strokeWidth={2} fill="url(#flowFill)" connectNulls={false} />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </Panel>
  );
}
