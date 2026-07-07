import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import type { ClosedPositionDTO, FxDTO, PositionDTO } from '@bv/shared';
import { api } from '../../lib/api';
import { fmtMoney, fmtPct, fmtUnits, timeAgo } from '../../lib/format';
import { useDisplayCurrency } from '../../lib/session';
import { PageHeader } from '../../components/Layout';
import {
  Badge,
  Card,
  CurrencyToggle,
  EmptyState,
  ErrorState,
  ListSkeleton,
  SignedAmount,
} from '../../components/ui';

export function PositionCard({ p, currency }: { p: PositionDTO; currency: string }) {
  return (
    <Link to={`/assets/${p.assetId}`} className="block">
      <Card className="transition-colors hover:border-muted">
        <div className="flex items-start justify-between gap-2">
          <div>
            <div className="flex items-center gap-2">
              <span className="font-semibold">{p.ticker}</span>
              <Badge>
                {p.instrumentTypeEmoji ? `${p.instrumentTypeEmoji} ` : ''}
                {p.instrumentTypeName}
              </Badge>
              {p.quote?.stale && <Badge tone="warning">dato viejo</Badge>}
            </div>
            <p className="mt-0.5 text-xs text-muted">
              {fmtUnits(p.units)} u. · PPC {fmtMoney(p.avgCost, p.opCurrency)}
            </p>
          </div>
          <div className="text-right">
            <p className="font-semibold tabular-nums">{fmtMoney(p.value, currency)}</p>
            <p className="text-xs">
              <SignedAmount value={p.unrealized}>
                {fmtMoney(p.unrealized, currency)} ({fmtPct(p.unrealizedPct)})
              </SignedAmount>
            </p>
          </div>
        </div>
        <div className="mt-2 flex items-center justify-between text-xs text-muted">
          <span>
            {p.quote
              ? `${fmtMoney(p.quote.price, p.quote.currency)} · ${p.quote.provider} · ${timeAgo(p.quote.fetchedAt)}`
              : 'Sin cotización'}
          </span>
          {p.quote?.changePct !== undefined && p.quote.changePct !== null && (
            <SignedAmount value={p.quote.changePct}>{fmtPct(p.quote.changePct)}</SignedAmount>
          )}
        </div>
      </Card>
    </Link>
  );
}

export function PortfolioPage() {
  const { currency, setCurrency } = useDisplayCurrency();
  const query = useQuery({
    queryKey: ['portfolio', currency],
    queryFn: () =>
      api.get<{ currency: string; positions: PositionDTO[]; fx: FxDTO | null }>(
        `/portfolio?currency=${currency}`,
      ),
  });
  const closed = useQuery({
    queryKey: ['portfolio', 'closed', currency],
    queryFn: () => api.get<ClosedPositionDTO[]>(`/portfolio/closed?currency=${currency}`),
  });

  return (
    <div>
      <PageHeader
        title="Portafolio"
        right={<CurrencyToggle value={currency} onChange={setCurrency} />}
      />

      {query.isLoading && <ListSkeleton rows={4} />}
      {query.isError && <ErrorState onRetry={() => query.refetch()} />}
      {query.data && query.data.positions.length === 0 && (
        <EmptyState
          title="Sin posiciones abiertas"
          hint="Cargá tu primera compra desde Operaciones."
        />
      )}
      {query.data && query.data.positions.length > 0 && (
        <div className="space-y-2">
          {query.data.positions.map((p) => (
            <PositionCard key={p.assetId} p={p} currency={currency} />
          ))}
          {query.data.fx && (
            <p className="pt-1 text-center text-xs text-muted">
              Dólar {query.data.fx.kind.toUpperCase()} {fmtMoney(query.data.fx.value, 'ARS')} ·{' '}
              {timeAgo(query.data.fx.fetchedAt)}
              {query.data.fx.stale ? ' · desactualizado' : ''}
            </p>
          )}
        </div>
      )}

      {closed.data && closed.data.length > 0 && (
        <section className="mt-8">
          <h2 className="mb-2 text-sm font-semibold text-muted">Posiciones cerradas</h2>
          <div className="space-y-2">
            {closed.data.map((c) => (
              <Link key={c.assetId} to={`/assets/${c.assetId}`} className="block">
                <Card className="flex items-center justify-between py-3">
                  <div>
                    <span className="text-sm font-semibold">{c.ticker}</span>
                    <p className="text-xs text-muted">
                      {fmtUnits(c.totalSold)} u. vendidas · {c.instrumentTypeName}
                    </p>
                  </div>
                  <SignedAmount value={c.realized}>{fmtMoney(c.realized, currency)}</SignedAmount>
                </Card>
              </Link>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
