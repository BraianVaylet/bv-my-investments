import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Archive, ArchiveRestore, ChevronLeft, Pencil, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import type { MasterDTO } from '@bv/shared';
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
} from '../../components/ui';

const MASTERS = [
  { key: 'instrument-types', label: 'Tipos de instrumento', hasCode: false, hasRatio: true },
  { key: 'platforms', label: 'Plataformas', hasCode: false, hasRatio: false },
  { key: 'currencies', label: 'Monedas', hasCode: true, hasRatio: false },
] as const;

type MasterKey = (typeof MASTERS)[number]['key'];

interface FormState {
  name: string;
  code: string;
  emoji: string;
  hasRatio: boolean;
}

const emptyForm: FormState = { name: '', code: '', emoji: '', hasRatio: false };

export function MastersPage() {
  const qc = useQueryClient();
  const [tab, setTab] = useState<MasterKey>('instrument-types');
  const [editing, setEditing] = useState<MasterDTO | null>(null);
  const [creating, setCreating] = useState(false);
  const [deleting, setDeleting] = useState<MasterDTO | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);

  const cfg = MASTERS.find((m) => m.key === tab)!;
  const query = useQuery({
    queryKey: [tab, 'admin'],
    queryFn: () => api.get<MasterDTO[]>(`/${tab}?includeArchived=true`),
  });

  const invalidate = () => {
    void qc.invalidateQueries({ queryKey: [tab] });
    void qc.invalidateQueries({ queryKey: [tab, 'admin'] });
  };

  const save = useMutation({
    mutationFn: () => {
      const body: Record<string, unknown> = { name: form.name };
      if (form.emoji.trim()) body.emoji = form.emoji.trim();
      if (cfg.hasCode) body.code = form.code;
      if (cfg.hasRatio) body.hasRatio = form.hasRatio;
      return editing ? api.put(`/${tab}/${editing.id}`, body) : api.post(`/${tab}`, body);
    },
    onSuccess: () => {
      invalidate();
      closeForm();
    },
  });
  const toggleArchive = useMutation({
    mutationFn: (m: MasterDTO) =>
      api.patch(`/${tab}/${m.id}/${m.archived ? 'unarchive' : 'archive'}`),
    onSuccess: invalidate,
  });
  const remove = useMutation({
    mutationFn: (id: string) => api.del(`/${tab}/${id}`),
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

  const openEdit = (m: MasterDTO) => {
    setEditing(m);
    setForm({
      name: m.name,
      code: m.code ?? '',
      emoji: m.emoji ?? '',
      hasRatio: m.hasRatio ?? false,
    });
  };

  const removeError =
    remove.error instanceof ApiError
      ? remove.error.message
      : remove.error
        ? 'No se pudo borrar'
        : null;

  return (
    <div>
      <PageHeader
        title="Maestros"
        back={
          <Link to="/more" className="text-muted hover:text-fg" aria-label="Volver">
            <ChevronLeft size={22} />
          </Link>
        }
        right={<Button onClick={() => setCreating(true)}>Agregar</Button>}
      />

      <div className="mb-4 flex gap-1 rounded-lg border border-border bg-surface-2 p-1">
        {MASTERS.map((m) => (
          <button
            key={m.key}
            onClick={() => setTab(m.key)}
            className={`flex-1 rounded-md px-2 py-1.5 text-xs font-medium transition-colors ${
              tab === m.key ? 'bg-primary text-on-primary' : 'text-muted hover:text-fg'
            }`}
          >
            {m.label}
          </button>
        ))}
      </div>

      {query.isLoading && <ListSkeleton rows={4} />}
      {query.isError && <ErrorState onRetry={() => query.refetch()} />}
      {query.data && query.data.length === 0 && (
        <EmptyState
          title={`Sin ${cfg.label.toLowerCase()}`}
          action={<Button onClick={() => setCreating(true)}>Agregar</Button>}
        />
      )}
      {query.data && query.data.length > 0 && (
        <div className="space-y-2">
          {query.data.map((m) => (
            <Card key={m.id} className="flex items-center justify-between py-2 pr-2">
              <div className="flex items-center gap-2">
                {m.emoji && <span className="text-lg">{m.emoji}</span>}
                <span className="text-sm font-medium">{m.name}</span>
                {m.code && <Badge>{m.code}</Badge>}
                {m.hasRatio && <Badge tone="primary">con ratio</Badge>}
                {m.archived && <Badge tone="warning">archivado</Badge>}
              </div>
              <div className="flex items-center">
                <IconButton label="Renombrar" tone="primary" onClick={() => openEdit(m)}>
                  <Pencil size={16} />
                </IconButton>
                <IconButton
                  label={m.archived ? 'Desarchivar' : 'Archivar'}
                  onClick={() => toggleArchive.mutate(m)}
                >
                  {m.archived ? <ArchiveRestore size={16} /> : <Archive size={16} />}
                </IconButton>
                <IconButton label="Borrar" tone="danger" onClick={() => setDeleting(m)}>
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
        title={editing ? `Editar (${cfg.label})` : `Nuevo (${cfg.label})`}
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            save.mutate();
          }}
          className="space-y-4"
        >
          <div className="grid grid-cols-[1fr_5rem] gap-3">
            <Field label="Nombre">
              <Input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                required
              />
            </Field>
            <Field label="Emoji">
              <Input
                value={form.emoji}
                onChange={(e) => setForm({ ...form, emoji: e.target.value })}
                placeholder="🪙"
                maxLength={8}
              />
            </Field>
          </div>
          {cfg.hasCode && (
            <Field label="Código (ej. ARS)">
              <Input
                value={form.code}
                onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })}
                required
                maxLength={8}
              />
            </Field>
          )}
          {cfg.hasRatio && (
            <label className="flex items-start gap-3 rounded-lg border border-border bg-surface-2 p-3">
              <input
                type="checkbox"
                checked={form.hasRatio}
                onChange={(e) => setForm({ ...form, hasRatio: e.target.checked })}
                className="mt-0.5 h-4 w-4 accent-[var(--primary)]"
              />
              <span>
                <span className="block text-sm font-medium">
                  ¿Este tipo usa ratio de conversión?
                </span>
                <span className="block text-xs text-muted">
                  Ej: los CEDEARs necesitan ratio (144:1); las criptos y acciones no. Si está
                  activo, el alta de activos de este tipo pide el ratio.
                </span>
              </span>
            </label>
          )}
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
        title="Borrar"
      >
        <p className="text-sm text-muted">¿Borrar “{deleting?.name}”?</p>
        {removeError && (
          <div className="mt-3 rounded-lg border border-warning/40 bg-warning/10 p-3 text-xs text-warning">
            {removeError}
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
