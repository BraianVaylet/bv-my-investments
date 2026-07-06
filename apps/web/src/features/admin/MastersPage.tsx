import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
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
  Input,
  ListSkeleton,
  Modal,
} from '../../components/ui';

const MASTERS = [
  { key: 'instrument-types', label: 'Tipos de instrumento', hasCode: false },
  { key: 'platforms', label: 'Plataformas', hasCode: false },
  { key: 'currencies', label: 'Monedas', hasCode: true },
] as const;

type MasterKey = (typeof MASTERS)[number]['key'];

export function MastersPage() {
  const qc = useQueryClient();
  const [tab, setTab] = useState<MasterKey>('instrument-types');
  const [editing, setEditing] = useState<MasterDTO | null>(null);
  const [creating, setCreating] = useState(false);
  const [deleting, setDeleting] = useState<MasterDTO | null>(null);
  const [name, setName] = useState('');
  const [code, setCode] = useState('');

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
      const body = cfg.hasCode ? { name, code } : { name };
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
    setName('');
    setCode('');
    save.reset();
  };

  const openEdit = (m: MasterDTO) => {
    setEditing(m);
    setName(m.name);
    setCode(m.code ?? '');
  };

  const removeError =
    remove.error instanceof ApiError
      ? remove.error.code === 'IN_USE'
        ? remove.error.message
        : remove.error.message
      : remove.error
        ? 'No se pudo borrar'
        : null;

  return (
    <div>
      <PageHeader
        title="Maestros"
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
        right={<Button onClick={() => setCreating(true)}>Agregar</Button>}
      />

      <div className="mb-4 flex gap-1 rounded-lg border border-border bg-surface-2 p-1">
        {MASTERS.map((m) => (
          <button
            key={m.key}
            onClick={() => setTab(m.key)}
            className={`flex-1 rounded-md px-2 py-1.5 text-xs font-medium transition-colors ${
              tab === m.key ? 'bg-primary text-white' : 'text-muted hover:text-text'
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
            <Card key={m.id} className="flex items-center justify-between py-3">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium">{m.name}</span>
                {m.code && <Badge>{m.code}</Badge>}
                {m.archived && <Badge tone="warning">archivado</Badge>}
              </div>
              <div className="flex gap-3 text-xs">
                <button className="text-primary" onClick={() => openEdit(m)}>
                  Renombrar
                </button>
                <button className="text-muted" onClick={() => toggleArchive.mutate(m)}>
                  {m.archived ? 'Desarchivar' : 'Archivar'}
                </button>
                <button className="text-negative" onClick={() => setDeleting(m)}>
                  Borrar
                </button>
              </div>
            </Card>
          ))}
        </div>
      )}

      <Modal
        open={creating || Boolean(editing)}
        onClose={closeForm}
        title={editing ? `Renombrar (${cfg.label})` : `Nuevo (${cfg.label})`}
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            save.mutate();
          }}
          className="space-y-4"
        >
          <Field label="Nombre">
            <Input value={name} onChange={(e) => setName(e.target.value)} required />
          </Field>
          {cfg.hasCode && (
            <Field label="Código (ej. ARS)">
              <Input
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                required
                maxLength={8}
              />
            </Field>
          )}
          {save.error && (
            <p className="text-sm text-negative">
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
