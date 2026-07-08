/**
 * Logo de BV Invest inline: el trazo del gráfico usa el color de acento
 * (`--primary`), así el logo del header/login sigue el mismo color que el
 * favicon y el resto del branding (que también deriva del acento).
 */
export function Logo({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 512 512" className={className} role="img" aria-label="BV Invest">
      <rect width="512" height="512" rx="112" fill="#1f1e1d" />
      <path
        d="M116 348 L204 244 L262 296 L398 148"
        fill="none"
        stroke="var(--primary)"
        strokeWidth="34"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M398 148 L398 224 M398 148 L322 148"
        fill="none"
        stroke="var(--primary)"
        strokeWidth="34"
        strokeLinecap="round"
      />
      <circle cx="116" cy="348" r="24" fill="var(--ok)" />
    </svg>
  );
}
