import { BANKS, CATEGORIES } from '../../lib/constants.js';
import { fmtEUR, fmtSigned } from '../../lib/format.js';

const cx = (...c) => c.filter(Boolean).join(' ');
export { cx };

/** Superficie principal. `tone="raised"` para paneles destacados. */
export function Panel({ className, children, tone = 'base', as: Tag = 'section', ...rest }) {
  return (
    <Tag
      className={cx(
        'rounded-xl border',
        tone === 'raised' ? 'border-zinc-700/60 bg-ink-850/80' : 'border-zinc-800 bg-ink-900/70',
        'shadow-card backdrop-blur-sm',
        className,
      )}
      {...rest}
    >
      {children}
    </Tag>
  );
}

export function PanelHeader({ title, description, actions, className }) {
  return (
    <header className={cx('flex flex-wrap items-start justify-between gap-3 px-5 pt-4', className)}>
      <div className="min-w-0">
        <h2 className="text-[15px] font-medium text-zinc-100">{title}</h2>
        {description && <p className="mt-0.5 text-[13px] leading-snug text-zinc-500">{description}</p>}
      </div>
      {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
    </header>
  );
}

export function Button({ variant = 'secondary', size = 'md', className, children, icon: Icon, ...rest }) {
  const variants = {
    primary: 'bg-zinc-100 text-zinc-950 hover:bg-white',
    secondary: 'border border-zinc-800 bg-zinc-900 text-zinc-200 hover:border-zinc-700 hover:bg-zinc-800/80',
    ghost: 'text-zinc-400 hover:bg-zinc-800/60 hover:text-zinc-100',
    danger: 'border border-red-900/60 bg-red-950/30 text-red-300 hover:bg-red-950/60',
    accent: 'bg-accent/15 text-accent-strong ring-1 ring-inset ring-accent/30 hover:bg-accent/25',
  };
  const sizes = { sm: 'h-7 px-2.5 text-xs gap-1.5', md: 'h-9 px-3.5 text-sm gap-2', lg: 'h-11 px-5 text-sm gap-2' };
  return (
    <button
      type="button"
      className={cx(
        'inline-flex items-center justify-center rounded-lg font-medium transition-colors duration-150 disabled:pointer-events-none disabled:opacity-40',
        variants[variant],
        sizes[size],
        className,
      )}
      {...rest}
    >
      {Icon && <Icon className={size === 'sm' ? 'h-3.5 w-3.5' : 'h-4 w-4'} strokeWidth={1.75} aria-hidden />}
      {children}
    </button>
  );
}

export function IconButton({ icon: Icon, label, active, className, ...rest }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      aria-pressed={active}
      className={cx(
        'inline-flex h-8 w-8 items-center justify-center rounded-md transition-colors',
        active ? 'bg-accent/15 text-accent-strong' : 'text-zinc-500 hover:bg-zinc-800 hover:text-zinc-200',
        className,
      )}
      {...rest}
    >
      <Icon className="h-4 w-4" strokeWidth={1.75} aria-hidden />
    </button>
  );
}

export function BankDot({ bank, className }) {
  return <span className={cx('inline-block h-2 w-2 shrink-0 rounded-full', className)} style={{ background: BANKS[bank]?.color ?? '#71717a' }} aria-hidden />;
}

export function BankTag({ bank, className }) {
  return (
    <span className={cx('inline-flex items-center gap-1.5 whitespace-nowrap text-[13px] text-zinc-300', className)}>
      <BankDot bank={bank} />
      {BANKS[bank]?.name ?? bank}
    </span>
  );
}

export function CategoryDot({ category }) {
  return <span className="inline-block h-2 w-2 shrink-0 rounded-sm" style={{ background: CATEGORIES[category]?.color ?? '#71717a' }} aria-hidden />;
}

/** Filtro tipo chip (toggle). */
export function Chip({ active, onClick, children, color, className }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cx(
        'inline-flex h-8 items-center gap-2 rounded-full border px-3 text-[13px] transition-colors',
        active ? 'border-zinc-600 bg-zinc-800 text-zinc-100' : 'border-zinc-800 bg-transparent text-zinc-500 hover:border-zinc-700 hover:text-zinc-300',
        className,
      )}
    >
      {color && (
        <span
          className="h-2 w-2 rounded-full transition-opacity"
          style={{ background: color, opacity: active ? 1 : 0.45 }}
          aria-hidden
        />
      )}
      {children}
    </button>
  );
}

