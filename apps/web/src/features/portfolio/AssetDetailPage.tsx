import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useParams } from 'react-router-dom';
import {
  Line,
  LineChart,
  ReferenceDot,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { AssetDetailDTO, OperationDTO } from '@bv/shared';
import { api } from '../../lib/api';
import { fmtDate, fmtMoney, fmtPct, fmtUnits, timeAgo } from '../../lib/format';
import { PageHeader } from '../../components/Layout';
import { Badge, Button, Card, ErrorState, ListSkeleton, SignedAmount } from '../../components/ui';

interface PriceHistoryDTO {
  points: { date: string; price: number }[];
  provider: string | null;
  currency: string | null;
}

/** RF-7.3: precio histórico con marcas de mis compras/ventas. */
function PriceHistoryChart({
  history,
  operations,
}: {
  history: PriceHistoryDTO;
  operations: OperationDTO[];
}) {
  const { points } = history;
  if (points.length < 2) return null;
  const dates = points.map((p) => p.date);

  // Snap de cada operación al punto más cercano del histórico (para ubicar el dot)
  const marks = operations
    .map((op) => {
      const day = op.date.slice(0, 10);
      if (day < dates[0]! || day > dates[dates.length - 1]!) return null;
      let nearest = dates[0]!;
      for (const d of dates) {
        if (d <= day) nearest = d;
        else break;
      }
      return { date: nearest, type: op.type, price: op.unitPrice };
    })
    .filter((m): m is { date: string; type: 'buy' | 'sell'; price: number } => m !== null);

  return (
    <Card className="mb-4">
      <h2 className="mb-2 text-sm font-semibold text-muted">
        Último año{history.provider ? ` · ${history.provider}` : ''}
      </h2>
      <ResponsiveContainer width="100%" height={180}>
        <LineChart data={points} margin={{ top: 8, right: 8, bottom: 0, left: 8 }}>
          <XAxis
            dataKey="date"
            tick={{ fontSize: 9, fill: '#8b93a7' }}
            tickFormatter={(d: string) => d.slice(5)}
            minTickGap={40}
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
            formatter={(v: number) => [fmtMoney(v, history.currency ?? undefined), 'Precio']}
          />
          <Line type="monotone" dataKey="price" stroke="#4f7cff" strokeWidth={2} dot={false} />
          {marks.map((m, i) => (
            <ReferenceDot
              key={i}
              x={m.date}
              y={m.price}
              r={5}
              fill={m.type === 'buy' ? '#34d399' : '#f87171'}
              stroke="#0b0e14"
              strokeWidth={2}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
      <div className="mt-1 flex justify-center gap-4 text-[10px] text-muted">
        <span className="flex items-center gap-1">
          <span className="inline-block h-2 w-2 rounded-full bg-positive" /> compra
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block h-2 w-2 rounded-full bg-negative" /> venta
        </span>
      </div>
    </Card>
  );
}

/** Barra visual del rango 52 semanas (glosario doc 01 §5). */
function Range52w({ low, high, price }: { low: number; high: number; price: number }) {
  const pct = high > low ? Math.min(100, Math.max(0, ((price - low) / (high - low)) * 100)) : 50;
  return (
    <div>
      <div className="relative h-1.5 rounded-full bg-surface-2">
        <div className="absolute h-1.5 rounded-full bg-primary/40" style={{ width: `${pct}%` }} />
        <div
          className="absolute top-1/2 h-3 w-3 -translate-y-1/2 rounded-full border-2 border-bg bg-primary"
          style={{ left: `calc(${pct}% - 6px)` }}
        />
      </div>
      <div className="mt-1 flex justify-between text-[10px] text-muted">
        <span>{fmtMoney(low)}</span>
        <span>52 semanas</span>
        <span>{fmtMoney(high)}</span>
      </div>
    </div>
  );
}

export function AssetDetailPage() {
  const { id } = useParams<{ id: string }>();
  const qc = useQueryClient();
  const query = useQuery({
    queryKey: ['assets', id],
    queryFn: () => api.get<AssetDetailDTO>(`/assets/${id}`),
    enabled: Boolean(id),
  });

  const refresh = useMutation({
    mutationFn: () => api.post(`/quotes/refresh?assetId=${id}`),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['assets', id] }),
  });

  const history = useQuery({
    queryKey: ['assets', id, 'price-history'],
    queryFn: () => api.get<PriceHistoryDTO>(`/assets/${id}/price-history`),
    enabled: Boolean(id),
    staleTime: 60 * 60 * 1000, // dato lento: 1 h
  });

  if (query.isLoading) return <ListSkeleton rows={4} />;
  if (query.isError || !query.data) return <ErrorState onRetry={() => query.refetch()} />;

  const asset = query.data;
  const p = asset.position;
  const quote = p?.quote ?? null;

  return (
    <div>
      <PageHeader
        title={asset.ticker}
        back={
          <Link to="/portfolio" className="text-muted hover:text-text" aria-label="Volver">
            <svg
              width="22"
              height="22"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path d="M15 18l-6-6 6-6" />
            </svg>
          </Link>
        }
        right={
          <Button variant="secondary" onClick={() => refresh.mutate()} disabled={refresh.isPending}>
            {refresh.isPending ? 'Actualizando…' : 'Actualizar'}
          </Button>
        }
      />
      <p className="-mt-3 mb-4 text-sm text-muted">
        {asset.name} · <Badge>{asset.instrumentTypeName}</Badge>
        {asset.archived && <Badge tone="warning">archivado</Badge>}
      </p>

      <Card className="mb-4">
        {quote ? (
          <>
            <div className="flex items-end justify-between">
              <div>
                <p className="text-2xl font-bold tabular-nums">
                  {fmtMoney(quote.price, quote.currency)}
                </p>
                <p className="text-xs text-muted">
                  {quote.provider} · {timeAgo(quote.fetchedAt)}
                  {quote.stale ? ' · desactualizado' : ''}
                </p>
              </div>
              {quote.changePct !== undefined && quote.changePct !== null && (
                <SignedAmount value={quote.changePct}>{fmtPct(quote.changePct)}</SignedAmount>
              )}
            </div>
            {quote.low52 !== undefined &&
              quote.high52 !== undefined &&
              quote.low52 !== null &&
              quote.high52 !== null && (
                <div className="mt-4">
                  <Range52w low={quote.low52} high={quote.high52} price={quote.price} />
                </div>
              )}
          </>
        ) : (
          <p className="text-sm text-muted">Sin cotización disponible</p>
        )}
      </Card>

      {history.data && <PriceHistoryChart history={history.data} operations={asset.operations} />}

      {p && (
        <Card className="mb-4">
          <h2 className="mb-3 text-sm font-semibold text-muted">Mi posición</h2>
          <dl className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <dt className="text-xs text-muted">Tenencia</dt>
              <dd className="font-medium tabular-nums">{fmtUnits(p.units)}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted">PPC</dt>
              <dd className="font-medium tabular-nums">{fmtMoney(p.avgCost, p.opCurrency)}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted">Valor actual</dt>
              <dd className="font-medium tabular-nums">{fmtMoney(p.value, 'ARS')}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted">No realizado</dt>
              <dd>
                <SignedAmount value={p.unrealized}>
                  {fmtMoney(p.unrealized, 'ARS')} ({fmtPct(p.unrealizedPct)})
                </SignedAmount>
              </dd>
            </div>
            <div>
              <dt className="text-xs text-muted">Realizado</dt>
              <dd>
                <SignedAmount value={p.realized}>{fmtMoney(p.realized, 'ARS')}</SignedAmount>
              </dd>
            </div>
          </dl>
        </Card>
      )}

      <section>
        <h2 className="mb-2 text-sm font-semibold text-muted">Operaciones</h2>
        {asset.operations.length === 0 ? (
          <p className="text-sm text-muted">Sin operaciones para este activo.</p>
        ) : (
          <div className="space-y-2">
            {asset.operations.map((op) => (
              <Card key={op.id} className="flex items-center justify-between py-3">
                <div>
                  <Badge tone={op.type === 'buy' ? 'positive' : 'negative'}>
                    {op.type === 'buy' ? 'Compra' : 'Venta'}
                  </Badge>
                  <p className="mt-1 text-xs text-muted">
                    {fmtDate(op.date)} · {op.platformName}
                  </p>
                </div>
                <div className="text-right text-sm">
                  <p className="tabular-nums">
                    {fmtUnits(op.units)} × {fmtMoney(op.unitPrice, op.currencyCode)}
                  </p>
                  <p className="font-medium tabular-nums">{fmtMoney(op.total, op.currencyCode)}</p>
                </div>
              </Card>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
