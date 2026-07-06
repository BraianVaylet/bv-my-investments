import { useMutation } from '@tanstack/react-query';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../../lib/api';
import { useSession } from '../../lib/session';
import { PageHeader } from '../../components/Layout';
import { Button, Card } from '../../components/ui';

const links = [
  { to: '/admin/assets', label: 'Activos', desc: 'Tickers, tipos y símbolos por proveedor' },
  { to: '/admin/masters', label: 'Maestros', desc: 'Tipos de instrumento, plataformas y monedas' },
  { to: '/admin/settings', label: 'Ajustes', desc: 'Dólar, señales y proveedores de datos' },
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
        Sesión: <span className="font-medium text-text">{user?.displayName}</span> (@
        {user?.username})
      </p>

      <div className="space-y-2">
        {links.map((l) => (
          <Link key={l.to} to={l.to} className="block">
            <Card className="flex items-center justify-between py-3 transition-colors hover:border-muted">
              <div>
                <p className="text-sm font-medium">{l.label}</p>
                <p className="text-xs text-muted">{l.desc}</p>
              </div>
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                className="text-muted"
              >
                <path d="M9 18l6-6-6-6" />
              </svg>
            </Card>
          </Link>
        ))}
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
