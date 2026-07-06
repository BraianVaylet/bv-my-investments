import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import type { AssetDTO, MasterDTO, OperationDTO, PaginatedDTO } from '@bv/shared';
import { api, ApiError } from '../../lib/api';
import { fmtDate, fmtMoney, fmtPct, fmtUnits } from '../../lib/format';
import { PageHeader } from '../../components/Layout';
import {
  Badge,
  Button,
  Card,
  EmptyState,
  ErrorState,
  ListSkeleton,
  Modal,
  Select,
  SignedAmount,
} from '../../components/ui';
import { OperationFormModal } from './OperationForm';

interface Filters {
  type?: 'buy' | 'sell';
  assetId?: string;
  platformId?: string;
}

export function OperationsPage() {
  const qc = useQueryClient();
  const [filters, setFilters] = useState<Filters>({});
  const [page, setPage] = useState(1);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<OperationDTO | null>(null);
  const [deleting, setDeleting] = useState<OperationDTO | null>(null);

  const params = new URLSearchParams({ page: String(page), limit: '20' });
  if (filters.type) params.set('type', filters.type);
  if (filters.assetId) params.set('assetId', filters.assetId);
  if (filters.platformId) params.set('platformId', filters.platformId);

  const query = useQuery({
    queryKey: ['operations', filters, page],
    queryFn: () => api.get<PaginatedDTO<OperationDTO>>(`/operations?${params}`),
  });
  const assets = useQuery({
    queryKey: ['assets'],
    queryFn: () => api.get<AssetDTO[]>('/assets?includeArchived=true'),
  });
  const platforms = useQuery({
    queryKey: ['platforms'],
    queryFn: () => api.get<MasterDTO[]>('/platforms?includeArchived=true'),
  });

  const remove = useMutation({
    mutationFn: (id: string) => api.del(`/operations/${id}`),
    onSuccess: () => {
      setDeleting(null);
      void qc.invalidateQueries({ queryKey: ['operations'] });
      void qc.invalidateQueries({ queryKey: ['portfolio'] });
      void qc.invalidateQueries({ queryKey: ['stats'] });
    },
  });

  const totalPages = query.data ? Math.max(1, Math.ceil(query.data.total / query.data.limit)) : 1;

  const setFilter = (patch: Filters) => {
    setFilters((f) => ({ ...f, ...patch }));
    setPage(1);
  };

  return (
    <div>
      <PageHeader title="Operaciones" />

      <div className="mb-4 grid grid-cols-3 gap-2">
        <Select
          value={filters.type ?? ''}
          onChange={(e) => setFilter({ type: (e.target.value || undefined) as Filters['type'] })}
        >
          <option value="">Todas</option>
          <option value="buy">Compras</option>
          <option value="sell">Ventas</option>
        </Select>
        <Select
          value={filters.assetId ?? ''}
          onChange={(e) => setFilter({ assetId: e.target.value || undefined })}
        >
          <option value="">Activo</option>
          {(assets.data ?? []).map((a) => (
            <option key={a.id} value={a.id}>
              {a.ticker}
            </option>
          ))}
        </Select>
        <Select
          value={filters.platformId ?? ''}
          onChange={(e) => setFilter({ platformId: e.target.value || undefined })}
        >
          <option value="">Plataforma</option>
          {(platforms.data ?? []).map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </Select>
      </div>

      {query.isLoading && <ListSkeleton rows={5} />}
      {query.isError && <ErrorState onRetry={() => query.refetch()} />}
      {query.data && query.data.items.length === 0 && (
        <EmptyState
          title="Sin operaciones"
          hint="Registrá tu primera compra con el botón +"
          action={<Button onClick={() => setFormOpen(true)}>Nueva operación</Button>}
        />
      )}

      {query.data && query.data.items.length > 0 && (
        <div className="space-y-2">
          {query.data.items.map((op) => (
            <Card key={op.id} className="py-3">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-semibold">{op.assetTicker}</span>
                    <Badge tone={op.type === 'buy' ? 'positive' : 'negative'}>
                      {op.type === 'buy' ? 'Compra' : 'Venta'}
                    </Badge>
                  </div>
                  <p className="mt-0.5 text-xs text-muted">
                    {fmtDate(op.date)} · {op.platformName}
                    {op.createdByName ? ` · ${op.createdByName}` : ''}
                  </p>
                  {op.type === 'sell' && op.realized !== undefined && (
                    <p className="mt-0.5 text-xs">
                      Resultado:{' '}
                      <SignedAmount value={op.realized}>
                        {fmtMoney(op.realized, op.currencyCode)} ({fmtPct(op.realizedPct)})
                      </SignedAmount>
                    </p>
                  )}
                </div>
                <div className="text-right">
                  <p className="text-xs tabular-nums text-muted">
                    {fmtUnits(op.units)} × {fmtMoney(op.unitPrice, op.currencyCode)}
                  </p>
                  <p className="font-semibold tabular-nums">
                    {fmtMoney(op.total, op.currencyCode)}
                  </p>
                  <div className="mt-1 flex justify-end gap-3 text-xs">
                    <button
                      className="text-primary"
                      onClick={() => {
                        setEditing(op);
                        setFormOpen(true);
                      }}
                    >
                      Editar
                    </button>
                    <button className="text-negative" onClick={() => setDeleting(op)}>
                      Borrar
                    </button>
                  </div>
                </div>
              </div>
              {op.notes && <p className="mt-2 text-xs italic text-muted">{op.notes}</p>}
            </Card>
          ))}

          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-4 pt-2 text-sm">
              <Button
                variant="secondary"
                disabled={page <= 1}
                onClick={() => setPage((p) => p - 1)}
              >
                Anterior
              </Button>
              <span className="text-muted">
                {page} / {totalPages}
              </span>
              <Button
                variant="secondary"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => p + 1)}
              >
                Siguiente
              </Button>
            </div>
          )}
        </div>
      )}

      {/* FAB (doc 01 §9) */}
      <button
        onClick={() => {
          setEditing(null);
          setFormOpen(true);
        }}
        aria-label="Nueva operación"
        className="fixed bottom-20 right-4 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-primary text-white shadow-lg transition-colors hover:bg-primary-hover"
      >
        <svg
          width="26"
          height="26"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        >
          <path d="M12 5v14M5 12h14" />
        </svg>
      </button>

      <OperationFormModal
        open={formOpen}
        onClose={() => {
          setFormOpen(false);
          setEditing(null);
        }}
        editing={editing}
      />

      <Modal open={Boolean(deleting)} onClose={() => setDeleting(null)} title="Borrar operación">
        <p className="text-sm text-muted">
          ¿Borrar la {deleting?.type === 'buy' ? 'compra' : 'venta'} de {deleting?.assetTicker} del{' '}
          {deleting ? fmtDate(deleting.date) : ''}? Todo lo derivado se recalcula.
        </p>
        {remove.error && (
          <p className="mt-2 text-sm text-negative">
            {remove.error instanceof ApiError ? remove.error.message : 'No se pudo borrar'}
          </p>
        )}
        <div className="mt-4 flex gap-2">
          <Button variant="secondary" className="flex-1" onClick={() => setDeleting(null)}>
            Cancelar
          </Button>
          <Button
            variant="danger"
            className="flex-1"
            disabled={remove.isPending}
            onClick={() => deleting && remove.mutate(deleting.id)}
          >
            {remove.isPending ? 'Borrando…' : 'Borrar'}
          </Button>
        </div>
      </Modal>
    </div>
  );
}
