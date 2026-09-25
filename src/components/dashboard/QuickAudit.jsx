import { useMemo } from 'react';
import { Coffee, Repeat, Landmark, ChevronRight } from 'lucide-react';
import { antExpenses, detectSubscriptions, bankBreakdown, filterByPeriod } from '../../lib/analytics.js';
import { fmtEUR, fmtEUR0, fmtPct } from '../../lib/format.js';
import { Panel, PanelHeader, BankDot } from '../ui/primitives.jsx';

function Row({ icon: Icon, title, value, detail, onClick, accent }) {
  return (
    <button type="button" onClick={onClick} className="group flex w-full items-center gap-4 px-5 py-4 text-left transition-colors hover:bg-zinc-800/30">
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-zinc-800 bg-ink-950/60">
        <Icon className="h-4 w-4" style={{ color: accent }} strokeWidth={1.75} aria-hidden />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[13px] text-zinc-400">{title}</span>
        <span className="num mt-0.5 block font-mono text-lg text-zinc-50">{value}</span>
        <span className="mt-0.5 block text-[12.5px] text-zinc-500">{detail}</span>
      </span>
      <ChevronRight className="h-4 w-4 text-zinc-600 transition-transform group-hover:translate-x-0.5 group-hover:text-zinc-300" aria-hidden />
    </button>
  );
}

export function QuickAudit({ allTransactions, period, threshold, onOpen }) {
  const ant = useMemo(() => antExpenses(allTransactions, period, threshold), [allTransactions, period, threshold]);
  const subs = useMemo(() => detectSubscriptions(allTransactions), [allTransactions]);
  const banks = useMemo(() => bankBreakdown(filterByPeriod(allTransactions, period), threshold), [allTransactions, period, threshold]);
  const leak = banks.rows.find((r) => r.id === banks.leakId);

  return (
    <Panel className="flex flex-col">
      <PanelHeader title="Fugas de dinero" description="Lo que más merece una revisión." />
      <div className="mt-2 flex flex-1 flex-col divide-y divide-zinc-800/70">
        <Row
          icon={Coffee}
          accent="#fcd34d"
          title="Gastos hormiga, proyección anual"
          value={fmtEUR0(ant.annualProjection)}
          detail={`${ant.count} micro-compras por ${fmtEUR(ant.total)} en el periodo`}
          onClick={() => onOpen('audit')}
        />
        <Row
          icon={Repeat}
          accent="#b39cf5"
          title="Suscripciones activas al año"
          value={fmtEUR0(subs.annualTotal)}
          detail={`${subs.activeCount} servicios, ${fmtEUR(subs.monthlyTotal)} al mes`}
          onClick={() => onOpen('audit')}
        />
        {leak && (
          <Row
            icon={Landmark}
            accent={leak.color}
            title="Cuenta con más gasto prescindible"
            value={
              <span className="inline-flex items-center gap-2">
                <BankDot bank={leak.id} className="h-2.5 w-2.5" />
                {leak.name}
              </span>
            }
            detail={`${fmtPct(leak.share)} del gasto prescindible, ${fmtEUR(leak.discretionary)}`}
            onClick={() => onOpen('audit')}
          />
        )}
      </div>
    </Panel>
  );
}
