import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { BellOff, BellRing, ChevronLeft, Pencil, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import type { AssetDTO, SignalRuleDTO } from '@bv/shared';
import { api, ApiError } from '../../lib/api';
import { fmtNumber } from '../../lib/format';
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
  NumericInput,
  Select,
} from '../../components/ui';

interface RuleForm {
  name: string;
  description: string;
  nature: 'buy' | 'sell';
  scope: 'global' | 'asset';
  assetId: string;
  thresholdType: 'percent' | 'price';
  direction: 'above' | 'below';
  value: string;
  currency: 'ARS' | 'USD';
}

const emptyForm: RuleForm = {
  name: '',
  description: '',
  nature: 'buy',
  scope: 'global',
  assetId: '',
  thresholdType: 'percent',
  direction: 'below',
  value: '',
  currency: 'USD',
};

function ruleSummary(r: SignalRuleDTO): string {
  const target = r.scope === 'global' ? 'Todas las posiciones' : (r.assetTicker ?? 'Un activo');
  const metric = r.thresholdType === 'percent' ? 'rendimiento vs PPC' : `precio en ${r.currency}`;
  const dir = r.direction === 'above' ? 'supera' : 'cae debajo de';
  const value =
    r.thresholdType === 'percent'
      ? `${fmtNumber(r.value)}%`
      : `${fmtNumber(r.value)} ${r.currency}`;
  return `${target} · cuando el ${metric} ${dir} ${value}`;
}

