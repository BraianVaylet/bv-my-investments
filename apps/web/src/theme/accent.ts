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
  focusRing: string;
}

export function deriveAccent(hex: string, mode: ThemeMode): DerivedAccent {
  const rgb = hexToRgb(hex);
  const base = mode === 'dark' ? lighten(rgb, 0.12) : rgb;
  const strong = mode === 'dark' ? lighten(rgb, 0.24) : darken(rgb, 0.14);
  const onPrimary = luminance(base) > 0.45 ? '#10100f' : '#ffffff';
  const rgbArgs = `${clamp(base.r)}, ${clamp(base.g)}, ${clamp(base.b)}`;
  return {
    primary: toHex(base),
    strong: toHex(strong),
    soft: `rgba(${rgbArgs}, 0.16)`,
    onPrimary,
    focusRing: `rgba(${rgbArgs}, 0.75)`,
  };
}

/** Favicon SVG (data-URI) con el trazo en el color de acento — igual que el logo. */
export function faviconDataUri(primaryHex: string): string {
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">` +
    `<rect width="512" height="512" rx="112" fill="#1f1e1d"/>` +
    `<path d="M116 348 L204 244 L262 296 L398 148" fill="none" stroke="${primaryHex}" stroke-width="34" stroke-linecap="round" stroke-linejoin="round"/>` +
    `<path d="M398 148 L398 224 M398 148 L322 148" fill="none" stroke="${primaryHex}" stroke-width="34" stroke-linecap="round"/>` +
    `<circle cx="116" cy="348" r="24" fill="#7fb389"/></svg>`;
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

export function applyFavicon(primaryHex: string): void {
  let link = document.querySelector<HTMLLinkElement>('link[rel="icon"]');
  if (!link) {
    link = document.createElement('link');
    link.rel = 'icon';
    document.head.appendChild(link);
  }
  link.type = 'image/svg+xml';
  link.href = faviconDataUri(primaryHex);
}

/** Tokens de medano-ui que sobrescribe el acento elegido. Las vars legacy
    (--primary*) son alias de estos tokens en index.css. */
const MEDANO_ACCENT_VARS = [
  '--medano-accent-base',
  '--medano-accent-strong',
  '--medano-accent-subtle',
  '--medano-ink-on-accent',
  '--medano-border-focus',
] as const;

export function applyAccent(hex: string, mode: ThemeMode): void {
  const d = deriveAccent(hex, mode);
  const el = document.documentElement;
  el.style.setProperty('--medano-accent-base', d.primary);
  el.style.setProperty('--medano-accent-strong', d.strong);
  el.style.setProperty('--medano-accent-subtle', d.soft);
  el.style.setProperty('--medano-ink-on-accent', d.onPrimary);
  el.style.setProperty('--medano-border-focus', d.focusRing);
  applyFavicon(d.primary);
}

/** Aproximación sRGB de --medano-accent-base («brasa»). Solo para el favicon
    cuando no hay acento elegido; la UI usa el token real. */
export const BRASA_ACCENT_HEX = '#C86A4B';

/** Quita las sobreescrituras: vuelve al acento nativo de medano (brasa). */
export function clearAccent(): void {
  const el = document.documentElement;
  for (const varName of MEDANO_ACCENT_VARS) el.style.removeProperty(varName);
  applyFavicon(BRASA_ACCENT_HEX);
}

export function applyTheme(mode: ThemeMode, accentHex: string | null): void {
  document.documentElement.setAttribute('data-theme', mode);
  if (accentHex) {
    applyAccent(accentHex, mode);
  } else {
    clearAccent();
  }
}

export function getInitialTheme(): ThemeMode {
  const stored = localStorage.getItem(THEME_KEY);
  if (stored === 'light' || stored === 'dark') return stored;
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

/** Acento inicial: hex guardado, o null = acento nativo de medano (brasa). */
export function getInitialAccent(): string | null {
  return localStorage.getItem(ACCENT_KEY);
}
