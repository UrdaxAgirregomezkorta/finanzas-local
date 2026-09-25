import { useState } from 'react';
import { Plus, Trash2, Tags, ChevronDown } from 'lucide-react';
import { useFinance } from '../../hooks/useFinance.jsx';
import { useToast } from '../ui/Toast.jsx';
import { CATEGORIES, CATEGORY_IDS, SYSTEM_RULES } from '../../lib/constants.js';
import { Panel, PanelHeader, Button, Input, Select, Switch, EmptyState, CategoryDot, cx } from '../ui/primitives.jsx';

function NumberField({ label, description, value, onChange, min, max, step = 1, suffix }) {
  const [draft, setDraft] = useState(String(value));
  const commit = () => {
    const n = Number(String(draft).replace(',', '.'));
    if (Number.isFinite(n)) {
      const clamped = Math.min(max, Math.max(min, n));
      onChange(clamped);
      setDraft(String(clamped));
    } else setDraft(String(value));
  };
  return (
    <label className="flex items-start justify-between gap-4">
      <span>
        <span className="block text-sm text-zinc-200">{label}</span>
        {description && <span className="mt-0.5 block text-[13px] text-zinc-500">{description}</span>}
      </span>
      <span className="flex shrink-0 items-center gap-1.5">
        <Input
          inputMode="decimal"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
          className="num w-20 text-right font-mono"
          step={step}
        />
        {suffix && <span className="w-4 text-sm text-zinc-500">{suffix}</span>}
      </span>
    </label>
  );
}

