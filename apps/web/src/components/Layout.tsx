import { clsx } from 'clsx';
import type { ReactNode } from 'react';
import { NavLink, Outlet } from 'react-router-dom';

const tabs: { to: string; label: string; icon: ReactNode }[] = [
  {
    to: '/',
    label: 'Inicio',
    icon: (
      <svg
        width="22"
        height="22"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
      >
        <path d="M3 10.5L12 3l9 7.5" />
        <path d="M5 9.5V21h14V9.5" />
      </svg>
    ),
  },
  {
    to: '/portfolio',
    label: 'Portafolio',
    icon: (
      <svg
        width="22"
        height="22"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
      >
        <path d="M21 12A9 9 0 1 1 12 3" />
        <path d="M12 3a9 9 0 0 1 9 9h-9z" />
      </svg>
    ),
  },
  {
    to: '/operations',
    label: 'Operaciones',
    icon: (
      <svg
        width="22"
        height="22"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
      >
        <path d="M7 4v16m0-16L3 8m4-4l4 4M17 20V4m0 16l4-4m-4 4l-4-4" />
      </svg>
    ),
  },
  {
    to: '/stats',
    label: 'Stats',
    icon: (
      <svg
        width="22"
        height="22"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
      >
        <path d="M4 20V10M10 20V4M16 20v-7M22 20H2" />
      </svg>
    ),
  },
  {
    to: '/more',
    label: 'Más',
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor">
        <circle cx="5" cy="12" r="2" />
        <circle cx="12" cy="12" r="2" />
        <circle cx="19" cy="12" r="2" />
      </svg>
    ),
  },
];

/** Shell mobile-first: contenido + bottom tab bar (doc 01 §9). */
export function Layout() {
  return (
    <div className="mx-auto flex min-h-dvh max-w-2xl flex-col">
      <main className="flex-1 px-4 pb-24 pt-4">
        <Outlet />
      </main>
      <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-surface/95 backdrop-blur">
        <div className="mx-auto flex max-w-2xl items-stretch justify-around pb-[env(safe-area-inset-bottom)]">
          {tabs.map((tab) => (
            <NavLink
              key={tab.to}
              to={tab.to}
              end={tab.to === '/'}
              className={({ isActive }) =>
                clsx(
                  'flex flex-1 flex-col items-center gap-0.5 py-2 text-[10px] font-medium transition-colors',
                  isActive ? 'text-primary' : 'text-muted hover:text-text',
                )
              }
            >
              {tab.icon}
              {tab.label}
            </NavLink>
          ))}
        </div>
      </nav>
    </div>
  );
}

export function PageHeader({
  title,
  right,
  back,
}: {
  title: string;
  right?: ReactNode;
  back?: ReactNode;
}) {
  return (
    <header className="mb-4 flex items-center justify-between gap-2">
      <div className="flex items-center gap-2">
        {back}
        <h1 className="text-xl font-bold">{title}</h1>
      </div>
      {right}
    </header>
  );
}
