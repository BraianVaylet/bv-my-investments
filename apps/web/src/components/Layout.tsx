import { AccentSelector, ThemeToggle } from '@medano-ui/react';
import { clsx } from 'clsx';
import { ArrowDownUp, ChartPie, ChartColumn, House, Ellipsis } from 'lucide-react';
import type { ReactNode } from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import { useSession } from '../lib/session';
import { Logo } from './Logo';

const tabs = [
  { to: '/', label: 'Inicio', icon: House },
  { to: '/portfolio', label: 'Portafolio', icon: ChartPie },
  { to: '/operations', label: 'Operaciones', icon: ArrowDownUp },
  { to: '/stats', label: 'Stats', icon: ChartColumn },
  { to: '/more', label: 'Más', icon: Ellipsis },
];

/** Shell mobile-first: header con logo (como bv-personal-finances) + bottom tabs. */
export function Layout() {
  const { user } = useSession();
  return (
    <div className="mx-auto flex min-h-dvh max-w-2xl flex-col">
      <header className="flex items-center justify-between px-4 pt-4">
        <div className="flex items-center gap-3">
          <Logo className="h-10 w-10 rounded-md" />
          <div>
            <p className="text-lg font-semibold leading-tight text-fg">BV Invest</p>
            {user && <p className="text-xs text-dim">Hola, {user.displayName}</p>}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <AccentSelector />
          <ThemeToggle />
        </div>
      </header>
      <main className="flex-1 px-4 pb-24 pt-4">
        <Outlet />
      </main>
      <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-surface/95 backdrop-blur">
        <div className="mx-auto flex max-w-2xl items-stretch justify-around pb-[env(safe-area-inset-bottom)]">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            return (
              <NavLink
                key={tab.to}
                to={tab.to}
                end={tab.to === '/'}
                className={({ isActive }) =>
                  clsx(
                    'flex flex-1 flex-col items-center gap-0.5 py-2 text-[10px] font-medium transition-colors',
                    isActive ? 'text-primary' : 'text-muted hover:text-fg',
                  )
                }
              >
                <Icon size={22} strokeWidth={1.8} />
                {tab.label}
              </NavLink>
            );
          })}
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
