/**
 * Favicon derivado del acento. El ThemeProvider de medano-ui aplica los tokens
 * pero no toca el favicon, así que la app lo sincroniza acá.
 *
 * La lógica está duplicada (en versión mínima) en public/theme-init.js
 * (anti-FOUC); mantener ambas en sync si cambia la fórmula.
 */
import { deriveAccent, useMedanoTheme } from '@medano-ui/react';
import { useEffect } from 'react';

/** Aproximación sRGB de --medano-accent-base («brasa»), el acento nativo de medano. */
export const BRASA_ACCENT_HEX = '#C86A4B';

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

/** Mantiene el favicon en sync con el acento activo. Va dentro del ThemeProvider. */
export function FaviconSync(): null {
  const { mode, accent } = useMedanoTheme();
  useEffect(() => {
    applyFavicon(accent ? deriveAccent(accent, mode).base : BRASA_ACCENT_HEX);
  }, [mode, accent]);
  return null;
}
