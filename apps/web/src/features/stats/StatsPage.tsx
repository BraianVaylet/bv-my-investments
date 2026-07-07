import { useQuery } from '@tanstack/react-query';
import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import type { AllocationDTO, MonthlyStatDTO } from '@bv/shared';
import { api } from '../../lib/api';
import { fmtMoney, fmtPct } from '../../lib/format';
import { useDisplayCurrency } from '../../lib/session';
import { PageHeader } from '../../components/Layout';
import {
  Card,
  CurrencyToggle,
  EmptyState,
  ErrorState,
  ListSkeleton,
  SignedAmount,
} from '../../components/ui';

function AllocationList({ title, slices }: { title: string; slices: AllocationDTO['byPlatform'] }) {
  if (slices.length === 0) return null;
  return (
    <Card>
      <h2 className="mb-2 text-sm font-semibold text-muted">{title}</h2>
      <ul className="space-y-1.5">
        {slices.map((s) => (
          <li key={s.label} className="text-xs">
            <div className="flex justify-between">
              <span>{s.label}</span>
              <span className="tabular-nums text-muted">{fmtPct(s.pct, false)}</span>
            </div>
            <div className="mt-1 h-1 rounded-full bg-surface-2">
              <div
                className="h-1 rounded-full bg-primary"
                style={{ width: `${Math.min(100, s.pct)}%` }}
              />
            </div>
          </li>
        ))}
      </ul>
    </Card>
  );
}

export function StatsPage() {
  const { currency, setCurrency } = useDisplayCurrency();
  const monthly = useQuery({
    queryKey: ['stats', 'monthly', currency],
    queryFn: () => api.get<MonthlyStatDTO[]>(`/stats/monthly?currency=${currency}`),
  });
  const allocation = useQuery({
    queryKey: ['stats', 'allocation', currency],
    queryFn: () => api.get<AllocationDTO>(`/stats/allocation?currency=${currency}`),
  });

  const last12 = (monthly.data ?? []).slice(-12);

  return (
    <div className="space-y-4">
      <PageHeader
        title="Estadísticas"
        right={<CurrencyToggle value={currency} onChange={setCurrency} />}
      />

      {monthly.isLoading && <ListSkeleton rows={3} />}
      {monthly.isError && <ErrorState onRetry={() => monthly.refetch()} />}
      {monthly.data && monthly.data.length === 0 && (
        <EmptyState
          title="Sin datos todavía"
          hint="Cargá operaciones para ver estadísticas mensuales."
        />
      )}

      {last12.length > 0 && (
        <Card>
          <h2 className="mb-2 text-sm font-semibold text-muted">Invertido vs vendido por mes</h2>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={last12} margin={{ top: 4, right: 4, bottom: 0, left: 4 }}>
              <XAxis
                dataKey="month"
                tick={{ fontSize: 9, fill: 'var(--muted)' }}
                tickFormatter={(m: string) => m.slice(2).replace('-', '/')}
                tickLine={false}
                axisLine={false}
              />
              <YAxis hide />
              <Tooltip
                contentStyle={{
                  background: 'var(--surface-2)',
                  border: '1px solid var(--border)',
                  borderRadius: 8,
                  fontSize: 12,
                }}
                formatter={(v: number, name: string) => [
                  fmtMoney(v, currency),
                  name === 'invested' ? 'Invertido' : 'Vendido',
                ]}
              />
              <Bar dataKey="invested" fill="var(--primary)" radius={[3, 3, 0, 0]} />
              <Bar dataKey="sold" fill="var(--ok)" radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </Card>
      )}

      {last12.length > 0 && (
        <Card>
          <h2 className="mb-2 text-sm font-semibold text-muted">Resultado realizado por mes</h2>
          <div className="space-y-1">
            {[...last12].reverse().map((m) => (
              <div
                key={m.month}
                className="flex items-center justify-between border-b border-border py-1.5 text-sm last:border-0"
              >
                <span className="text-muted">{m.month}</span>
                <div className="flex gap-4 tabular-nums">
                  <span className="text-xs text-muted">↓ {fmtMoney(m.invested, currency)}</span>
                  <span className="text-xs text-muted">↑ {fmtMoney(m.sold, currency)}</span>
                  <SignedAmount value={m.result}>{fmtMoney(m.result, currency)}</SignedAmount>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {allocation.data && (
        <>
          <AllocationList title="Por plataforma" slices={allocation.data.byPlatform} />
          <AllocationList title="Por moneda" slices={allocation.data.byCurrency} />
        </>
      )}
    </div>
  );
}
