/**
 * Acento (color base) configurable — mismo sistema que bv-personal-finances.
 * Deriva `--primary-strong/soft/on-primary` desde un hex base calculando
 * luminancia (WCAG) para asegurar contraste en ambos temas.
 *
 * La lógica está duplicada (en versión mínima) en public/theme-init.js
 * (anti-FOUC); mantener ambas en sync si cambia la fórmula.
 */

export type ThemeMode = 'light' | 'dark';

export interface AccentOption {
  key: string;
  label: string;
  hex: string;
}

/** Paleta de acentos (misma que bv-personal-finances). */
export const ACCENTS: readonly AccentOption[] = [
  { key: 'coral', label: 'Coral', hex: '#C96442' },
  { key: 'orange', label: 'Naranja', hex: '#F76808' },
  { key: 'green', label: 'Verde', hex: '#30A46C' },
  { key: 'blue', label: 'Azul', hex: '#0091FF' },
  { key: 'violet', label: 'Violeta', hex: '#8E4EC6' },
  { key: 'teal', label: 'Teal', hex: '#12A594' },
];

export const DEFAULT_ACCENT = ACCENTS[0]?.hex ?? '#C96442';
export const THEME_KEY = 'bv-theme';
export const ACCENT_KEY = 'bv-accent';

interface Rgb {
  r: number;
  g: number;
  b: number;
}

function hexToRgb(hex: string): Rgb {
  const h = hex.replace('#', '');
  return {
    r: Number.parseInt(h.slice(0, 2), 16),
    g: Number.parseInt(h.slice(2, 4), 16),
    b: Number.parseInt(h.slice(4, 6), 16),
  };
}

const clamp = (n: number): number => Math.max(0, Math.min(255, Math.round(n)));
const toHex = ({ r, g, b }: Rgb): string =>
  `#${[r, g, b].map((c) => clamp(c).toString(16).padStart(2, '0')).join('')}`;

function lighten(rgb: Rgb, amt: number): Rgb {
  return {
    r: rgb.r + (255 - rgb.r) * amt,
    g: rgb.g + (255 - rgb.g) * amt,
    b: rgb.b + (255 - rgb.b) * amt,
  };
}

function darken(rgb: Rgb, amt: number): Rgb {
  return { r: rgb.r * (1 - amt), g: rgb.g * (1 - amt), b: rgb.b * (1 - amt) };
}

/** Luminancia relativa WCAG (0..1). */
export function luminance(rgb: Rgb): number {
  const lin = (c: number): number => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * lin(rgb.r) + 0.7152 * lin(rgb.g) + 0.0722 * lin(rgb.b);
}

export interface DerivedAccent {
  primary: string;
  strong: string;
  soft: string;
  onPrimary: string;
}

export function deriveAccent(hex: string, mode: ThemeMode): DerivedAccent {
  const rgb = hexToRgb(hex);
  const base = mode === 'dark' ? lighten(rgb, 0.12) : rgb;
  const strong = mode === 'dark' ? lighten(rgb, 0.24) : darken(rgb, 0.14);
  const onPrimary = luminance(base) > 0.45 ? '#10100f' : '#ffffff';
  const soft = `rgba(${clamp(base.r)}, ${clamp(base.g)}, ${clamp(base.b)}, 0.16)`;
  return { primary: toHex(base), strong: toHex(strong), soft, onPrimary };
}

export function applyAccent(hex: string, mode: ThemeMode): void {
  const d = deriveAccent(hex, mode);
  const el = document.documentElement;
  el.style.setProperty('--primary', d.primary);
  el.style.setProperty('--primary-strong', d.strong);
  el.style.setProperty('--primary-soft', d.soft);
  el.style.setProperty('--on-primary', d.onPrimary);
}

export function applyTheme(mode: ThemeMode, accentHex: string): void {
  document.documentElement.setAttribute('data-theme', mode);
  applyAccent(accentHex, mode);
}

export function getInitialTheme(): ThemeMode {
  const stored = localStorage.getItem(THEME_KEY);
  if (stored === 'light' || stored === 'dark') return stored;
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

export function getInitialAccent(): string {
  return localStorage.getItem(ACCENT_KEY) ?? DEFAULT_ACCENT;
}
