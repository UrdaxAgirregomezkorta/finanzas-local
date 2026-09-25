import { useCallback, useEffect, useMemo, useState } from 'react';
import { Upload, FlaskConical, Wallet } from 'lucide-react';
import { FinanceProvider, useFinance } from './hooks/useFinance.jsx';
import { ToastProvider } from './components/ui/Toast.jsx';
import { Button, EmptyState, Panel } from './components/ui/primitives.jsx';
import { NAV, Sidebar, MobileBar, PageHeader, PeriodSelect, DemoBanner } from './components/layout/Shell.jsx';
import { FreeToSpendHero, KpiStrip } from './components/dashboard/Overview.jsx';
import { CategoryDonut, MonthlyBars, BalanceFlow } from './components/dashboard/Charts.jsx';
import { QuickAudit } from './components/dashboard/QuickAudit.jsx';
import { AntExpenses, Subscriptions, BankComparison } from './components/audit/Audit.jsx';
import { TransactionsTable, EMPTY_FILTERS } from './components/transactions/TransactionsTable.jsx';
import { TransfersView } from './components/transfers/TransfersView.jsx';
import { ImportView } from './components/import/ImportView.jsx';
import { SettingsView } from './components/settings/SettingsView.jsx';
import { availableMonths, computeKpis, filterByPeriod } from './lib/analytics.js';
import { daysInMonth } from './lib/format.js';

const VIEW_IDS = NAV.map((n) => n.id);
const readHash = () => {
  const id = window.location.hash.replace('#/', '').replace('#', '');
  return VIEW_IDS.includes(id) ? id : 'dashboard';
};

/** Vista sincronizada con el hash (#/movimientos…) para que atrás/adelante funcionen. */
function useHashView() {
  const [view, setView] = useState(readHash);
  useEffect(() => {
    const onHash = () => setView(readHash());
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);
  const navigate = useCallback((id) => {
    if (window.location.hash !== `#/${id}`) window.location.hash = `/${id}`;
    setView(id);
    window.scrollTo({ top: 0, behavior: 'instant' in window ? 'instant' : 'auto' });
  }, []);
  return [view, navigate];
}

function periodRange(period) {
  if (!period || period === 'all') return { from: '', to: '' };
  return { from: `${period}-01`, to: `${period}-${String(daysInMonth(period)).padStart(2, '0')}` };
}

function LoadingScreen() {
  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="flex items-center gap-3 text-sm text-zinc-500">
        <span className="h-4 w-4 animate-spin rounded-full border-2 border-zinc-700 border-t-accent" aria-hidden />
        Abriendo tus datos locales
      </div>
    </div>
  );
}

function NoData({ onImport }) {
  const { loadDemo } = useFinance();
  return (
    <Panel className="py-10">
      <EmptyState
        icon={Wallet}
        title="Todavía no hay movimientos"
        action={
          <div className="flex flex-wrap justify-center gap-2">
            <Button variant="accent" icon={Upload} onClick={onImport}>
              Importar extractos
            </Button>
            <Button icon={FlaskConical} onClick={loadDemo}>
              Cargar datos de ejemplo
            </Button>
          </div>
        }
      >
        Arrastra los CSV o Excel de Santander, Kutxabank, Openbank o Revolut. Todo se procesa y guarda en este navegador.
      </EmptyState>
    </Panel>
  );
}