export function Badge({ tone = 'neutral', children, className, title }) {
  const tones = {
    neutral: 'bg-zinc-800/80 text-zinc-400',
    accent: 'bg-accent/10 text-accent-strong',
    gain: 'bg-gain/10 text-gain',
    loss: 'bg-loss/10 text-loss',
    warn: 'bg-amber-400/10 text-amber-300',
  };
  return (
    <span title={title} className={cx('inline-flex items-center gap-1 whitespace-nowrap rounded-md px-1.5 py-0.5 text-[11px] font-medium', tones[tone], className)}>
      {children}
    </span>
  );
}

/** Importe con signo, tipografía mono y color semántico. */
export function Money({ value, signed = false, muted = false, className, strike = false }) {
  const tone = muted ? 'text-zinc-500' : signed ? (value > 0 ? 'text-gain' : 'text-zinc-200') : 'text-zinc-100';
  return (
    <span className={cx('num font-mono', tone, strike && 'line-through decoration-zinc-600', className)}>
      {signed ? fmtSigned(value) : fmtEUR(value)}
    </span>
  );
}

export function Segmented({ options, value, onChange, size = 'md', className, label }) {
  return (
    <div role="radiogroup" aria-label={label} className={cx('inline-flex rounded-lg border border-zinc-800 bg-ink-950/60 p-0.5', className)}>
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={value === o.value}
          onClick={() => onChange(o.value)}
          className={cx(
            'rounded-md font-medium transition-colors',
            size === 'sm' ? 'h-6 px-2 text-[11px]' : 'h-7 px-3 text-xs',
            value === o.value ? 'bg-zinc-800 text-zinc-100 shadow-sm' : 'text-zinc-500 hover:text-zinc-300',
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function Switch({ checked, onChange, label, description }) {
  return (
    <label className="flex cursor-pointer items-start justify-between gap-4">
      <span>
        <span className="block text-sm text-zinc-200">{label}</span>
        {description && <span className="mt-0.5 block text-[13px] text-zinc-500">{description}</span>}
      </span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={cx('relative mt-0.5 h-5 w-9 shrink-0 rounded-full transition-colors', checked ? 'bg-accent/70' : 'bg-zinc-700')}
      >
        <span className={cx('absolute left-0 top-0.5 h-4 w-4 rounded-full bg-white shadow-sm transition-transform', checked ? 'translate-x-[18px]' : 'translate-x-0.5')} />
      </button>
    </label>
  );
}

export function Select({ value, onChange, children, className, ...rest }) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className={cx(
        'h-9 rounded-lg border border-zinc-800 bg-zinc-900 px-2.5 pr-8 text-sm text-zinc-200 outline-none transition-colors hover:border-zinc-700 focus:border-accent/60',
        className,
      )}
      {...rest}
    >
      {children}
    </select>
  );
}

export function Input({ className, ...rest }) {
  return (
    <input
      className={cx(
        'h-9 rounded-lg border border-zinc-800 bg-zinc-900 px-3 text-sm text-zinc-100 outline-none transition-colors placeholder:text-zinc-600 hover:border-zinc-700 focus:border-accent/60',
        className,
      )}
      {...rest}
    />
  );
}

export function EmptyState({ icon: Icon, title, children, action }) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-14 text-center">
      {Icon && (
        <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl border border-zinc-800 bg-zinc-900 text-zinc-400">
          <Icon className="h-5 w-5" strokeWidth={1.5} aria-hidden />
        </div>
      )}
      <p className="text-sm font-medium text-zinc-200">{title}</p>
      {children && <p className="mt-1 max-w-sm text-[13px] text-zinc-500">{children}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

/** Tooltip común para Recharts. */
export function ChartTooltip({ active, payload, label, labelFormatter, valueFormatter = fmtEUR }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-zinc-700/70 bg-ink-850/95 px-3 py-2 text-xs shadow-pop backdrop-blur">
      {label !== undefined && <p className="mb-1 text-zinc-400">{labelFormatter ? labelFormatter(label) : label}</p>}
      {payload
        .filter((p) => p.value !== null && p.value !== undefined)
        .map((p) => (
          <p key={p.dataKey ?? p.name} className="flex items-center justify-between gap-4">
            <span className="flex items-center gap-1.5 text-zinc-400">
              <span className="h-2 w-2 rounded-full" style={{ background: p.color || p.payload?.color }} />
              {p.name}
            </span>
            <span className="num font-mono text-zinc-100">{valueFormatter(p.value)}</span>
          </p>
        ))}
    </div>
  );
}
