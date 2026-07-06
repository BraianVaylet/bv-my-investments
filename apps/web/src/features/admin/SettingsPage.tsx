import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import type { MasterDTO, SettingsInput } from '@bv/shared';
import { api, ApiError } from '../../lib/api';
import { PageHeader } from '../../components/Layout';
import { Button, Card, ErrorState, Field, Input, ListSkeleton, Select } from '../../components/ui';

const PROVIDERS = ['data912', 'coingecko', 'binance', 'criptoya', 'yahoo', 'argentinadatos'];

export function SettingsPage() {
  const qc = useQueryClient();
  const query = useQuery({
    queryKey: ['settings'],
    queryFn: () => api.get<SettingsInput>('/settings'),
  });
  const types = useQuery({
    queryKey: ['instrument-types'],
    queryFn: () => api.get<MasterDTO[]>('/instrument-types'),
  });

  // Estado derivado: los ajustes del servidor hasta que el usuario edite algo
  const [edited, setEdited] = useState<SettingsInput | null>(null);
  const form = edited ?? query.data ?? null;
  const setForm = (next: SettingsInput) => setEdited(next);

  const save = useMutation({
    mutationFn: (data: SettingsInput) => api.put('/settings', data),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['settings'] }),
  });

  if (query.isLoading || !form) return <ListSkeleton rows={3} />;
  if (query.isError) return <ErrorState onRetry={() => query.refetch()} />;

  return (
    <div>
      <PageHeader
        title="Ajustes"
        back={
          <Link to="/more" className="text-muted hover:text-text" aria-label="Volver">
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
      />

      <form
        onSubmit={(e) => {
          e.preventDefault();
          save.mutate(form);
        }}
        className="space-y-4"
      >
        <Card className="space-y-4">
          <h2 className="text-sm font-semibold text-muted">General</h2>
          <Field label="Tipo de dólar para conversiones (RB-10)">
            <Select
              value={form.fxKind}
              onChange={(e) =>
                setForm({ ...form, fxKind: e.target.value as SettingsInput['fxKind'] })
              }
            >
              <option value="ccl">CCL (contado con liqui)</option>
              <option value="mep">MEP (bolsa)</option>
              <option value="oficial">Oficial</option>
            </Select>
          </Field>
          <Field label="Moneda default de visualización">
            <Select
              value={form.defaultDisplayCurrency}
              onChange={(e) =>
                setForm({ ...form, defaultDisplayCurrency: e.target.value as 'ARS' | 'USD' })
              }
            >
              <option value="ARS">ARS</option>
              <option value="USD">USD</option>
            </Select>
          </Field>
        </Card>

        <Card className="space-y-4">
          <h2 className="text-sm font-semibold text-muted">Señales</h2>
          <Field label="Umbral señal de venta (% de rendimiento no realizado)">
            <Input
              type="number"
              step="any"
              value={form.sellSignalPct}
              onChange={(e) => setForm({ ...form, sellSignalPct: Number(e.target.value) })}
            />
          </Field>
          <Field label="Cercanía a extremos de 52 semanas (%)">
            <Input
              type="number"
              step="any"
              value={form.near52wPct}
              onChange={(e) => setForm({ ...form, near52wPct: Number(e.target.value) })}
            />
          </Field>
          <Field label="Variación diaria fuerte (%)">
            <Input
              type="number"
              step="any"
              value={form.dailyMovePct}
              onChange={(e) => setForm({ ...form, dailyMovePct: Number(e.target.value) })}
            />
          </Field>
        </Card>

        <Card className="space-y-4">
          <h2 className="text-sm font-semibold text-muted">
            Proveedor preferido por tipo de instrumento
          </h2>
          {(types.data ?? []).map((t) => (
            <Field key={t.id} label={t.name}>
              <Select
                value={form.preferredProviders[t.name] ?? ''}
                onChange={(e) =>
                  setForm({
                    ...form,
                    preferredProviders: {
                      ...form.preferredProviders,
                      ...(e.target.value
                        ? { [t.name]: e.target.value }
                        : (() => {
                            const rest = { ...form.preferredProviders };
                            delete rest[t.name];
                            return rest;
                          })()),
                    },
                  })
                }
              >
                <option value="">Automático (cadena default)</option>
                {PROVIDERS.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </Select>
            </Field>
          ))}
        </Card>

        {save.error && (
          <p className="text-sm text-negative">
            {save.error instanceof ApiError ? save.error.message : 'No se pudo guardar'}
          </p>
        )}
        {save.isSuccess && <p className="text-sm text-positive">Ajustes guardados.</p>}
        <Button type="submit" className="w-full" disabled={save.isPending}>
          {save.isPending ? 'Guardando…' : 'Guardar ajustes'}
        </Button>
      </form>
    </div>
  );
}
