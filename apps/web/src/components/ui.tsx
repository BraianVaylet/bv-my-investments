import { clsx } from 'clsx';
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
        variant === 'primary' && 'bg-primary text-white hover:bg-primary-hover',
        variant === 'secondary' && 'bg-surface-2 text-text border border-border hover:border-muted',
        variant === 'danger' && 'bg-negative/15 text-negative hover:bg-negative/25',
        variant === 'ghost' && 'text-muted hover:text-text',
        className,
      )}
      {...props}
    />
  );
}

// ---------------------------------------------------------------- Inputs

const inputClass =
  'w-full rounded-lg border border-border bg-surface-2 px-3 py-2 text-sm text-text placeholder:text-muted focus:border-primary focus:outline-none';

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  function Input({ className, ...props }, ref) {
    return <input ref={ref} className={clsx(inputClass, className)} {...props} />;
  },
);

export const Select = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement>>(
  function Select({ className, ...props }, ref) {
    return (
      <select ref={ref} className={clsx(inputClass, 'appearance-none', className)} {...props} />
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
      {error && <span className="block text-xs text-negative">{error}</span>}
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

type BadgeTone = 'default' | 'positive' | 'negative' | 'warning' | 'primary';

export function Badge({ tone = 'default', children }: { tone?: BadgeTone; children: ReactNode }) {
  return (
    <span
      className={clsx(
        'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium',
        tone === 'default' && 'bg-surface-2 text-muted',
        tone === 'positive' && 'bg-positive/15 text-positive',
        tone === 'negative' && 'bg-negative/15 text-negative',
        tone === 'warning' && 'bg-warning/15 text-warning',
        tone === 'primary' && 'bg-primary/15 text-primary',
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
            ? 'text-positive'
            : value < 0
              ? 'text-negative'
              : 'text-text',
      )}
    >
      {children}
    </span>
  );
}

// ---------------------------------------------------------------- Estados (RF: carga/vacío/error en toda vista)

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
    <div className="flex flex-col items-center gap-3 rounded-xl border border-negative/30 bg-negative/5 py-8 text-center">
      <p className="text-sm text-negative">{message ?? 'Algo salió mal'}</p>
      {onRetry && (
        <Button variant="secondary" onClick={onRetry}>
          Reintentar
        </Button>
      )}
    </div>
  );
}

// ---------------------------------------------------------------- Modal (mobile-first: sheet desde abajo)

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
          <button onClick={onClose} className="p-1 text-muted hover:text-text" aria-label="Cerrar">
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
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
            value === c ? 'bg-primary text-white' : 'text-muted hover:text-text',
          )}
        >
          {c}
        </button>
      ))}
    </div>
  );
}
