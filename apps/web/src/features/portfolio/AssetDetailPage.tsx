import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ChevronLeft, Plus, RefreshCw, Trash2 } from 'lucide-react';
import { useState } from 'react';
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
import type { AssetDetailDTO, CorporateEventDTO, OperationDTO } from '@bv/shared';
import { api, ApiError } from '../../lib/api';
import {
  fmtDate,
  fmtMoney,
  fmtNumber,
  fmtPct,
  fmtUnits,
  timeAgo,
  toInputDate,
} from '../../lib/format';
import { PageHeader } from '../../components/Layout';
import {
  Badge,
  Button,
  Card,
  ErrorState,
  Field,
  IconButton,
  Input,
  ListSkeleton,
  Modal,
  Select,
  SignedAmount,
} from '../../components/ui';

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
            tick={{ fontSize: 9, fill: 'var(--muted)' }}
            tickFormatter={(d: string) => d.slice(5)}
            minTickGap={40}
            tickLine={false}
            axisLine={false}
          />
          <YAxis hide domain={['auto', 'auto']} />
          <Tooltip
            contentStyle={{
              background: 'var(--surface-2)',
              border: '1px solid var(--border)',
              borderRadius: 8,
              fontSize: 12,
            }}
            formatter={(v: number) => [fmtMoney(v, history.currency ?? undefined), 'Precio']}
          />
          <Line
            type="monotone"
            dataKey="price"
            stroke="var(--primary)"
            strokeWidth={2}
            dot={false}
          />
          {marks.map((m, i) => (
            <ReferenceDot
              key={i}
              x={m.date}
              y={m.price}
              r={5}
              fill={m.type === 'buy' ? 'var(--ok)' : 'var(--danger)'}
              stroke="var(--bg)"
              strokeWidth={2}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
      <div className="mt-1 flex justify-center gap-4 text-[10px] text-muted">
        <span className="flex items-center gap-1">
          <span className="inline-block h-2 w-2 rounded-full bg-ok" /> compra
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block h-2 w-2 rounded-full bg-danger" /> venta
        </span>
      </div>
    </Card>
  );
}

/**
 * Eventos corporativos (RB-09): splits y cambios de ratio de CEDEAR.
 * El factor multiplica unidades y divide el PPC desde la fecha; las métricas
 * (invertido, realizado) no se distorsionan.
 */
function CorporateEventsSection({
  assetId,
  events,
}: {
  assetId: string;
  events: CorporateEventDTO[];
}) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    type: 'split' as 'split' | 'ratio-change',
    date: toInputDate(),
    factor: '',
    notes: '',
  });

  const invalidate = () => {
    void qc.invalidateQueries({ queryKey: ['assets'] });
    void qc.invalidateQueries({ queryKey: ['portfolio'] });
    void qc.invalidateQueries({ queryKey: ['stats'] });
  };

  const create = useMutation({
    mutationFn: () =>
      api.post('/corporate-events', {
        assetId,
        type: form.type,
        date: new Date(`${form.date}T12:00:00Z`).toISOString(),
        factor: Number(form.factor),
        notes: form.notes || undefined,
      }),
    onSuccess: () => {
      invalidate();
      setOpen(false);
      setForm({ type: 'split', date: toInputDate(), factor: '', notes: '' });
      create.reset();
    },
  });
  const remove = useMutation({
    mutationFn: (id: string) => api.del(`/corporate-events/${id}`),
    onSuccess: invalidate,
  });

  return (
    <section className="mb-4">
      <div className="mb-2 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-muted">Eventos corporativos</h2>
        <IconButton label="Agregar evento corporativo" tone="primary" onClick={() => setOpen(true)}>
          <Plus size={18} />
        </IconButton>
      </div>
      {events.length === 0 ? (
        <p className="text-xs text-dim">
          Sin eventos. Registrá acá splits o cambios de ratio para que el PPC y la tenencia se
          ajusten sin tocar tus operaciones.
        </p>
      ) : (
        <div className="space-y-2">
          {events.map((ev) => (
            <Card key={ev.id} className="flex items-center justify-between py-3">
              <div>
                <Badge tone="primary">
                  {ev.type === 'split' ? 'Split' : 'Cambio de ratio'} × {fmtNumber(ev.factor, 4)}
                </Badge>
                <p className="mt-1 text-xs text-muted">
                  {fmtDate(ev.date)}
                  {ev.notes ? ` · ${ev.notes}` : ''}
                </p>
              </div>
              <IconButton
                label="Borrar evento"
                tone="danger"
                onClick={() => remove.mutate(ev.id)}
                disabled={remove.isPending}
              >
                <Trash2 size={16} />
              </IconButton>
            </Card>
          ))}
        </div>
      )}
      {remove.error && (
        <p className="mt-2 text-xs text-danger">
          {remove.error instanceof ApiError ? remove.error.message : 'No se pudo borrar'}
        </p>
      )}

      <Modal open={open} onClose={() => setOpen(false)} title="Nuevo evento corporativo">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            create.mutate();
          }}
          className="space-y-4"
        >
          <Field label="Tipo">
            <Select
              value={form.type}
              onChange={(e) => setForm({ ...form, type: e.target.value as typeof form.type })}
            >
              <option value="split">Split / split inverso</option>
              <option value="ratio-change">Cambio de ratio (CEDEAR)</option>
            </Select>
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Fecha">
              <Input
                type="date"
                value={form.date}
                onChange={(e) => setForm({ ...form, date: e.target.value })}
                required
              />
            </Field>
            <Field label="Factor">
              <Input
                type="number"
                step="any"
                inputMode="decimal"
                placeholder="Ej: 3"
                value={form.factor}
                onChange={(e) => setForm({ ...form, factor: e.target.value })}
                required
              />
            </Field>
          </div>
          <p className="rounded-lg bg-surface-2 px-3 py-2 text-xs text-muted">
            El factor multiplica tus unidades y divide el PPC desde la fecha. Split 3:1 → 3. Split
            inverso 1:10 → 0,1. Ratio CEDEAR 10:1 → 20:1 → factor 2.
          </p>
          <Field label="Nota (opcional)">
            <Input
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              placeholder="Ej: split anunciado por la empresa"
            />
          </Field>
          {create.error && (
            <p className="text-sm text-danger">
              {create.error instanceof ApiError ? create.error.message : 'No se pudo guardar'}
            </p>
          )}
          <Button type="submit" className="w-full" disabled={create.isPending}>
            {create.isPending ? 'Guardando…' : 'Registrar evento'}
          </Button>
        </form>
      </Modal>
    </section>
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
          <Link to="/portfolio" className="text-muted hover:text-fg" aria-label="Volver">
            <ChevronLeft size={22} />
          </Link>
        }
        right={
          <IconButton
            label="Actualizar cotización"
            onClick={() => refresh.mutate()}
            disabled={refresh.isPending}
          >
            <RefreshCw size={18} className={refresh.isPending ? 'animate-spin' : ''} />
          </IconButton>
        }
      />
      <p className="-mt-3 mb-4 text-sm text-muted">
        {asset.name} ·{' '}
        <Badge>
          {asset.instrumentTypeEmoji ? `${asset.instrumentTypeEmoji} ` : ''}
          {asset.instrumentTypeName}
        </Badge>
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

      <CorporateEventsSection assetId={asset.id} events={asset.corporateEvents ?? []} />

      <section>
        <h2 className="mb-2 text-sm font-semibold text-muted">Operaciones</h2>
        {asset.operations.length === 0 ? (
          <p className="text-sm text-muted">Sin operaciones para este activo.</p>
        ) : (
          <div className="space-y-2">
            {asset.operations.map((op) => (
              <Card key={op.id} className="flex items-center justify-between py-3">
                <div>
                  <Badge tone={op.type === 'buy' ? 'ok' : 'danger'}>
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
