import { useMutation } from '@tanstack/react-query';
import { BellRing, ChartCandlestick, ChevronRight, Database, Settings } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../../lib/api';
import { useSession } from '../../lib/session';
import { PageHeader } from '../../components/Layout';
import { Button, Card } from '../../components/ui';

const links = [
  {
    to: '/admin/assets',
    label: 'Activos',
    desc: 'Tickers, tipos y símbolos por proveedor',
    icon: ChartCandlestick,
  },
  {
    to: '/admin/masters',
    label: 'Maestros',
    desc: 'Tipos de instrumento, plataformas y monedas',
    icon: Database,
  },
  {
    to: '/admin/signals',
    label: 'Señales',
    desc: 'Reglas propias de compra/venta por umbral',
    icon: BellRing,
  },
  {
    to: '/admin/settings',
    label: 'Ajustes',
    desc: 'Dólar, umbrales y proveedores de datos',
    icon: Settings,
  },
];

export function MorePage() {
  const { user, refresh } = useSession();
  const navigate = useNavigate();
  const logout = useMutation({
    mutationFn: () => api.post('/auth/logout'),
    onSuccess: () => {
      refresh();
      navigate('/login');
    },
  });

  return (
    <div>
      <PageHeader title="Más" />
      <p className="mb-4 text-sm text-muted">
        Sesión: <span className="font-medium text-fg">{user?.displayName}</span> (@
        {user?.username})
      </p>

      <div className="space-y-2">
        {links.map((l) => {
          const Icon = l.icon;
          return (
            <Link key={l.to} to={l.to} className="block">
              <Card className="flex items-center justify-between py-3 transition-colors hover:border-muted">
                <div className="flex items-center gap-3">
                  <Icon size={18} className="text-primary" />
                  <div>
                    <p className="text-sm font-medium">{l.label}</p>
                    <p className="text-xs text-muted">{l.desc}</p>
                  </div>
                </div>
                <ChevronRight size={18} className="text-muted" />
              </Card>
            </Link>
          );
        })}
      </div>

      <Button
        variant="secondary"
        className="mt-6 w-full"
        onClick={() => logout.mutate()}
        disabled={logout.isPending}
      >
        {logout.isPending ? 'Cerrando sesión…' : 'Cerrar sesión'}
      </Button>

      <p className="mt-8 text-center text-[10px] leading-relaxed text-muted">
        BV Invest registra y calcula sobre tus operaciones. La información y señales que muestra son
        informativas y no constituyen asesoramiento financiero.
      </p>
    </div>
  );
}
