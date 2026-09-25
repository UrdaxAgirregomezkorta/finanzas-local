import { useMemo } from 'react';
import { ArrowRight, ArrowLeftRight, RotateCcw, ScanLine, Unlink, Link2, Lightbulb } from 'lucide-react';
import { useFinance } from '../../hooks/useFinance.jsx';
import { useToast } from '../ui/Toast.jsx';
import { groupTransfers, transferSuggestions } from '../../lib/transfers.js';
import { fmtDate, fmtEUR, daysBetween } from '../../lib/format.js';
import { Panel, PanelHeader, Button, Badge, BankTag, EmptyState, Money } from '../ui/primitives.jsx';

const CONFIDENCE = {
  alta: { tone: 'gain', label: 'Confianza alta' },
  media: { tone: 'warn', label: 'Confianza media' },
  'palabra clave': { tone: 'neutral', label: 'Por palabra clave' },
  manual: { tone: 'accent', label: 'Marcado a mano' },
};

function Leg({ tx, align = 'left' }) {
  return (
    <div className={align === 'right' ? 'sm:text-right' : ''}>
      <BankTag bank={tx.bank} className="text-sm text-zinc-100" />
      <p className="mt-0.5 truncate text-[12.5px] text-zinc-500" title={tx.description}>{tx.description}</p>
      <p className="num mt-0.5 font-mono text-[12px] text-zinc-600">{fmtDate(tx.date)}</p>
    </div>
  );
}

