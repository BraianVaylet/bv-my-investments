import { Moon, Sun } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { ACCENTS } from '../theme/accent';
import { useTheme } from '../theme/ThemeProvider';

/** Selector de color de acento (mismo patrón que bv-personal-finances). */
export function AccentMenu() {
  const { accent, setAccent } = useTheme();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    window.addEventListener('mousedown', onClick);
    return () => window.removeEventListener('mousedown', onClick);
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-label="Color de acento"
        className="inline-flex h-10 w-10 items-center justify-center rounded-md border border-border bg-surface hover:bg-surface-2"
      >
        <span className="h-4 w-4 rounded-full" style={{ background: 'var(--primary)' }} />
      </button>
      {open && (
        <div className="absolute right-0 z-50 mt-1 flex gap-2 rounded-lg border border-border bg-surface p-2 shadow-lg">
          {ACCENTS.map((a) => (
            <button
              key={a.key}
              type="button"
              aria-label={a.label}
              onClick={() => {
                setAccent(a.hex);
                setOpen(false);
              }}
              className="h-6 w-6 rounded-full border-2"
              style={{
                background: a.hex,
                borderColor:
                  accent.toLowerCase() === a.hex.toLowerCase() ? 'var(--fg)' : 'transparent',
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export function ThemeToggle() {
  const { mode, setMode } = useTheme();
  return (
    <button
      type="button"
      onClick={() => setMode(mode === 'dark' ? 'light' : 'dark')}
      aria-label={mode === 'dark' ? 'Cambiar a tema claro' : 'Cambiar a tema oscuro'}
      className="inline-flex h-10 w-10 items-center justify-center rounded-md border border-border bg-surface text-muted hover:bg-surface-2 hover:text-fg"
    >
      {mode === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
    </button>
  );
}
