import { clsx } from 'clsx';
import { X } from 'lucide-react';
import type {
  ButtonHTMLAttributes,
  InputHTMLAttributes,
  ReactNode,
  SelectHTMLAttributes,
} from 'react';
import { forwardRef, useEffect } from 'react';

// ---------------------------------------------------------------- Button

type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'ghost';

export function Button({
  variant = 'primary',
  className,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: ButtonVariant }) {
  return (
    <button
      className={clsx(
        'inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50',
        variant === 'primary' && 'bg-primary text-on-primary hover:bg-primary-strong',
        variant === 'secondary' && 'bg-surface-2 text-fg border border-border hover:border-muted',
        variant === 'danger' && 'bg-danger/15 text-danger hover:bg-danger/25',
        variant === 'ghost' && 'text-muted hover:text-fg',
        className,
      )}
      {...props}
    />
  );
}

/** Botón de acción compacto solo-icono (editar/archivar/borrar). Target ≥40px. */
export function IconButton({
  label,
  tone = 'default',
  className,
  children,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  label: string;
  tone?: 'default' | 'primary' | 'danger';
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      className={clsx(
        'inline-flex h-10 w-10 items-center justify-center rounded-md transition-colors disabled:opacity-50',
        tone === 'default' && 'text-muted hover:bg-surface-2 hover:text-fg',
        tone === 'primary' && 'text-primary hover:bg-primary-soft',
        tone === 'danger' && 'text-danger hover:bg-danger/15',
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
}

// ---------------------------------------------------------------- Inputs

const inputClass =
  'w-full rounded-lg border border-border bg-surface-2 px-3 py-2 text-sm text-fg placeholder:text-dim focus:border-primary focus:outline-none';

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  function Input({ className, ...props }, ref) {
    return <input ref={ref} className={clsx(inputClass, className)} {...props} />;
  },
);

/** Select con chevron indicando que es desplegable. */
export const Select = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement>>(
  function Select({ className, ...props }, ref) {
    return (
      <span className={clsx('relative block', className)}>
        <select ref={ref} className={clsx(inputClass, 'appearance-none pr-8')} {...props} />
        <svg
          aria-hidden="true"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          className="pointer-events-none absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted"
        >
          <path d="M6 9l6 6 6-6" />
        </svg>
      </span>
    );
  },
);

export function Field({
  label,
  error,
  children,
}: {
  label: string;
  error?: string;
  children: ReactNode;
}) {
  return (
    <label className="block space-y-1">
      <span className="text-xs font-medium text-muted">{label}</span>
      {children}
      {error && <span className="block text-xs text-danger">{error}</span>}
    </label>
  );
}

// ---------------------------------------------------------------- Card / Badge

export function Card({ className, children }: { className?: string; children: ReactNode }) {
  return (
    <div className={clsx('rounded-xl border border-border bg-surface p-4', className)}>
      {children}
    </div>
  );
}

type BadgeTone = 'default' | 'ok' | 'danger' | 'warning' | 'primary';

export function Badge({ tone = 'default', children }: { tone?: BadgeTone; children: ReactNode }) {
  return (
    <span
      className={clsx(
        'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium',
        tone === 'default' && 'bg-surface-2 text-muted',
        tone === 'ok' && 'bg-ok/15 text-ok',
        tone === 'danger' && 'bg-danger/15 text-danger',
        tone === 'warning' && 'bg-warning/15 text-warning',
        tone === 'primary' && 'bg-primary-soft text-primary',
      )}
    >
      {children}
    </span>
  );
}

/** Monto con color por signo. */
export function SignedAmount({ value, children }: { value: number | null; children: ReactNode }) {
  return (
    <span
      className={clsx(
        'font-medium tabular-nums',
        value === null
          ? 'text-muted'
          : value > 0
            ? 'text-ok'
            : value < 0
              ? 'text-danger'
              : 'text-fg',
      )}
    >
      {children}
    </span>
  );
}

// -------------------------------------------------- Estados (carga/vacío/error en toda vista)

export function Skeleton({ className }: { className?: string }) {
  return <div className={clsx('animate-pulse rounded-lg bg-surface-2', className)} />;
}

export function ListSkeleton({ rows = 3 }: { rows?: number }) {
  return (
    <div className="space-y-2">
      {Array.from({ length: rows }).map((_, i) => (
        <Skeleton key={i} className="h-20" />
      ))}
    </div>
  );
}

export function EmptyState({
  title,
  hint,
  action,
}: {
  title: string;
  hint?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-border py-10 text-center">
      <p className="text-sm font-medium">{title}</p>
      {hint && <p className="max-w-xs text-xs text-muted">{hint}</p>}
      {action}
    </div>
  );
}

export function ErrorState({ message, onRetry }: { message?: string; onRetry?: () => void }) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-xl border border-danger/30 bg-danger/5 py-8 text-center">
      <p className="text-sm text-danger">{message ?? 'Algo salió mal'}</p>
      {onRetry && (
        <Button variant="secondary" onClick={onRetry}>
          Reintentar
        </Button>
      )}
    </div>
  );
}

// ---------------------------------------------------------------- Modal (sheet mobile-first)

export function Modal({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="relative max-h-[90vh] w-full overflow-y-auto rounded-t-2xl border border-border bg-surface p-4 sm:max-w-md sm:rounded-2xl"
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-base font-semibold">{title}</h2>
          <IconButton label="Cerrar" onClick={onClose}>
            <X size={18} />
          </IconButton>
        </div>
        {children}
      </div>
    </div>
  );
}

/** Toggle ARS/USD (RF-5.2). */
export function CurrencyToggle({
  value,
  onChange,
}: {
  value: 'ARS' | 'USD';
  onChange: (c: 'ARS' | 'USD') => void;
}) {
  return (
    <div className="inline-flex rounded-lg border border-border bg-surface-2 p-0.5">
      {(['ARS', 'USD'] as const).map((c) => (
        <button
          key={c}
          onClick={() => onChange(c)}
          className={clsx(
            'rounded-md px-3 py-1 text-xs font-semibold transition-colors',
            value === c ? 'bg-primary text-on-primary' : 'text-muted hover:text-fg',
          )}
        >
          {c}
        </button>
      ))}
    </div>
  );
}
