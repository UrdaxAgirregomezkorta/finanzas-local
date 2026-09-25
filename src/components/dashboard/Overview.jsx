import { ArrowDownRight, ArrowUpRight } from 'lucide-react';
import { fmtEUR, fmtPct, fmtMonth, prevMonth } from '../../lib/format.js';
import { Panel, cx } from '../ui/primitives.jsx';

function Delta({ value, inverse = false, points = false, period }) {
  if (value === null || value === undefined || !Number.isFinite(value)) return null;
  const good = inverse ? value < 0 : value > 0;
  const Icon = value >= 0 ? ArrowUpRight : ArrowDownRight;
  const text = points ? `${value >= 0 ? '+' : '−'}${Math.abs(value * 100).toFixed(1).replace('.', ',')} pp` : `${value >= 0 ? '+' : '−'}${fmtPct(Math.abs(value))}`;
  return (
    <span className={cx('inline-flex items-center gap-0.5 text-xs', Math.abs(value) < 0.005 ? 'text-zinc-500' : good ? 'text-gain' : 'text-loss')}>
      <Icon className="h-3.5 w-3.5" strokeWidth={2} aria-hidden />
      <span className="num font-mono">{text}</span>
      <span className="ml-1 text-zinc-600">vs {fmtMonth(prevMonth(period), { short: true })}</span>
    </span>
  );
}

/**
 * Hero: cuánto queda para gastar tras fijos, objetivo de ahorro y variable ya consumido.
 * La barra reparte los ingresos del periodo entre esos cuatro destinos.
 */
export function FreeToSpendHero({ kpis, period, settings }) {
  const { income, fixed, variable, savingsTarget, freeToSpend, variableBudget } = kpis;
  const over = freeToSpend < 0;
  const overspend = over ? -freeToSpend : 0;
  const scale = Math.max(income, fixed + variable + savingsTarget, 1);

  const segments = [
    { id: 'fixed', label: 'Gastos fijos', value: fixed, className: 'bg-zinc-500/70' },
    { id: 'variable', label: 'Variable gastado', value: Math.min(variable, variableBudget), className: 'bg-accent/80' },
    over && { id: 'over', label: 'Exceso sobre presupuesto', value: overspend, className: 'bg-loss/80 bg-stripes' },
    { id: 'target', label: `Ahorro objetivo (${settings.savingsTargetPct} %)`, value: Math.max(0, savingsTarget - overspend), className: 'bg-gain/25 ring-1 ring-inset ring-gain/40' },
    !over && { id: 'free', label: 'Libre para gastar', value: freeToSpend, className: 'bg-zinc-100' },
  ].filter(Boolean);

  const periodLabel = period === 'all' ? 'en todo el histórico' : `en ${fmtMonth(period)}`;

  return (
    <Panel tone="raised" className="overflow-hidden">
      <div className="px-5 pb-5 pt-5 sm:px-7 sm:pt-6">
        <p className="text-sm text-zinc-400">
          {over ? 'Te has pasado del presupuesto variable' : 'Libre para gastar'} {periodLabel}
        </p>
        <p className={cx('num mt-2 font-mono text-[40px] font-medium leading-none tracking-tight sm:text-[56px]', over ? 'text-loss' : 'text-zinc-50')}>
          {fmtEUR(over ? overspend : freeToSpend)}
        </p>
        <p className="mt-3 max-w-xl text-[13px] leading-relaxed text-zinc-500">
          De <span className="num font-mono text-zinc-300">{fmtEUR(income)}</span> de ingresos reales, tras{' '}
          <span className="num font-mono text-zinc-300">{fmtEUR(fixed)}</span> en fijos y reservar el {settings.savingsTargetPct} % para ahorro, tu
          presupuesto variable era <span className="num font-mono text-zinc-300">{fmtEUR(variableBudget)}</span> y llevas{' '}
          <span className="num font-mono text-zinc-300">{fmtEUR(variable)}</span>.
        </p>
      </div>

      <div className="border-t border-zinc-800/80 bg-ink-950/40 px-5 py-4 sm:px-7">
        <div className="flex h-3 w-full gap-[3px] overflow-hidden rounded-full" role="img" aria-label="Reparto de los ingresos del periodo">
          {segments.map((s) =>
            s.value > 0 ? (
              <div
                key={s.id}
                className={cx('h-full origin-left animate-grow-x rounded-[3px] first:rounded-l-full last:rounded-r-full', s.className)}
                style={{ width: `${(s.value / scale) * 100}%` }}
                title={`${s.label}: ${fmtEUR(s.value)}`}
              />
            ) : null,
          )}
        </div>
        <dl className="mt-3 flex flex-wrap gap-x-6 gap-y-2">
          {segments.map((s) => (
            <div key={s.id} className="flex items-center gap-2 text-[12.5px]">
              <span className={cx('h-2 w-2 rounded-sm', s.className)} aria-hidden />
              <dt className="text-zinc-500">{s.label}</dt>
              <dd className="num font-mono text-zinc-200">{fmtEUR(s.value)}</dd>
            </div>
          ))}
        </dl>
      </div>
    </Panel>
  );
}

export function KpiStrip({ kpis, period }) {
  const d = kpis.deltas;
  const items = [
    {
      label: 'Ingresos netos reales',
      value: fmtEUR(kpis.income),
      hint: 'Nómina, rendimientos y otros abonos. Sin traspasos.',
      delta: d && <Delta value={d.income} period={period} />,
    },
    {
      label: 'Gastos consolidados',
      value: fmtEUR(kpis.expenses),
      hint:
        kpis.transfersCount > 0
          ? `${fmtEUR(kpis.transfersVolume)} movidos entre tus cuentas no cuentan como gasto.`
          : 'Los 4 bancos sumados, sin traspasos internos.',
      delta: d && <Delta value={d.expenses} inverse period={period} />,
    },
    {
      label: 'Tasa de ahorro neta',
      value: fmtPct(kpis.savingsRate),
      sub: fmtEUR(kpis.net),
      hint: kpis.net >= 0 ? 'Ingresos menos gastos del periodo.' : 'Has gastado más de lo que ha entrado.',
      delta: d && <Delta value={d.savingsRate} points period={period} />,
      negative: kpis.net < 0,
    },
  ];

  return (
    <Panel className="grid grid-cols-1 divide-y divide-zinc-800/80 sm:grid-cols-3 sm:divide-x sm:divide-y-0">
      {items.map((it) => (
        <div key={it.label} className="px-5 py-4 sm:py-5">
          <p className="text-[13px] text-zinc-400">{it.label}</p>
          <p className="mt-2 flex items-baseline gap-2">
            <span className={cx('num font-mono text-2xl font-medium tracking-tight', it.negative ? 'text-loss' : 'text-zinc-50')}>{it.value}</span>
            {it.sub && <span className={cx('num font-mono text-sm', it.negative ? 'text-loss/80' : 'text-zinc-400')}>{it.sub}</span>}
          </p>
          <div className="mt-1.5 min-h-[18px]">{it.delta}</div>
          <p className="mt-2 text-[12.5px] leading-snug text-zinc-500">{it.hint}</p>
        </div>
      ))}
    </Panel>
  );
}
