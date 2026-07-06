import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { Link } from 'react-router-dom';
import type { AllocationDTO, PortfolioSummaryDTO, SignalDTO, SnapshotDTO } from '@bv/shared';
import { api } from '../../lib/api';
import { fmtMoney, fmtPct, timeAgo } from '../../lib/format';
import { useDisplayCurrency, useSession } from '../../lib/session';
import { PageHeader } from '../../components/Layout';
import {
  Badge,
  Card,
  CurrencyToggle,
  ErrorState,
  Skeleton,
  SignedAmount,
} from '../../components/ui';

const PIE_COLORS = ['#4f7cff', '#34d399', '#fbbf24', '#f87171', '#a78bfa', '#22d3ee'];

const SIGNAL_LABEL: Record<
  SignalDTO['kind'],
  { label: string; tone: 'positive' | 'negative' | 'warning' | 'primary' }
> = {
  buy: { label: 'Comprar', tone: 'positive' },
  sell: { label: 'Vender', tone: 'negative' },
  'near-52w-low': { label: 'Cerca de mín 52w', tone: 'primary' },
  'near-52w-high': { label: 'Cerca de máx 52w', tone: 'warning' },
  'daily-move': { label: 'Movimiento fuerte', tone: 'warning' },
};

export function DashboardPage() {
  const { user } = useSession();
  const { currency, setCurrency } = useDisplayCurrency();
  const qc = useQueryClient();

  const summary = useQuery({
    queryKey: ['portfolio', 'summary', currency],
    queryFn: () => api.get<PortfolioSummaryDTO>(`/portfolio/summary?currency=${currency}`),
  });
  const history = useQuery({
    queryKey: ['portfolio', 'history'],
    queryFn: () => api.get<SnapshotDTO[]>('/portfolio/history'),
  });
  const allocation = useQuery({
    queryKey: ['stats', 'allocation', currency],
    queryFn: () => api.get<AllocationDTO>(`/stats/allocation?currency=${currency}`),
  });
  const signals = useQuery({
    queryKey: ['signals'],
    queryFn: () => api.get<SignalDTO[]>('/signals'),
  });

  const refresh = useMutation({
    mutationFn: () => api.post('/quotes/refresh'),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['portfolio'] });
      void qc.invalidateQueries({ queryKey: ['stats'] });
      void qc.invalidateQueries({ queryKey: ['signals'] });
    },
  });

  const s = summary.data;
  const chartData = (history.data ?? []).map((h) => ({
    date: h.date.slice(5), // MM-DD
    value: currency === 'ARS' ? h.valueARS : h.valueUSD,
  }));

  return (
    <div>
      <PageHeader
        title={`Hola, ${user?.displayName ?? ''}`}
        right={<CurrencyToggle value={currency} onChange={setCurrency} />}
      />

      {summary.isLoading && <Skeleton className="h-40" />}
      {summary.isError && <ErrorState onRetry={() => summary.refetch()} />}
      {s && (
        <Card className="mb-4">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs text-muted">Valor del portafolio</p>
              <p className="text-3xl font-bold tabular-nums">{fmtMoney(s.value, currency)}</p>
            </div>
            <button
              onClick={() => refresh.mutate()}
              disabled={refresh.isPending}
              className="p-1 text-muted hover:text-text disabled:opacity-50"
              aria-label="Actualizar cotizaciones"
            >
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                className={refresh.isPending ? 'animate-spin' : ''}
              >
                <path d="M21 12a9 9 0 1 1-2.64-6.36M21 3v6h-6" />
              </svg>
            </button>
          </div>
          <div className="mt-4 grid grid-cols-3 gap-2 text-center">
            <div>
              <p className="text-[10px] uppercase tracking-wide text-muted">Invertido</p>
              <p className="text-sm font-semibold tabular-nums">{fmtMoney(s.invested, currency)}</p>
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-wide text-muted">No realizado</p>
              <SignedAmount value={s.unrealized}>
                <span className="text-sm">{fmtMoney(s.unrealized, currency)}</span>
              </SignedAmount>
              <p className="text-[10px] text-muted">{fmtPct(s.unrealizedPct)}</p>
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-wide text-muted">Realizado</p>
              <SignedAmount value={s.realized}>
                <span className="text-sm">{fmtMoney(s.realized, currency)}</span>
              </SignedAmount>
            </div>
          </div>
          {s.fx && (
            <p className="mt-3 text-center text-[10px] text-muted">
              Dólar {s.fx.kind.toUpperCase()} {fmtMoney(s.fx.value, 'ARS')} ·{' '}
              {timeAgo(s.fx.fetchedAt)}
              {s.quotesMissing > 0 ? ` · ${s.quotesMissing} activo(s) sin cotización` : ''}
            </p>
          )}
        </Card>
      )}

      {chartData.length > 1 && (
        <Card className="mb-4">
          <h2 className="mb-2 text-sm font-semibold text-muted">Evolución</h2>
          <ResponsiveContainer width="100%" height={160}>
            <LineChart data={chartData} margin={{ top: 4, right: 4, bottom: 0, left: 4 }}>
              <XAxis
                dataKey="date"
                tick={{ fontSize: 10, fill: '#8b93a7' }}
                tickLine={false}
                axisLine={false}
              />
              <YAxis hide domain={['auto', 'auto']} />
              <Tooltip
                contentStyle={{
                  background: '#1b2130',
                  border: '1px solid #262e40',
                  borderRadius: 8,
                  fontSize: 12,
                }}
                formatter={(v: number) => [fmtMoney(v, currency), 'Valor']}
              />
              <Line type="monotone" dataKey="value" stroke="#4f7cff" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </Card>
      )}

      {allocation.data && allocation.data.byInstrumentType.length > 0 && (
        <Card className="mb-4">
          <h2 className="mb-2 text-sm font-semibold text-muted">Distribución por tipo</h2>
          <div className="flex items-center gap-4">
            <ResponsiveContainer width={120} height={120}>
              <PieChart>
                <Pie
                  data={allocation.data.byInstrumentType}
                  dataKey="value"
                  nameKey="label"
                  innerRadius={35}
                  outerRadius={55}
                  strokeWidth={0}
                >
                  {allocation.data.byInstrumentType.map((_, i) => (
                    <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                  ))}
                </Pie>
              </PieChart>
            </ResponsiveContainer>
            <ul className="flex-1 space-y-1 text-xs">
              {allocation.data.byInstrumentType.map((slice, i) => (
                <li key={slice.label} className="flex items-center justify-between">
                  <span className="flex items-center gap-2">
                    <span
                      className="inline-block h-2 w-2 rounded-full"
                      style={{ background: PIE_COLORS[i % PIE_COLORS.length] }}
                    />
                    {slice.label}
                  </span>
                  <span className="tabular-nums text-muted">{fmtPct(slice.pct, false)}</span>
                </li>
              ))}
            </ul>
          </div>
        </Card>
      )}

      {signals.data && signals.data.length > 0 && (
        <Card>
          <h2 className="mb-2 text-sm font-semibold text-muted">Señales</h2>
          <ul className="space-y-2">
            {signals.data.slice(0, 6).map((sig, i) => (
              <li key={`${sig.assetId}-${sig.kind}-${i}`}>
                <Link
                  to={`/assets/${sig.assetId}`}
                  className="flex items-center justify-between text-sm"
                >
                  <span className="flex items-center gap-2">
                    <span className="font-semibold">{sig.ticker}</span>
                    <Badge tone={SIGNAL_LABEL[sig.kind].tone}>{SIGNAL_LABEL[sig.kind].label}</Badge>
                  </span>
                  <span className="text-xs text-muted">{sig.message}</span>
                </Link>
              </li>
            ))}
          </ul>
          <p className="mt-3 text-[10px] text-muted">
            Las señales son informativas, no constituyen asesoramiento financiero.
          </p>
        </Card>
      )}
    </div>
  );
}
