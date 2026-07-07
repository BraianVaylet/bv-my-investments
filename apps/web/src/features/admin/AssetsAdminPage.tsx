import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Archive, ArchiveRestore, ChevronLeft, Pencil, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import type { AssetDTO, MasterDTO } from '@bv/shared';
import { api, ApiError } from '../../lib/api';
import { PageHeader } from '../../components/Layout';
import {
  Badge,
  Button,
  Card,
  EmptyState,
  ErrorState,
  Field,
  IconButton,
  Input,
  ListSkeleton,
  Modal,
  Select,
} from '../../components/ui';

interface AssetForm {
  ticker: string;
  name: string;
  instrumentTypeId: string;
  quoteCurrencyId: string;
  cedearRatio: string;
  providerSymbols: Record<string, string>;
}

const emptyForm: AssetForm = {
  ticker: '',
  name: '',
  instrumentTypeId: '',
  quoteCurrencyId: '',
  cedearRatio: '',
  providerSymbols: {},
};

const PROVIDER_FIELDS = [
  { key: 'data912', hint: 'ticker BYMA/US (ej. AMZN)' },
  { key: 'coingecko', hint: 'id CoinGecko (ej. bitcoin)' },
  { key: 'binance', hint: 'par (ej. BTCUSDT)' },
  { key: 'criptoya', hint: 'coin (ej. btc)' },
  { key: 'yahoo', hint: 'símbolo Yahoo (ej. AMZN.BA)' },
  { key: 'argentinadatos', hint: 'FCI: tipo:nombre (ej. mercadoDinero:Fima Premium)' },
];