export function SignalRulesPage() {
  const qc = useQueryClient();
  const [editing, setEditing] = useState<SignalRuleDTO | null>(null);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState<RuleForm>(emptyForm);

  const query = useQuery({
    queryKey: ['signal-rules'],
    queryFn: () => api.get<SignalRuleDTO[]>('/signal-rules'),
  });
  const assets = useQuery({ queryKey: ['assets'], queryFn: () => api.get<AssetDTO[]>('/assets') });

  const invalidate = () => {
    void qc.invalidateQueries({ queryKey: ['signal-rules'] });
    void qc.invalidateQueries({ queryKey: ['signals'] });
  };

  const save = useMutation({
    mutationFn: () => {
      const body = {
        name: form.name,
        description: form.description || undefined,
        nature: form.nature,
        scope: form.scope,
        assetId: form.scope === 'asset' ? form.assetId : undefined,
        thresholdType: form.thresholdType,
        direction: form.direction,
        value: Number(form.value),
        currency: form.thresholdType === 'price' ? form.currency : undefined,
        enabled: editing ? editing.enabled : true,
      };
      return editing
        ? api.put(`/signal-rules/${editing.id}`, body)
        : api.post('/signal-rules', body);
    },
    onSuccess: () => {
      invalidate();
      closeForm();
    },
  });
  const toggle = useMutation({
    mutationFn: (id: string) => api.patch(`/signal-rules/${id}/toggle`),
    onSuccess: invalidate,
  });
  const remove = useMutation({
    mutationFn: (id: string) => api.del(`/signal-rules/${id}`),
    onSuccess: invalidate,
  });

  const closeForm = () => {
    setCreating(false);
    setEditing(null);
    setForm(emptyForm);
    save.reset();
  };

  const openEdit = (r: SignalRuleDTO) => {
    setEditing(r);
    setForm({
      name: r.name,
      description: r.description ?? '',
      nature: r.nature,
      scope: r.scope,
      assetId: r.assetId ?? '',
      thresholdType: r.thresholdType,
      direction: r.direction,
      value: String(r.value),
      currency: r.currency ?? 'USD',
    });
  };

  return (
    <div>
      <PageHeader
        title="Señales"
        back={
          <Link to="/more" className="text-muted hover:text-fg" aria-label="Volver">
            <ChevronLeft size={22} />
          </Link>
        }
        right={<Button onClick={() => setCreating(true)}>Agregar</Button>}
      />
      <p className="-mt-2 mb-4 text-xs text-muted">
        Reglas propias además de las señales automáticas (precio vs PPC, 52 semanas, movimiento
        diario). Informativas, no constituyen asesoramiento financiero.
      </p>

      {query.isLoading && <ListSkeleton rows={3} />}
      {query.isError && <ErrorState onRetry={() => query.refetch()} />}
      {query.data && query.data.length === 0 && (
        <EmptyState
          title="Sin reglas de señal"
          hint='Ej: "Vender BTC" cuando el precio supera 100.000 USD, o "Comprar" cuando el rendimiento cae debajo de -20%.'
          action={<Button onClick={() => setCreating(true)}>Crear regla</Button>}
        />
      )}
      {query.data && query.data.length > 0 && (
        <div className="space-y-2">
          {query.data.map((r) => (
            <Card key={r.id} className={`py-2 pr-2 ${r.enabled ? '' : 'opacity-60'}`}>
              <div className="flex items-center justify-between">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-semibold">{r.name}</span>
                    <Badge tone={r.nature === 'buy' ? 'ok' : 'danger'}>
                      {r.nature === 'buy' ? 'Compra' : 'Venta'}
                    </Badge>
                    {!r.enabled && <Badge tone="warning">pausada</Badge>}
                  </div>
                  <p className="mt-0.5 text-xs text-muted">{ruleSummary(r)}</p>
                  {r.description && (
                    <p className="mt-0.5 text-xs italic text-dim">{r.description}</p>
                  )}
                </div>
                <div className="flex items-center">
                  <IconButton
                    label={r.enabled ? 'Pausar regla' : 'Activar regla'}
                    onClick={() => toggle.mutate(r.id)}
                  >
                    {r.enabled ? <BellRing size={16} /> : <BellOff size={16} />}
                  </IconButton>
                  <IconButton label="Editar" tone="primary" onClick={() => openEdit(r)}>
                    <Pencil size={16} />
                  </IconButton>
                  <IconButton label="Borrar" tone="danger" onClick={() => remove.mutate(r.id)}>
                    <Trash2 size={16} />
                  </IconButton>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      <Modal
        open={creating || Boolean(editing)}
        onClose={closeForm}
        title={editing ? 'Editar regla' : 'Nueva regla de señal'}
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            save.mutate();
          }}
          className="space-y-4"
        >
          <Field label="Nombre">
            <Input
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="Ej: Toma de ganancia BTC"
              required
            />
          </Field>
          <Field label="Descripción / motivo (opcional)">
            <Input
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              placeholder="Por qué creaste esta señal"
            />
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Naturaleza">
              <Select
                value={form.nature}
                onChange={(e) => setForm({ ...form, nature: e.target.value as RuleForm['nature'] })}
              >
                <option value="buy">Compra</option>
                <option value="sell">Venta</option>
              </Select>
            </Field>
            <Field label="Alcance">
              <Select
                value={form.scope}
                onChange={(e) => setForm({ ...form, scope: e.target.value as RuleForm['scope'] })}
              >
                <option value="global">General (todos los activos)</option>
                <option value="asset">Por activo</option>
              </Select>
            </Field>
          </div>

          {form.scope === 'asset' && (
            <Field label="Activo">
              <Select
                value={form.assetId}
                onChange={(e) => setForm({ ...form, assetId: e.target.value })}
                required
              >
                <option value="">Elegí un activo…</option>
                {(assets.data ?? []).map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.ticker} — {a.name}
                  </option>
                ))}
              </Select>
            </Field>
          )}

          <div className="grid grid-cols-2 gap-3">
            <Field label="Tipo de umbral">
              <Select
                value={form.thresholdType}
                onChange={(e) =>
                  setForm({ ...form, thresholdType: e.target.value as RuleForm['thresholdType'] })
                }
              >
                <option value="percent">% de rendimiento vs PPC</option>
                <option value="price">Precio fijo en una moneda</option>
              </Select>
            </Field>
            <Field label="Condición">
              <Select
                value={form.direction}
                onChange={(e) =>
                  setForm({ ...form, direction: e.target.value as RuleForm['direction'] })
                }
              >
                <option value="above">Cuando supera el umbral</option>
                <option value="below">Cuando cae debajo</option>
              </Select>
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Field label={form.thresholdType === 'percent' ? 'Umbral (%)' : 'Umbral (precio)'}>
              <NumericInput
                maxDecimals={4}
                value={form.value}
                onChange={(e) => setForm({ ...form, value: e.target.value })}
                required
              />
            </Field>
            {form.thresholdType === 'price' && (
              <Field label="Moneda del umbral">
                <Select
                  value={form.currency}
                  onChange={(e) =>
                    setForm({ ...form, currency: e.target.value as RuleForm['currency'] })
                  }
                >
                  <option value="ARS">ARS</option>
                  <option value="USD">USD</option>
                </Select>
              </Field>
            )}
          </div>

          {save.error && (
            <p className="text-sm text-danger">
              {save.error instanceof ApiError ? save.error.message : 'No se pudo guardar'}
            </p>
          )}
          <Button type="submit" className="w-full" disabled={save.isPending}>
            {save.isPending ? 'Guardando…' : 'Guardar regla'}
          </Button>
        </form>
      </Modal>
    </div>
  );
}
