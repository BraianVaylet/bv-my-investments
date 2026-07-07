import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { loginSchema, registerSchema, type LoginInput, type RegisterInput } from '@bv/shared';
import { api, ApiError } from '../../lib/api';
import { useSession } from '../../lib/session';
import { Button, Field, Input } from '../../components/ui';

function AuthShell({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center px-6 py-10">
      <div className="mb-8 flex flex-col items-center text-center">
        <img src="/icon.svg" alt="BV Invest" className="mb-3 h-14 w-14 rounded-xl" />
        <p className="text-3xl font-bold tracking-tight">
          BV <span className="text-primary">Invest</span>
        </p>
        <p className="mt-1 text-sm text-muted">{title}</p>
      </div>
      {children}
    </div>
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
    <AuthShell title="Ingresá a tu portafolio">
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
      <p className="mt-6 text-center text-sm text-muted">
        ¿Tenés un token de invitación?{' '}
        <Link to="/register" className="font-medium text-primary">
          Registrate
        </Link>
      </p>
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
    <AuthShell title="Creá tu cuenta con el token de invitación">
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
      <p className="mt-6 text-center text-sm text-muted">
        ¿Ya tenés cuenta?{' '}
        <Link to="/login" className="font-medium text-primary">
          Ingresá
        </Link>
      </p>
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