export function AssetsAdminPage() {
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const [editing, setEditing] = useState<AssetDTO | null>(null);
  const [creating, setCreating] = useState(false);
  const [deleting, setDeleting] = useState<AssetDTO | null>(null);
  const [form, setForm] = useState<AssetForm>(emptyForm);

  const query = useQuery({
    queryKey: ['assets', 'admin', search],
    queryFn: () =>
      api.get<AssetDTO[]>(
        `/assets?includeArchived=true${search ? `&search=${encodeURIComponent(search)}` : ''}`,
      ),
  });
  const types = useQuery({
    queryKey: ['instrument-types'],
    queryFn: () => api.get<MasterDTO[]>('/instrument-types'),
  });
  const currencies = useQuery({
    queryKey: ['currencies'],
    queryFn: () => api.get<MasterDTO[]>('/currencies'),
  });

  const invalidate = () => void qc.invalidateQueries({ queryKey: ['assets'] });

  const save = useMutation({
    mutationFn: () => {
      const body = {
        ticker: form.ticker,
        name: form.name,
        instrumentTypeId: form.instrumentTypeId,
        quoteCurrencyId: form.quoteCurrencyId,
        cedearRatio: form.cedearRatio ? Number(form.cedearRatio) : null,
        providerSymbols: Object.fromEntries(
          Object.entries(form.providerSymbols).filter(([, v]) => v.trim() !== ''),
        ),
      };
      return editing ? api.put(`/assets/${editing.id}`, body) : api.post('/assets', body);
    },
    onSuccess: () => {
      invalidate();
      closeForm();
    },
  });
  const toggleArchive = useMutation({
    mutationFn: (a: AssetDTO) =>
      api.patch(`/assets/${a.id}/${a.archived ? 'unarchive' : 'archive'}`),
    onSuccess: invalidate,
  });
  const remove = useMutation({
    mutationFn: (id: string) => api.del(`/assets/${id}`),
    onSuccess: () => {
      invalidate();
      setDeleting(null);
    },
  });

  const closeForm = () => {
    setCreating(false);
    setEditing(null);
    setForm(emptyForm);
    save.reset();
  };

  const openEdit = (a: AssetDTO) => {
    setEditing(a);
    setForm({
      ticker: a.ticker,
      name: a.name,
      instrumentTypeId: a.instrumentTypeId,
      quoteCurrencyId: a.quoteCurrencyId,
      cedearRatio: a.cedearRatio ? String(a.cedearRatio) : '',
      providerSymbols: Object.fromEntries(
        Object.entries(a.providerSymbols).filter(([, v]) => v !== undefined),
      ) as Record<string, string>,
    });
  };

  return (
    <div>
      <PageHeader
        title="Activos"
        back={
          <Link to="/more" className="text-muted hover:text-fg" aria-label="Volver">
            <ChevronLeft size={22} />
          </Link>
        }
        right={<Button onClick={() => setCreating(true)}>Agregar</Button>}
      />

      <Input
        placeholder="Buscar por ticker o nombre…"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="mb-4"
      />

      {query.isLoading && <ListSkeleton rows={4} />}
      {query.isError && <ErrorState onRetry={() => query.refetch()} />}
      {query.data && query.data.length === 0 && (
        <EmptyState
          title="Sin activos"
          hint="Creá activos (BTC, GOOGL, AL30…) para poder registrar operaciones."
          action={<Button onClick={() => setCreating(true)}>Agregar activo</Button>}
        />
      )}
      {query.data && query.data.length > 0 && (
        <div className="space-y-2">
          {query.data.map((a) => (
            <Card key={a.id} className="flex items-center justify-between py-2 pr-2">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold">{a.ticker}</span>
                  <Badge>
                    {a.instrumentTypeEmoji ? `${a.instrumentTypeEmoji} ` : ''}
                    {a.instrumentTypeName}
                  </Badge>
                  {a.archived && <Badge tone="warning">archivado</Badge>}
                </div>
                <p className="text-xs text-muted">
                  {a.name} · cotiza en {a.quoteCurrencyCode}
                  {a.cedearRatio ? ` · ratio ${a.cedearRatio}:1` : ''}
                </p>
              </div>
              <div className="flex items-center">
                <IconButton label="Editar" tone="primary" onClick={() => openEdit(a)}>
                  <Pencil size={16} />
                </IconButton>
                <IconButton
                  label={a.archived ? 'Desarchivar' : 'Archivar'}
                  onClick={() => toggleArchive.mutate(a)}
                >
                  {a.archived ? <ArchiveRestore size={16} /> : <Archive size={16} />}
                </IconButton>
                <IconButton label="Borrar" tone="danger" onClick={() => setDeleting(a)}>
                  <Trash2 size={16} />
                </IconButton>
              </div>
            </Card>
          ))}
        </div>
      )}

      <Modal
        open={creating || Boolean(editing)}
        onClose={closeForm}
        title={editing ? `Editar ${editing.ticker}` : 'Nuevo activo'}
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            save.mutate();
          }}
          className="space-y-4"
        >
          <div className="grid grid-cols-2 gap-3">
            <Field label="Ticker">
              <Input
                value={form.ticker}
                onChange={(e) => setForm((f) => ({ ...f, ticker: e.target.value.toUpperCase() }))}
                required
              />
            </Field>
            <Field label="Nombre">
              <Input
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                required
              />
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Tipo de instrumento">
              <Select
                value={form.instrumentTypeId}
                onChange={(e) => setForm((f) => ({ ...f, instrumentTypeId: e.target.value }))}
                required
              >
                <option value="">Tipo…</option>
                {(types.data ?? []).map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.emoji ? `${t.emoji} ` : ''}
                    {t.name}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Moneda de cotización">
              <Select
                value={form.quoteCurrencyId}
                onChange={(e) => setForm((f) => ({ ...f, quoteCurrencyId: e.target.value }))}
                required
              >
                <option value="">Moneda…</option>
                {(currencies.data ?? []).map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.emoji ? `${c.emoji} ` : ''}
                    {c.code}
                  </option>
                ))}
              </Select>
            </Field>
          </div>
          {/* el ratio solo aplica a tipos que lo declaran (ej. CEDEAR) */}
          {(types.data ?? []).find((t) => t.id === form.instrumentTypeId)?.hasRatio && (
            <Field label="Ratio de conversión (ej. 144 para AMZN 144:1)">
              <Input
                type="number"
                step="any"
                inputMode="decimal"
                value={form.cedearRatio}
                onChange={(e) => setForm((f) => ({ ...f, cedearRatio: e.target.value }))}
                required
              />
            </Field>
          )}

          <details className="rounded-lg border border-border p-3">
            <summary className="cursor-pointer text-xs font-medium text-muted">
              Símbolos por proveedor (opcional; por defecto se usa el ticker)
            </summary>
            <div className="mt-3 space-y-3">
              {PROVIDER_FIELDS.map((p) => (
                <Field key={p.key} label={`${p.key} — ${p.hint}`}>
                  <Input
                    value={form.providerSymbols[p.key] ?? ''}
                    onChange={(e) =>
                      setForm((f) => ({
                        ...f,
                        providerSymbols: { ...f.providerSymbols, [p.key]: e.target.value },
                      }))
                    }
                  />
                </Field>
              ))}
            </div>
          </details>

          {save.error && (
            <p className="text-sm text-danger">
              {save.error instanceof ApiError ? save.error.message : 'No se pudo guardar'}
            </p>
          )}
          <Button type="submit" className="w-full" disabled={save.isPending}>
            {save.isPending ? 'Guardando…' : 'Guardar'}
          </Button>
        </form>
      </Modal>

      <Modal
        open={Boolean(deleting)}
        onClose={() => {
          setDeleting(null);
          remove.reset();
        }}
        title="Borrar activo"
      >
        <p className="text-sm text-muted">¿Borrar {deleting?.ticker}?</p>
        {remove.error instanceof ApiError && (
          <div className="mt-3 rounded-lg border border-warning/40 bg-warning/10 p-3 text-xs text-warning">
            {remove.error.message}
          </div>
        )}
        <div className="mt-4 flex gap-2">
          <Button
            variant="secondary"
            className="flex-1"
            onClick={() => {
              setDeleting(null);
              remove.reset();
            }}
          >
            Cancelar
          </Button>
          {remove.error instanceof ApiError && remove.error.code === 'IN_USE' && deleting ? (
            <Button
              className="flex-1"
              onClick={() => {
                toggleArchive.mutate(deleting);
                setDeleting(null);
                remove.reset();
              }}
            >
              Archivar en su lugar
            </Button>
          ) : (
            <Button
              variant="danger"
              className="flex-1"
              disabled={remove.isPending}
              onClick={() => deleting && remove.mutate(deleting.id)}
            >
              {remove.isPending ? 'Borrando…' : 'Borrar'}
            </Button>
          )}
        </div>
      </Modal>
    </div>
  );
}
