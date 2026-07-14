/* Anti-FOUC: aplica tema y acento antes del primer paint.
 * Escribe sobre los tokens de medano-ui; sin acento guardado no escribe nada
 * (vale el acento nativo «brasa»). Versión mínima de src/theme/accent.ts —
 * mantener en sync. */
(function () {
  try {
    var theme = localStorage.getItem('bv-theme');
    if (theme !== 'light' && theme !== 'dark') {
      theme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    }
    document.documentElement.setAttribute('data-theme', theme);

    var hex = localStorage.getItem('bv-accent');
    /* Aproximación sRGB de brasa para el favicon cuando no hay acento elegido. */
    var faviconHex = '#C86A4B';

    if (hex) {
      var h = hex.replace('#', '');
      var r = parseInt(h.slice(0, 2), 16);
      var g = parseInt(h.slice(2, 4), 16);
      var b = parseInt(h.slice(4, 6), 16);
      var mix = function (c, t, amt) {
        return Math.round(c + (t - c) * amt);
      };
      var dark = theme === 'dark';
      var pr = dark ? mix(r, 255, 0.12) : r;
      var pg = dark ? mix(g, 255, 0.12) : g;
      var pb = dark ? mix(b, 255, 0.12) : b;
      var sr = dark ? mix(r, 255, 0.24) : Math.round(r * 0.86);
      var sg = dark ? mix(g, 255, 0.24) : Math.round(g * 0.86);
      var sb = dark ? mix(b, 255, 0.24) : Math.round(b * 0.86);
      var lin = function (c) {
        var s = c / 255;
        return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
      };
      var lum = 0.2126 * lin(pr) + 0.7152 * lin(pg) + 0.0722 * lin(pb);
      var hx = function (rr, gg, bb) {
        return (
          '#' +
          [rr, gg, bb]
            .map(function (c) {
              return Math.max(0, Math.min(255, c)).toString(16).padStart(2, '0');
            })
            .join('')
        );
      };
      var el = document.documentElement;
      var primary = hx(pr, pg, pb);
      var rgbArgs = pr + ', ' + pg + ', ' + pb;
      el.style.setProperty('--medano-accent-base', primary);
      el.style.setProperty('--medano-accent-strong', hx(sr, sg, sb));
      el.style.setProperty('--medano-accent-subtle', 'rgba(' + rgbArgs + ', 0.16)');
      el.style.setProperty('--medano-ink-on-accent', lum > 0.45 ? '#10100f' : '#ffffff');
      el.style.setProperty('--medano-border-focus', 'rgba(' + rgbArgs + ', 0.75)');
      faviconHex = primary;
    }

    // Favicon con el trazo en el color de acento (igual que el logo), sin flash
    var svg =
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">' +
      '<rect width="512" height="512" rx="112" fill="#1f1e1d"/>' +
      '<path d="M116 348 L204 244 L262 296 L398 148" fill="none" stroke="' +
      faviconHex +
      '" stroke-width="34" stroke-linecap="round" stroke-linejoin="round"/>' +
      '<path d="M398 148 L398 224 M398 148 L322 148" fill="none" stroke="' +
      faviconHex +
      '" stroke-width="34" stroke-linecap="round"/>' +
      '<circle cx="116" cy="348" r="24" fill="#7fb389"/></svg>';
    var icon = document.querySelector('link[rel="icon"]');
    if (icon) icon.href = 'data:image/svg+xml,' + encodeURIComponent(svg);
  } catch (e) {
    /* sin storage: defaults del CSS */
  }
})();
