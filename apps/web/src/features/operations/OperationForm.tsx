import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import type { AssetDetailDTO, AssetDTO, MasterDTO, OperationDTO } from '@bv/shared';
import { api, ApiError } from '../../lib/api';
import { fmtMoney, fmtUnits, toInputDate } from '../../lib/format';
import { Button, Field, Input, Modal, Select } from '../../components/ui';

// Schema del form: strings de inputs → números/fechas
const formSchema = z.object({
  type: z.enum(['buy', 'sell']),
  assetId: z.string().min(1, 'Elegí un activo'),
  platformId: z.string().min(1, 'Elegí una plataforma'),
  units: z.coerce.number().positive('Debe ser mayor a 0'),
  currencyId: z.string().min(1, 'Elegí una moneda'),
  unitPrice: z.coerce.number().positive('Debe ser mayor a 0'),
  date: z.string().min(1, 'Requerido'),
  notes: z.string().max(500).optional(),
});
type FormValues = z.infer<typeof formSchema>;

export function OperationFormModal({
  open,
  onClose,
  editing,
}: {
  open: boolean;
  onClose: () => void;
  editing?: OperationDTO | null;
}) {
  const qc = useQueryClient();

  const assets = useQuery({
    queryKey: ['assets'],
    queryFn: () => api.get<AssetDTO[]>('/assets'),
    enabled: open,
  });
  const platforms = useQuery({
    queryKey: ['platforms'],
    queryFn: () => api.get<MasterDTO[]>('/platforms'),
    enabled: open,
  });
  const currencies = useQuery({
    queryKey: ['currencies'],
    queryFn: () => api.get<MasterDTO[]>('/currencies'),
    enabled: open,
  });

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    values: editing
      ? {
          type: editing.type,
          assetId: editing.assetId,
          platformId: editing.platformId,
          units: editing.units,
          currencyId: editing.currencyId,
          unitPrice: editing.unitPrice,
          date: editing.date.slice(0, 10),
          notes: editing.notes ?? '',
        }
      : {
          type: 'buy',
          assetId: '',
          platformId: '',
          units: undefined as unknown as number,
          currencyId: '',
          unitPrice: undefined as unknown as number,
          date: toInputDate(),
          notes: '',
        },
  });

  const type = form.watch('type');
  const assetId = form.watch('assetId');

  // RF-4.2: en venta mostrar tenencia disponible y PPC vigente; RF-4.1: sugerir precio actual
  const assetDetail = useQuery({
    queryKey: ['assets', assetId],
    queryFn: () => api.get<AssetDetailDTO>(`/assets/${assetId}`),
    enabled: open && Boolean(assetId),
  });
  const position = assetDetail.data?.position ?? null;
  const currentPrice = position?.quote?.price;

  const save = useMutation({
    mutationFn: (values: FormValues) => {
      const body = { ...values, date: new Date(`${values.date}T12:00:00Z`).toISOString() };
      return editing ? api.put(`/operations/${editing.id}`, body) : api.post('/operations', body);
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['operations'] });
      void qc.invalidateQueries({ queryKey: ['portfolio'] });
      void qc.invalidateQueries({ queryKey: ['assets'] });
      void qc.invalidateQueries({ queryKey: ['stats'] });
      void qc.invalidateQueries({ queryKey: ['signals'] });
      onClose();
      form.reset();
    },
  });

  const activeAssets = (assets.data ?? []).filter((a) => !a.archived || a.id === assetId);

  return (
    <Modal open={open} onClose={onClose} title={editing ? 'Editar operación' : 'Nueva operación'}>
      <form onSubmit={form.handleSubmit((d) => save.mutate(d))} className="space-y-4">
        <div className="grid grid-cols-2 gap-1 rounded-lg border border-border bg-surface-2 p-1">
          {(['buy', 'sell'] as const).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => form.setValue('type', t)}
              className={`rounded-md py-2 text-sm font-semibold transition-colors ${
                type === t
                  ? t === 'buy'
                    ? 'bg-ok/20 text-ok'
                    : 'bg-danger/20 text-danger'
                  : 'text-muted'
              }`}
            >
              {t === 'buy' ? 'Compra' : 'Venta'}
            </button>
          ))}
        </div>

        <Field label="Activo" error={form.formState.errors.assetId?.message}>
          <Select {...form.register('assetId')}>
            <option value="">Elegí un activo…</option>
            {activeAssets.map((a) => (
              <option key={a.id} value={a.id}>
                {a.ticker} — {a.name}
              </option>
            ))}
          </Select>
        </Field>

        {type === 'sell' && position && (
          <p className="rounded-lg bg-surface-2 px-3 py-2 text-xs text-muted">
            Tenencia disponible: <strong className="text-fg">{fmtUnits(position.units)}</strong> ·
            PPC vigente:{' '}
            <strong className="text-fg">{fmtMoney(position.avgCost, position.opCurrency)}</strong>
          </p>
        )}

        <Field label="Plataforma" error={form.formState.errors.platformId?.message}>
          <Select {...form.register('platformId')}>
            <option value="">Elegí una plataforma…</option>
            {(platforms.data ?? []).map((p) => (
              <option key={p.id} value={p.id}>
                {p.emoji ? `${p.emoji} ` : ''}
                {p.name}
              </option>
            ))}
          </Select>
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Unidades" error={form.formState.errors.units?.message}>
            <Input type="number" step="any" inputMode="decimal" {...form.register('units')} />
          </Field>
          <Field label="Precio unitario" error={form.formState.errors.unitPrice?.message}>
            <Input
              type="number"
              step="any"
              inputMode="decimal"
              placeholder={currentPrice ? String(currentPrice) : undefined}
              {...form.register('unitPrice')}
            />
          </Field>
        </div>
        {currentPrice !== undefined && !editing && (
          <button
            type="button"
            className="text-xs text-primary"
            onClick={() => form.setValue('unitPrice', currentPrice)}
          >
            Usar precio actual ({fmtMoney(currentPrice, position?.quote?.currency)})
          </button>
        )}

        <div className="grid grid-cols-2 gap-3">
          <Field label="Moneda" error={form.formState.errors.currencyId?.message}>
            <Select {...form.register('currencyId')}>
              <option value="">Moneda…</option>
              {(currencies.data ?? []).map((c) => (
                <option key={c.id} value={c.id}>
                  {c.emoji ? `${c.emoji} ` : ''}
                  {c.code}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Fecha" error={form.formState.errors.date?.message}>
            <Input type="date" max={toInputDate()} {...form.register('date')} />
          </Field>
        </div>

        <Field label="Nota (opcional)" error={form.formState.errors.notes?.message}>
          <Input {...form.register('notes')} placeholder="Ej: vesting RSU, DCA mensual…" />
        </Field>

        {save.error && (
          <p className="text-sm text-danger">
            {save.error instanceof ApiError ? save.error.message : 'No se pudo guardar'}
          </p>
        )}

        <Button type="submit" className="w-full" disabled={save.isPending}>
          {save.isPending ? 'Guardando…' : editing ? 'Guardar cambios' : 'Registrar operación'}
        </Button>
      </form>
    </Modal>
  );
}