export function SettingsView() {
  const { settings, updateSettings, userRules, addRule, updateRule, deleteRule, resetManualCategories } = useFinance();
  const toast = useToast();
  const [keyword, setKeyword] = useState('');
  const [category, setCategory] = useState('ocio');
  const [owner, setOwner] = useState(settings.ownerName);
  const [openCat, setOpenCat] = useState(null);

  const submitRule = (e) => {
    e.preventDefault();
    if (!keyword.trim()) return;
    const n = addRule(keyword, category);
    toast({ title: `Regla guardada: «${keyword.trim()}» → ${CATEGORIES[category].name}`, description: `${n} movimientos recategorizados.` });
    setKeyword('');
  };

  return (
    <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_380px]">
      <div className="flex flex-col gap-5">
        <Panel>
          <PanelHeader
            title="Tus reglas"
            description="Se aplican antes que las reglas incluidas y a todas las importaciones futuras. Se crean solas al cambiar una categoría en Movimientos."
          />
          <form onSubmit={submitRule} className="flex flex-wrap items-center gap-2 px-5 pt-4">
            <Input value={keyword} onChange={(e) => setKeyword(e.target.value)} placeholder="Palabra del concepto, p. ej. «txoko»" aria-label="Palabra clave" className="min-w-[200px] flex-1" />
            <Select value={category} onChange={setCategory} aria-label="Categoría" className="w-[200px]">
              {CATEGORY_IDS.map((id) => <option key={id} value={id}>{CATEGORIES[id].name}</option>)}
            </Select>
            <button type="submit" disabled={!keyword.trim()} className="inline-flex h-9 items-center gap-2 rounded-lg bg-zinc-100 px-3.5 text-sm font-medium text-zinc-950 hover:bg-white disabled:opacity-40">
              <Plus className="h-4 w-4" aria-hidden /> Añadir regla
            </button>
          </form>
          {userRules.length === 0 ? (
            <EmptyState icon={Tags} title="Todavía no tienes reglas propias">
              Cambia la categoría de cualquier movimiento y se guardará aquí.
            </EmptyState>
          ) : (
            <ul className="mt-4 divide-y divide-zinc-800/70 border-t border-zinc-800/70">
              {[...userRules].reverse().map((r) => (
                <li key={r.id} className="flex flex-wrap items-center gap-3 px-5 py-2.5">
                  <span className="min-w-0 flex-1 truncate font-mono text-[13px] text-zinc-200">{r.keyword}</span>
                  <Select value={r.category} onChange={(c) => updateRule(r.id, { category: c })} aria-label={`Categoría de la regla ${r.keyword}`} className="h-8 w-[200px] text-[13px]">
                    {CATEGORY_IDS.map((id) => <option key={id} value={id}>{CATEGORIES[id].name}</option>)}
                  </Select>
                  <button type="button" onClick={() => deleteRule(r.id)} aria-label={`Eliminar regla ${r.keyword}`} className="rounded-md p-1.5 text-zinc-600 hover:bg-zinc-800 hover:text-loss">
                    <Trash2 className="h-4 w-4" />
                  </button>
                </li>
              ))}
            </ul>
          )}
          <div className="flex justify-end px-5 py-3">
            <Button size="sm" variant="ghost" onClick={() => { resetManualCategories(); toast({ tone: 'info', title: 'Categorías manuales restablecidas' }); }}>
              Restablecer categorías asignadas a mano
            </Button>
          </div>
        </Panel>

        <Panel>
          <PanelHeader title="Reglas incluidas" description="Palabras clave que reconoce la app sin configurar nada. Gana la coincidencia más específica." />
          <ul className="mt-3 border-t border-zinc-800/70">
            {Object.entries(SYSTEM_RULES).map(([cat, kws]) => (
              <li key={cat} className="border-b border-zinc-800/70 last:border-0">
                <button
                  type="button"
                  onClick={() => setOpenCat(openCat === cat ? null : cat)}
                  aria-expanded={openCat === cat}
                  className="flex w-full items-center gap-2.5 px-5 py-2.5 text-left text-[13px] hover:bg-zinc-800/30"
                >
                  <CategoryDot category={cat} />
                  <span className="flex-1 text-zinc-200">{CATEGORIES[cat].name}</span>
                  <span className="num font-mono text-[12px] text-zinc-500">{kws.length}</span>
                  <ChevronDown className={cx('h-4 w-4 text-zinc-500 transition-transform', openCat === cat && 'rotate-180')} aria-hidden />
                </button>
                {openCat === cat && (
                  <div className="flex flex-wrap gap-1.5 px-5 pb-3 pt-1">
                    {kws.map((k) => (
                      <span key={k} className="rounded-md bg-zinc-800/70 px-1.5 py-0.5 font-mono text-[11.5px] text-zinc-400">{k}</span>
                    ))}
                  </div>
                )}
              </li>
            ))}
          </ul>
        </Panel>
      </div>

      <div className="flex flex-col gap-5">
        <Panel>
          <PanelHeader title="Presupuesto y auditoría" />
          <div className="flex flex-col gap-5 p-5">
            <NumberField
              label="Objetivo de ahorro"
              description="Porcentaje de los ingresos que reservas antes de calcular lo libre para gastar."
              value={settings.savingsTargetPct}
              min={0}
              max={90}
              suffix="%"
              onChange={(v) => updateSettings({ savingsTargetPct: v })}
            />
            <NumberField
              label="Umbral de gasto hormiga"
              description="Importe máximo de una micro-compra."
              value={settings.antThreshold}
              min={1}
              max={50}
              step={0.5}
              suffix="€"
              onChange={(v) => updateSettings({ antThreshold: v })}
            />
          </div>
        </Panel>

        <Panel>
          <PanelHeader title="Detección de traspasos" description="Los cambios vuelven a analizar todos los movimientos. Tus marcas manuales se mantienen." />
          <div className="flex flex-col gap-5 p-5">
            <label className="block">
              <span className="block text-sm text-zinc-200">Titular de las cuentas</span>
              <span className="mt-0.5 block text-[13px] text-zinc-500">Tu nombre tal y como aparece en las transferencias.</span>
              <Input
                value={owner}
                onChange={(e) => setOwner(e.target.value)}
                onBlur={() => owner !== settings.ownerName && updateSettings({ ownerName: owner })}
                onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
                className="mt-2 w-full"
              />
            </label>
            <NumberField
              label="Margen de fechas"
              description="Días de diferencia máxima entre la salida y la entrada."
              value={settings.transferWindowDays}
              min={0}
              max={10}
              suffix="d"
              onChange={(v) => updateSettings({ transferWindowDays: Math.round(v) })}
            />
            <Switch
              checked={settings.keywordSingleLegTransfers}
              onChange={(v) => updateSettings({ keywordSingleLegTransfers: v })}
              label="Neutralizar traspasos sin pareja"
              description="Marca como traspaso los movimientos con conceptos como «traspaso» o «top-up» aunque la otra cuenta no esté importada."
            />
          </div>
        </Panel>
      </div>
    </div>
  );
}
