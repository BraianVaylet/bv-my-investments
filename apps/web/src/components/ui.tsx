import {
  Badge as MedanoBadge,
  type BadgeTone as MedanoBadgeTone,
  Button as MedanoButton,
  type ButtonProps as MedanoButtonProps,
  Card as MedanoCard,
  EmptyState as MedanoEmptyState,
  IconButton as MedanoIconButton,
  SegmentedControl,
  Skeleton as MedanoSkeleton,
  Alert as MedanoAlert,
} from '@medano-ui/react';
import { clsx } from 'clsx';
import { X } from 'lucide-react';
import type {
  ButtonHTMLAttributes,
  ChangeEvent,
  InputHTMLAttributes,
  ReactNode,
  SelectHTMLAttributes,
} from 'react';
import { forwardRef, useEffect, useRef, useState } from 'react';

// ---------------------------------------------------------------- Button

/** Adapter sobre medano-ui (firma legacy sin size/loading). */
export function Button(props: MedanoButtonProps) {
  return <MedanoButton {...props} />;
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
    <MedanoIconButton
      aria-label={label}
      title={label}
      variant="ghost"
      className={clsx(
        tone === 'primary' && 'text-primary',
        tone === 'danger' && 'text-danger',
        className,
      )}
      {...props}
    >
      {children}
    </MedanoIconButton>
  );
}

// ---------------------------------------------------------------- Inputs

function formatNumericTyping(raw: string, maxDecimals: number): string {
  let s = raw.replace(/[^\d,]/g, '');
  const firstComma = s.indexOf(',');
  if (firstComma !== -1) {
    s = s.slice(0, firstComma + 1) + s.slice(firstComma + 1).replace(/,/g, '');
  }
  const [intPart = '', decPart] = s.split(',');
  const intFmt = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return decPart !== undefined ? `${intFmt},${decPart.slice(0, maxDecimals)}` : intFmt;
}

function numToDisplay(value: number | string | undefined, maxDecimals: number): string {
  if (value === undefined || value === null || value === '') return '';
  const n = typeof value === 'number' ? value : parseFloat(String(value));
  if (!Number.isFinite(n)) return '';
  return new Intl.NumberFormat('es-AR', {
    minimumFractionDigits: 0,
    maximumFractionDigits: maxDecimals,
  }).format(n);
}

function displayToRaw(formatted: string): string {
  return formatted.replace(/\./g, '').replace(',', '.');
}

/* Clases públicas de medano-ui: mismo look que sus campos sin el wrapper
 * Field (el patrón legacy asocia label/error a mano en <Field>). */
const inputClass = 'medano-field__input w-full';

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  function Input({ className, ...props }, ref) {
    return <input ref={ref} className={clsx(inputClass, className)} {...props} />;
  },
);

/** Input numérico con formato es-AR (. miles, , decimal) al tipear. */
export const NumericInput = forwardRef<
  HTMLInputElement,
  Omit<InputHTMLAttributes<HTMLInputElement>, 'onChange' | 'type'> & {
    onChange?: (e: ChangeEvent<HTMLInputElement>) => void;
    maxDecimals?: number;
  }
>(function NumericInput({ value, onChange, onBlur, maxDecimals = 8, ...props }, ref) {
  const [display, setDisplay] = useState(() => numToDisplay(value as number | string, maxDecimals));
  const focused = useRef(false);

  useEffect(() => {
    if (!focused.current) {
      setDisplay(numToDisplay(value as number | string, maxDecimals));
    }
  }, [value, maxDecimals]);

  function handleChange(e: ChangeEvent<HTMLInputElement>) {
    const formatted = formatNumericTyping(e.target.value, maxDecimals);
    setDisplay(formatted);
    if (onChange) {
      const raw = displayToRaw(formatted);
      onChange({ ...e, target: { ...e.target, value: raw } } as ChangeEvent<HTMLInputElement>);
    }
  }

  function handleBlur(e: React.FocusEvent<HTMLInputElement>) {
    focused.current = false;
    const raw = displayToRaw(display);
    setDisplay(numToDisplay(raw === '' ? undefined : raw, maxDecimals));
    onBlur?.(e);
  }

  return (
    <Input
      ref={ref}
      type="text"
      inputMode="decimal"
      value={display}
      onChange={handleChange}
      onFocus={() => {
        focused.current = true;
      }}
      onBlur={handleBlur}
      {...props}
    />
  );
});

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
      <span className="medano-field__label block">{label}</span>
      {children}
      {error && <span className="medano-field__error block">{error}</span>}
    </label>
  );
}

// ---------------------------------------------------------------- Card / Badge

export function Card({ className, children }: { className?: string; children: ReactNode }) {
  return <MedanoCard className={className}>{children}</MedanoCard>;
}

type BadgeTone = 'default' | 'ok' | 'danger' | 'warning' | 'primary';

const BADGE_TONE_MAP: Record<BadgeTone, MedanoBadgeTone> = {
  default: 'neutral',
  ok: 'positive',
  danger: 'danger',
  warning: 'caution',
  primary: 'accent',
};

export function Badge({ tone = 'default', children }: { tone?: BadgeTone; children: ReactNode }) {
  return <MedanoBadge tone={BADGE_TONE_MAP[tone]}>{children}</MedanoBadge>;
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

export { MedanoSkeleton as Skeleton };

export function ListSkeleton({ rows = 3 }: { rows?: number }) {
  return (
    <div className="space-y-2">
      {Array.from({ length: rows }).map((_, i) => (
        <MedanoSkeleton key={i} className="h-20" />
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
  return <MedanoEmptyState title={title} description={hint} action={action} />;
}

export function ErrorState({ message, onRetry }: { message?: string; onRetry?: () => void }) {
  return (
    <MedanoAlert
      tone="danger"
      title={message ?? 'Algo salió mal'}
      action={
        onRetry && (
          <Button variant="secondary" onClick={onRetry} type="button">
            Reintentar
          </Button>
        )
      }
    />
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
    <SegmentedControl
      label="Moneda"
      options={[
        { value: 'ARS', label: 'ARS' },
        { value: 'USD', label: 'USD' },
      ]}
      value={value}
      onValueChange={(v) => onChange(v as 'ARS' | 'USD')}
    />
  );
}
