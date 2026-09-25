import { LayoutDashboard, Rows3, ScanSearch, ArrowLeftRight, Upload, SlidersHorizontal, ShieldCheck, FlaskConical, X } from 'lucide-react';
import { useFinance } from '../../hooks/useFinance.jsx';
import { fmtMonth } from '../../lib/format.js';
import { Button, Select, cx } from '../ui/primitives.jsx';

export const NAV = [
  { id: 'dashboard', label: 'Resumen', icon: LayoutDashboard },
  { id: 'transactions', label: 'Movimientos', icon: Rows3 },
  { id: 'audit', label: 'Auditoría', icon: ScanSearch },
  { id: 'transfers', label: 'Traspasos', icon: ArrowLeftRight },
  { id: 'import', label: 'Importar', icon: Upload },
  { id: 'settings', label: 'Reglas y ajustes', icon: SlidersHorizontal },
];

function Logo() {
  return (
    <div className="flex items-center gap-2.5">
      <svg viewBox="0 0 32 32" className="h-7 w-7" aria-hidden>
        <rect width="32" height="32" rx="8" fill="#18181c" stroke="#27272a" />
        <path d="M8 21h16M8 16h10M8 11h6" stroke="#9aa5ff" strokeWidth="2.4" strokeLinecap="round" />
      </svg>
      <span className="text-[15px] font-semibold tracking-tight text-zinc-100">Balance</span>
    </div>
  );
}

function SaveStatus() {
  const { saveInfo, transactions } = useFinance();
  const time = saveInfo.at ? new Date(saveInfo.at).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' }) : null;
  return (
    <div className="rounded-lg border border-zinc-800/80 bg-ink-950/50 p-3 text-[12px] leading-relaxed text-zinc-500">
      <p className="flex items-center gap-1.5 text-zinc-300">
        <ShieldCheck className="h-3.5 w-3.5 text-gain" strokeWidth={2} aria-hidden />
        Solo en este navegador
      </p>
      <p className="mt-1">
        {transactions.length.toLocaleString('es-ES')} movimientos guardados
        {time && <> a las <span className="num font-mono text-zinc-400">{time}</span></>}.
      </p>
    </div>
  );
}

export function Sidebar({ view, onNavigate, counts }) {
  return (
    <aside className="sticky top-0 hidden h-screen w-60 shrink-0 flex-col border-r border-zinc-800/80 bg-ink-950/80 px-3 py-5 lg:flex">
      <div className="px-2">
        <Logo />
      </div>
      <nav className="mt-8 flex flex-col gap-0.5" aria-label="Secciones">
        {NAV.map((item) => {
          const active = view === item.id;
          const Icon = item.icon;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onNavigate(item.id)}
              aria-current={active ? 'page' : undefined}
              className={cx(
                'group flex h-9 items-center gap-3 rounded-lg px-2.5 text-sm transition-colors',
                active ? 'bg-zinc-800/70 text-zinc-100' : 'text-zinc-400 hover:bg-zinc-900 hover:text-zinc-200',
              )}
            >
              <Icon className={cx('h-4 w-4', active ? 'text-accent' : 'text-zinc-500 group-hover:text-zinc-300')} strokeWidth={1.75} aria-hidden />
              <span className="flex-1 text-left">{item.label}</span>
              {counts?.[item.id] ? <span className="num font-mono text-[11px] text-zinc-500">{counts[item.id]}</span> : null}
            </button>
          );
        })}
      </nav>
      <div className="mt-auto px-1">
        <SaveStatus />
      </div>
    </aside>
  );
}

export function MobileBar({ view, onNavigate }) {
  const items = NAV.filter((n) => n.id !== 'settings');
  return (
    <>
      <header
        className="sticky top-0 z-30 flex items-center justify-between border-b border-zinc-800/80 bg-ink-950/85 px-4 py-3 backdrop-blur-lg lg:hidden"
        style={{ paddingTop: 'calc(env(safe-area-inset-top, 0px) + 0.75rem)' }}
      >
        <Logo />
        <button
          type="button"
          onClick={() => onNavigate('settings')}
          aria-label="Reglas y ajustes"
          className={cx('rounded-lg p-2', view === 'settings' ? 'bg-zinc-800 text-zinc-100' : 'text-zinc-400')}
        >
          <SlidersHorizontal className="h-5 w-5" strokeWidth={1.75} />
        </button>
      </header>
      <nav
        className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-5 border-t border-zinc-800/80 bg-ink-950/90 backdrop-blur-lg lg:hidden"
        style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
        aria-label="Secciones"
      >
        {items.map((item) => {
          const Icon = item.icon;
          const active = view === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onNavigate(item.id)}
              aria-current={active ? 'page' : undefined}
              className={cx('flex flex-col items-center gap-1 py-2.5 text-[10.5px]', active ? 'text-zinc-100' : 'text-zinc-500')}
            >
              <Icon className={cx('h-5 w-5', active && 'text-accent')} strokeWidth={1.75} aria-hidden />
              {item.label}
            </button>
          );
        })}
      </nav>
    </>
  );
}

export function PageHeader({ title, description, children }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div className="min-w-0">
        <h1 className="text-[22px] font-semibold tracking-tight text-zinc-50 sm:text-2xl">{title}</h1>
        {description && <p className="mt-1 max-w-2xl text-sm text-zinc-500">{description}</p>}
      </div>
      {children && <div className="flex flex-wrap items-center gap-2">{children}</div>}
    </div>
  );
}

export function PeriodSelect({ months, value, onChange }) {
  return (
    <Select value={value} onChange={onChange} aria-label="Periodo" className="min-w-[170px] capitalize">
      {months.map((m) => (
        <option key={m} value={m} className="capitalize">
          {fmtMonth(m)}
        </option>
      ))}
      <option value="all">Todo el histórico</option>
    </Select>
  );
}

export function DemoBanner({ onImport }) {
  const { isDemo, clearAll } = useFinance();
  if (!isDemo) return null;
  return (
    <div className="mb-6 flex flex-wrap items-center gap-3 rounded-xl border border-accent/20 bg-accent/[0.06] px-4 py-3">
      <FlaskConical className="h-4 w-4 shrink-0 text-accent" strokeWidth={1.75} aria-hidden />
      <p className="min-w-0 flex-1 basis-[220px] text-[13px] text-zinc-300">
        Estás viendo seis meses de datos de ejemplo. Importa tus extractos para sustituirlos; nada sale de este navegador.
      </p>
      <div className="flex gap-2">
        <Button size="sm" variant="accent" icon={Upload} onClick={onImport}>
          Importar extractos
        </Button>
        <Button size="sm" variant="ghost" icon={X} onClick={clearAll}>
          Vaciar
        </Button>
      </div>
    </div>
  );
}
