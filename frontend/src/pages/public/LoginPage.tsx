import { useEffect, useState } from 'react';
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { ArrowRight, CheckCircle2, LockKeyhole, Mail, ShieldCheck } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { Field, FormError, Input, PasswordInput } from '../../components/ui/Field';
import { Alert } from '../../components/ui/Alert';
import { supabaseConfigured } from '../../lib/env';
import { errorMessage } from '../../lib/api';

const loginSchema = z.object({
  email: z.string().trim().email('Enter a valid email address.'),
  password: z.string().min(1, 'Enter your password.'),
});

type LoginForm = z.infer<typeof loginSchema>;

export function LoginPage() {
  const { status, signIn } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [formError, setFormError] = useState<string | null>(null);
  const redirect = searchParams.get('redirect') ?? '';
  const safeRedirect = redirect.startsWith('/app') ? redirect : '/app';

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginForm>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', password: '' },
  });

  useEffect(() => {
    document.title = 'Sign in · BloodBridge';
  }, []);

  if (status === 'authenticated') {
    return <Navigate to={safeRedirect} replace />;
  }

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null);
    try {
      await signIn(values.email, values.password);
      navigate(safeRedirect, { replace: true });
    } catch (cause) {
      setFormError(errorMessage(cause));
    }
  });

  return (
    <div className="mx-auto grid w-full max-w-5xl gap-8 px-4 py-10 sm:px-6 lg:grid-cols-[1fr_0.9fr] lg:py-14">
      <Card className="p-6 sm:p-8">
        <p className="type-eyebrow">Welcome back</p>
        <h1 className="type-title mt-2 text-[1.75rem] text-ink-900">Sign in to BloodBridge</h1>
        <p className="mt-2 text-sm leading-relaxed text-ink-500">
          Continue to your role-aware workspace. Hospital verifiers and administrators use
          the same sign-in.
        </p>

        {!supabaseConfigured ? (
          <Alert variant="warning" className="mt-5" title="Supabase is not configured">
            Add <code className="rounded bg-ink-100 px-1">VITE_SUPABASE_URL</code> and{' '}
            <code className="rounded bg-ink-100 px-1">VITE_SUPABASE_ANON_KEY</code> to{' '}
            <code className="rounded bg-ink-100 px-1">frontend/.env</code>, then restart the dev
            server. See <code className="rounded bg-ink-100 px-1">docs/setup.md</code>.
          </Alert>
        ) : null}

        <form onSubmit={onSubmit} className="mt-6 space-y-4" noValidate>
          {formError ? <FormError>{formError}</FormError> : null}

          <Field label="Email address" htmlFor="email" required error={errors.email?.message}>
            <div className="relative">
              <Mail className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-ink-500" aria-hidden="true" />
              <Input
                id="email"
                type="email"
                autoComplete="email"
                placeholder="you@example.com"
                className="pl-9"
                invalid={Boolean(errors.email)}
                {...register('email')}
              />
            </div>
          </Field>

          <Field
            label="Password"
            htmlFor="password"
            required
            hint={
              <Link
                to="/forgot-password"
                className="inline-flex min-h-11 items-center text-xs font-medium text-brand-accent hover:text-brand-accent-strong"
              >
                Forgot password?
              </Link>
            }
            error={errors.password?.message}
          >
            <div className="relative">
              <LockKeyhole className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-ink-500" aria-hidden="true" />
              <PasswordInput
                id="password"
                autoComplete="current-password"
                placeholder="Your password"
                className="pl-9"
                invalid={Boolean(errors.password)}
                {...register('password')}
              />
            </div>
          </Field>

          <Button
            type="submit"
            className="w-full"
            size="lg"
            isLoading={isSubmitting}
            disabled={!supabaseConfigured}
            rightIcon={<ArrowRight className="size-4" aria-hidden="true" />}
          >
            Sign in
          </Button>
        </form>

        <p className="mt-6 text-center text-sm text-ink-500">
          New to BloodBridge?{' '}
          <Link to="/register" className="inline-flex min-h-11 items-center font-semibold text-brand-accent hover:text-brand-accent-strong">
            Create an account
          </Link>
        </p>
      </Card>

      <aside className="brand-surface relative isolate flex flex-col justify-between gap-6 overflow-hidden rounded-2xl border border-brand-900/40 p-6 text-white shadow-hero sm:p-8">
        <div className="blueprint-grid pointer-events-none absolute inset-0 opacity-60" aria-hidden="true" />
        <div className="relative">
          <span className="inline-flex size-11 items-center justify-center rounded-xl border border-white/15 bg-white/10 text-brand-200">
            <ShieldCheck className="size-5" aria-hidden="true" />
          </span>
          <h2 className="type-title mt-5 text-xl leading-snug text-white">
            Verified requests. Consent-based contact. Recorded decisions.
          </h2>
          <p className="mt-3 text-sm leading-relaxed text-white/70">
            BloodBridge keeps coordination transparent while protecting personal contact
            details. Hospital review decisions live in the application database; an optional
            on-chain anchor records that a decision happened without exposing personal data.
          </p>
        </div>

        <ul className="relative space-y-3 text-sm text-white/80">
          {[
            'Request status changes follow a central, enforced workflow.',
            'Donor phone numbers are revealed only with consent and acceptance.',
            'Every review decision leaves an audit trail.',
            'Suspended accounts are blocked server-side.',
          ].map((item) => (
            <li key={item} className="flex items-start gap-2.5">
              <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-emerald-300" aria-hidden="true" />
              <span className="leading-relaxed">{item}</span>
            </li>
          ))}
        </ul>

        <p className="relative rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs leading-relaxed text-white/65">
          For a life-threatening emergency, contact your local emergency number and the
          hospital directly. This application is not an emergency dispatch service.
        </p>
      </aside>
    </div>
  );
}