function Workspace() {
  const finance = useFinance();
  const [view, navigate] = useHashView();
  const [period, setPeriod] = useState(null);
  const [txFilters, setTxFilters] = useState(EMPTY_FILTERS);

  const transactions = finance.ready ? finance.transactions : [];
  const months = useMemo(() => availableMonths(transactions), [transactions]);

  // Periodo por defecto: el último mes con datos. Se corrige si deja de existir.
  useEffect(() => {
    if (!finance.ready) return;
    if (period === 'all') return;
    if (!period || !months.includes(period)) setPeriod(months[0] ?? 'all');
  }, [finance.ready, months, period]);

  const settings = finance.settings;
  const kpis = useMemo(
    () => (finance.ready && period ? computeKpis(transactions, period, settings) : null),
    [finance.ready, transactions, period, settings],
  );
  const periodTxs = useMemo(() => filterByPeriod(transactions, period), [transactions, period]);

  const counts = useMemo(
    () => ({
      transactions: transactions.length || null,
      transfers: transactions.filter((t) => t.is_internal_transfer).length || null,
    }),
    [transactions],
  );

  if (!finance.ready || !period) return <LoadingScreen />;

  const hasData = transactions.length > 0;
  const goImport = () => navigate('import');

  const openCategory = (category) => {
    setTxFilters({ ...EMPTY_FILTERS, category, ...periodRange(period) });
    navigate('transactions');
  };

  const periodPicker = hasData && <PeriodSelect months={months} value={period} onChange={setPeriod} />;

  let content;
  switch (view) {
    case 'transactions':
      content = (
        <>
          <PageHeader title="Movimientos" description="Todas tus cuentas en una sola tabla. Cambia la categoría con un clic y Balance recordará la regla." />
          {hasData ? <TransactionsTable filters={txFilters} setFilters={setTxFilters} /> : <NoData onImport={goImport} />}
        </>
      );
      break;
    case 'audit':
      content = (
        <>
          <PageHeader title="Auditoría" description="Micro-gastos, cobros recurrentes y qué cuenta concentra el gasto prescindible.">
            {periodPicker}
          </PageHeader>
          {hasData ? (
            <div className="flex flex-col gap-4">
              <AntExpenses allTransactions={transactions} period={period} threshold={settings.antThreshold} />
              <Subscriptions allTransactions={transactions} />
              <BankComparison allTransactions={transactions} period={period} threshold={settings.antThreshold} />
            </div>
          ) : (
            <NoData onImport={goImport} />
          )}
        </>
      );
      break;
    case 'transfers':
      content = (
        <>
          <PageHeader title="Movimientos entre cuentas" description="Traspasos entre tus propias cuentas. No cuentan como gasto ni como ingreso." />
          {hasData ? <TransfersView /> : <NoData onImport={goImport} />}
        </>
      );
      break;
    case 'import':
      content = (
        <>
          <PageHeader title="Importar extractos" description="CSV, Excel o texto pegado. El banco y las columnas se detectan solos; nada se sube a ningún servidor." />
          <ImportView />
        </>
      );
      break;
    case 'settings':
      content = (
        <>
          <PageHeader title="Reglas y ajustes" description="Palabras clave de categorización, objetivo de ahorro y parámetros de detección." />
          <SettingsView />
        </>
      );
      break;
    default:
      content = (
        <>
          <PageHeader title="Resumen" description={`Hola, ${settings.ownerName.split(' ')[0]}. Esto es lo que ha pasado con tu dinero, sin contar traspasos entre cuentas.`}>
            {periodPicker}
          </PageHeader>
          <DemoBanner onImport={goImport} />
          {hasData ? (
            <div className="flex flex-col gap-4">
              <FreeToSpendHero kpis={kpis} period={period} settings={settings} />
              <KpiStrip kpis={kpis} period={period} />
              <div className="grid gap-4 xl:grid-cols-2">
                <div className="min-w-0">
                  <CategoryDonut transactions={periodTxs} onSelectCategory={openCategory} />
                </div>
                <div className="min-w-0">
                  <MonthlyBars allTransactions={transactions} period={period} onSelectMonth={setPeriod} />
                </div>
              </div>
              <div className="grid gap-4 xl:grid-cols-5">
                <div className="min-w-0 xl:col-span-3">
                  <BalanceFlow allTransactions={transactions} period={period} />
                </div>
                <div className="min-w-0 xl:col-span-2">
                  <QuickAudit allTransactions={transactions} period={period} threshold={settings.antThreshold} onOpen={navigate} />
                </div>
              </div>
            </div>
          ) : (
            <NoData onImport={goImport} />
          )}
        </>
      );
  }

  return (
    <div className="flex min-h-screen">
      <Sidebar view={view} onNavigate={navigate} counts={counts} />
      <div className="min-w-0 flex-1">
        <MobileBar view={view} onNavigate={navigate} />
        <main key={view} className="mx-auto w-full max-w-[1320px] animate-fade-in px-4 pb-28 pt-6 sm:px-6 lg:px-10 lg:pb-12 lg:pt-10">
          {content}
        </main>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <ToastProvider>
      <FinanceProvider>
        <Workspace />
      </FinanceProvider>
    </ToastProvider>
  );
}
