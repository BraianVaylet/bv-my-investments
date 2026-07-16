import { zodResolver } from '@hookform/resolvers/zod';
import { AuthLayout } from '@medano-ui/react';
import { useMutation } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { loginSchema, registerSchema, type LoginInput, type RegisterInput } from '@bv/shared';
import { api, ApiError } from '../../lib/api';
import { useSession } from '../../lib/session';
import { Logo } from '../../components/Logo';
import { Button, Field, Input } from '../../components/ui';

/**
 * Layout de autenticación. Usa el template único de la familia (AuthLayout de
 * medano); lo propio de invest es el logo y el nombre.
 */
function AuthShell({
  title,
  subtitle,
  children,
  footer,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  return (
    <AuthLayout
      logo={<Logo />}
      appName={
        <>
          BV <span className="text-primary">Invest</span>
        </>
      }
      title={title}
      subtitle={subtitle}
      footer={footer}
    >
      {children}
    </AuthLayout>
  );
}

export function LoginPage() {
  const { user, loading, refresh } = useSession();
  const navigate = useNavigate();
  const form = useForm<LoginInput>({ resolver: zodResolver(loginSchema) });

  const login = useMutation({
    mutationFn: (data: LoginInput) => api.post('/auth/login', data),
    onSuccess: () => {
      refresh();
      navigate('/');
    },
  });

  if (!loading && user) return <Navigate to="/" replace />;

  return (
    <AuthShell
      title="Iniciá sesión"
      subtitle="Ingresá a tu portafolio."
      footer={
        <>
          ¿Tenés un token de invitación?{' '}
          <Link to="/register" className="font-medium text-primary hover:underline">
            Registrate
          </Link>
        </>
      }
    >
      <form onSubmit={form.handleSubmit((d) => login.mutate(d))} className="space-y-4">
        <Field label="Usuario" error={form.formState.errors.username?.message}>
          <Input autoComplete="username" autoCapitalize="none" {...form.register('username')} />
        </Field>
        <Field label="Contraseña" error={form.formState.errors.password?.message}>
          <Input type="password" autoComplete="current-password" {...form.register('password')} />
        </Field>
        {login.error && (
          <p className="text-sm text-danger">
            {login.error instanceof ApiError ? login.error.message : 'Error al ingresar'}
          </p>
        )}
        <Button type="submit" className="w-full" disabled={login.isPending}>
          {login.isPending ? 'Ingresando…' : 'Ingresar'}
        </Button>
      </form>
    </AuthShell>
  );
}

export function RegisterPage() {
  const { refresh } = useSession();
  const navigate = useNavigate();
  const form = useForm<RegisterInput>({ resolver: zodResolver(registerSchema) });

  const register = useMutation({
    mutationFn: (data: RegisterInput) => api.post('/auth/register', data),
    onSuccess: () => {
      refresh();
      navigate('/');
    },
  });

  return (
    <AuthShell
      title="Creá tu cuenta"
      subtitle="Necesitás un token de invitación."
      footer={
        <>
          ¿Ya tenés cuenta?{' '}
          <Link to="/login" className="font-medium text-primary hover:underline">
            Ingresá
          </Link>
        </>
      }
    >
      <form onSubmit={form.handleSubmit((d) => register.mutate(d))} className="space-y-4">
        <Field label="Nombre" error={form.formState.errors.displayName?.message}>
          <Input {...form.register('displayName')} />
        </Field>
        <Field label="Usuario" error={form.formState.errors.username?.message}>
          <Input autoCapitalize="none" {...form.register('username')} />
        </Field>
        <Field label="Contraseña" error={form.formState.errors.password?.message}>
          <Input type="password" autoComplete="new-password" {...form.register('password')} />
        </Field>
        <Field label="Token de invitación" error={form.formState.errors.inviteToken?.message}>
          <Input {...form.register('inviteToken')} />
        </Field>
        {register.error && (
          <p className="text-sm text-danger">
            {register.error instanceof ApiError ? register.error.message : 'Error al registrarse'}
          </p>
        )}
        <Button type="submit" className="w-full" disabled={register.isPending}>
          {register.isPending ? 'Creando…' : 'Crear cuenta'}
        </Button>
      </form>
    </AuthShell>
  );
}

export function RequireAuth({ children }: { children: React.ReactNode }) {
  const { user, loading } = useSession();
  if (loading) {
    return (
      <div className="flex min-h-dvh items-center justify-center text-sm text-muted">Cargando…</div>
    );
  }
  if (!user) return <Navigate to="/login" replace />;
  return <>{children}</>;
}