export function TransfersView() {
  const { transactions, toggleTransfer, rerunTransfers, markPair, settings } = useFinance();
  const toast = useToast();
  const { pairs, singles } = useMemo(() => groupTransfers(transactions), [transactions]);
  const suggestions = useMemo(() => transferSuggestions(transactions, Math.max(5, settings.transferWindowDays + 3)), [transactions, settings.transferWindowDays]);
  const volume = pairs.reduce((a, p) => a + p.amount, 0) + singles.reduce((a, t) => a + Math.abs(t.amount), 0) / 2;

  const unmark = (id, label) => {
    toggleTransfer(id);
    toast({ tone: 'info', title: `${label} desmarcado`, description: 'Vuelve a computar en ingresos y gastos.' });
  };

  return (
    <div className="flex flex-col gap-5">
      <Panel className="grid grid-cols-1 divide-y divide-zinc-800/80 sm:grid-cols-3 sm:divide-x sm:divide-y-0">
        <div className="px-5 py-4">
          <p className="text-[13px] text-zinc-400">Pares emparejados</p>
          <p className="num mt-1.5 font-mono text-2xl text-zinc-50">{pairs.length}</p>
          <p className="mt-1 text-[12.5px] text-zinc-500">Salida y entrada del mismo importe en ±{settings.transferWindowDays} días.</p>
        </div>
        <div className="px-5 py-4">
          <p className="text-[13px] text-zinc-400">Volumen neutralizado</p>
          <p className="num mt-1.5 font-mono text-2xl text-zinc-50">{fmtEUR(volume)}</p>
          <p className="mt-1 text-[12.5px] text-zinc-500">Dinero que solo cambió de cuenta. No es gasto ni ingreso.</p>
        </div>
        <div className="px-5 py-4">
          <p className="text-[13px] text-zinc-400">Sin pareja</p>
          <p className="num mt-1.5 font-mono text-2xl text-zinc-50">{singles.length}</p>
          <p className="mt-1 text-[12.5px] text-zinc-500">Traspasos cuya otra cuenta no está importada o marcados a mano.</p>
        </div>
      </Panel>

      <div className="flex flex-wrap gap-2">
        <Button
          icon={ScanLine}
          onClick={() => {
            const n = rerunTransfers();
            toast({ title: 'Detección completada', description: `${n} movimientos marcados como traspaso. Tus marcas manuales se han respetado.` });
          }}
        >
          Volver a detectar
        </Button>
        <Button
          variant="ghost"
          icon={RotateCcw}
          onClick={() => {
            const n = rerunTransfers({ resetManual: true });
            toast({ tone: 'info', title: 'Marcas manuales eliminadas', description: `La detección automática ha marcado ${n} movimientos.` });
          }}
        >
          Descartar marcas manuales
        </Button>
      </div>

      <Panel>
        <PanelHeader title="Movimientos entre cuentas" description="Cada fila es una salida y su entrada correspondiente en otro banco." />
        {pairs.length === 0 ? (
          <EmptyState icon={ArrowLeftRight} title="No hay traspasos emparejados">
            Importa extractos de al menos dos bancos para que se puedan emparejar salidas y entradas.
          </EmptyState>
        ) : (
          <ul className="mt-3 divide-y divide-zinc-800/70">
            {pairs.map((p) => {
              const conf = CONFIDENCE[p.confidence] ?? CONFIDENCE.media;
              const lag = daysBetween(p.out.date, p.inc.date);
              return (
                <li key={p.id} className="grid grid-cols-1 items-center gap-3 px-5 py-3.5 sm:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)_auto]">
                  <Leg tx={p.out} />
                  <div className="flex items-center gap-2 sm:flex-col sm:gap-1">
                    <span className="num font-mono text-sm text-zinc-100">{fmtEUR(p.amount)}</span>
                    <span className="flex items-center gap-1 text-zinc-600">
                      <span className="hidden h-px w-6 bg-zinc-700 sm:block" />
                      <ArrowRight className="h-3.5 w-3.5" aria-hidden />
                      <span className="hidden h-px w-6 bg-zinc-700 sm:block" />
                    </span>
                    <span className="text-[11px] text-zinc-600">{lag === 0 ? 'mismo día' : `${lag} día${lag > 1 ? 's' : ''}`}</span>
                  </div>
                  <Leg tx={p.inc} align="right" />
                  <div className="flex items-center gap-2 sm:flex-col sm:items-end">
                    <Badge tone={conf.tone}>{conf.label}</Badge>
                    <Button size="sm" variant="ghost" icon={Unlink} onClick={() => unmark(p.out.id, 'Traspaso')}>
                      Desmarcar
                    </Button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </Panel>

      {singles.length > 0 && (
        <Panel>
          <PanelHeader title="Traspasos sin pareja" description="Neutralizados por palabra clave o a mano. Desmárcalos si en realidad son un gasto o un ingreso." />
          <ul className="mt-3 divide-y divide-zinc-800/70">
            {singles.map((t) => (
              <li key={t.id} className="flex flex-wrap items-center gap-3 px-5 py-3">
                <div className="min-w-0 flex-1"><Leg tx={t} /></div>
                <Money value={t.amount} signed />
                <Badge tone={(CONFIDENCE[t.transferConfidence] ?? CONFIDENCE.manual).tone}>{(CONFIDENCE[t.transferConfidence] ?? CONFIDENCE.manual).label}</Badge>
                <Button size="sm" variant="ghost" icon={Unlink} onClick={() => unmark(t.id, 'Movimiento')}>Desmarcar</Button>
              </li>
            ))}
          </ul>
        </Panel>
      )}

      {suggestions.length > 0 && (
        <Panel>
          <PanelHeader
            title="Posibles traspasos sin marcar"
            description="Mismo importe en sentido contrario en otro banco, con algo más de margen de fechas. Revísalos antes de marcarlos."
            actions={<Lightbulb className="h-4 w-4 text-amber-300" aria-hidden />}
          />
          <ul className="mt-3 divide-y divide-zinc-800/70">
            {suggestions.map(({ out, inc }) => (
              <li key={`${out.id}-${inc.id}`} className="grid grid-cols-1 items-center gap-3 px-5 py-3 sm:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)_auto]">
                <Leg tx={out} />
                <span className="num font-mono text-sm text-zinc-300">{fmtEUR(-out.amount)}</span>
                <Leg tx={inc} align="right" />
                <Button
                  size="sm"
                  variant="accent"
                  icon={Link2}
                  onClick={() => {
                    markPair(out.id, inc.id);
                    toast({ title: 'Marcado como traspaso interno', description: 'Ambos movimientos dejan de computar.' });
                  }}
                >
                  Marcar par
                </Button>
              </li>
            ))}
          </ul>
        </Panel>
      )}
    </div>
  );
}
