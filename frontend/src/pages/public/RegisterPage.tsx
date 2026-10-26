import { useEffect, useState } from 'react';
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  ArrowRight,
  Building2,
  CheckCircle2,
  Droplets,
  MailCheck,
  Siren,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { Checkbox, Field, FormError, Input } from '../../components/ui/Field';
import { Alert } from '../../components/ui/Alert';
import { supabaseConfigured } from '../../lib/env';
import { errorMessage } from '../../lib/api';
import { cn } from '../../lib/cn';

const registerSchema = z
  .object({
    fullName: z
      .string()
      .trim()
      .min(2, 'Enter your full name.')
      .max(120, 'Your name must be at most 120 characters.'),
    email: z.string().trim().email('Enter a valid email address.'),
    accountType: z.enum(['REQUESTER', 'DONOR']),
    password: z
      .string()
      .min(8, 'Use at least 8 characters.')
      .max(72, 'Passwords must be at most 72 characters.'),
    confirmPassword: z.string().min(1, 'Confirm your password.'),
    accepted: z.literal(true, {
      error: 'Confirm that you understand how BloodBridge works.',
    }),
  })
  .refine((values) => values.password === values.confirmPassword, {
    path: ['confirmPassword'],
    message: 'Passwords do not match.',
  });

type RegisterForm = z.infer<typeof registerSchema>;

const accountTypes = [
  {
    value: 'REQUESTER' as const,
    icon: Siren,
    title: 'Requester',
    description: 'I may need to create blood requests for a patient.',
  },
  {
    value: 'DONOR' as const,
    icon: Droplets,
    title: 'Donor',
    description: 'I want to offer blood when a matching need is nearby.',
  },
];

export function RegisterPage() {
  const { status, signUp } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [formError, setFormError] = useState<string | null>(null);
  const [awaitingEmail, setAwaitingEmail] = useState<string | null>(null);
  const requestedType = searchParams.get('type');
  const initialAccountType = requestedType?.toUpperCase() === 'DONOR' ? 'DONOR' : 'REQUESTER';

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<RegisterForm>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      fullName: '',
      email: '',
      accountType: initialAccountType,
      password: '',
      confirmPassword: '',
      accepted: false as unknown as true,
    },
  });

  const accountType = watch('accountType');

  useEffect(() => {
    document.title = 'Create account · BloodBridge';
  }, []);

  if (status === 'authenticated') {
    return <Navigate to="/app" replace />;
  }

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null);
    try {
      const result = await signUp({
        email: values.email,
        password: values.password,
        fullName: values.fullName,
        accountType: values.accountType,
      });
      if (result.needsConfirmation) {
        setAwaitingEmail(values.email);
        return;
      }
      navigate('/app', { replace: true });
    } catch (cause) {
      setFormError(errorMessage(cause));
    }
  });

  if (awaitingEmail) {
    return (
      <div className="mx-auto w-full max-w-lg px-4 py-12 sm:px-6">
        <Card className="p-6 text-center sm:p-8">
          <span className="mx-auto flex size-14 items-center justify-center rounded-2xl bg-accent-50 text-accent-700">
            <MailCheck className="size-7" aria-hidden="true" />
          </span>
          <h1 className="mt-5 text-2xl font-semibold text-ink-900">Check your inbox</h1>
          <p className="mt-2 text-sm leading-relaxed text-ink-600">
            We sent a confirmation link to <strong className="text-ink-900">{awaitingEmail}</strong>.
            Confirm your email, then sign in to complete your profile.
          </p>
          <Alert variant="info" className="mt-5 text-left" title="Did not receive it?">
            Check your spam folder, or wait a minute and try signing in. Your Supabase project
            may also be configured to skip email confirmation.
          </Alert>
          <Link
            to="/login"
            className="mt-6 inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-brand-700 px-5 text-sm font-semibold text-white transition hover:bg-brand-800"
          >
            Go to sign in
            <ArrowRight className="size-4" aria-hidden="true" />
          </Link>
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto grid w-full max-w-5xl gap-8 px-4 py-10 sm:px-6 lg:grid-cols-[1.05fr_0.95fr] lg:py-14">
      <Card className="p-6 sm:p-8">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-brand-700">
          Join the network
        </p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight text-ink-900">Create your account</h1>
        <p className="mt-2 text-sm leading-relaxed text-ink-500">
          Choose how you want to start. You can add a donor profile or apply as a hospital
          verifier after registration.
        </p>

        {!supabaseConfigured ? (
          <Alert variant="warning" className="mt-5" title="Supabase is not configured">
            Add the <code className="rounded bg-white/70 px-1">VITE_SUPABASE_*</code> values to{' '}
            <code className="rounded bg-white/70 px-1">frontend/.env</code> and restart the dev
            server before creating an account.
          </Alert>
        ) : null}

        <form onSubmit={onSubmit} className="mt-6 space-y-5" noValidate>
          {formError ? <FormError>{formError}</FormError> : null}

          <Field label="Full name" htmlFor="fullName" required error={errors.fullName?.message}>
            <Input
              id="fullName"
              autoComplete="name"
              placeholder="e.g. Asha Verma"
              invalid={Boolean(errors.fullName)}
              {...register('fullName')}
            />
          </Field>

          <Field label="Email address" htmlFor="email" required error={errors.email?.message}>
            <Input
              id="email"
              type="email"
              autoComplete="email"
              placeholder="you@example.com"
              invalid={Boolean(errors.email)}
              {...register('email')}
            />
          </Field>

          <fieldset>
            <legend className="text-sm font-medium text-ink-800">
              How will you use BloodBridge?
            </legend>
            <div className="mt-2 grid gap-2 sm:grid-cols-2">
              {accountTypes.map((type) => {
                const Icon = type.icon;
                const selected = accountType === type.value;
                return (
                  <label
                    key={type.value}
                    className={cn(
                      'flex cursor-pointer gap-3 rounded-xl border p-3.5 transition',
                      selected
                        ? 'border-brand-400 bg-brand-50/70 ring-1 ring-brand-200'
                        : 'border-ink-200 bg-white hover:border-ink-300',
                    )}
                  >
                    <input
                      type="radio"
                      value={type.value}
                      className="sr-only"
                      {...register('accountType')}
                    />
                    <span
                      className={cn(
                        'flex size-9 shrink-0 items-center justify-center rounded-lg',
                        selected ? 'bg-brand-700 text-white' : 'bg-ink-100 text-ink-500',
                      )}
                    >
                      <Icon className="size-4" aria-hidden="true" />
                    </span>
                    <span>
                      <span className="flex items-center gap-1.5 text-sm font-semibold text-ink-900">
                        {type.title}
                        {selected ? (
                          <CheckCircle2 className="size-3.5 text-brand-700" aria-hidden="true" />
                        ) : null}
                      </span>
                      <span className="mt-0.5 block text-xs leading-relaxed text-ink-500">
                        {type.description}
                      </span>
                    </span>
                  </label>
                );
              })}
            </div>
            <p className="mt-2 text-xs leading-relaxed text-ink-400">
              Hospital verifier access is granted only after an administrator approves an
              institutional application. It cannot be selected at registration.
            </p>
          </fieldset>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Password" htmlFor="password" required error={errors.password?.message}>
              <Input
                id="password"
                type="password"
                autoComplete="new-password"
                placeholder="At least 8 characters"
                invalid={Boolean(errors.password)}
                {...register('password')}
              />
            </Field>
            <Field
              label="Confirm password"
              htmlFor="confirmPassword"
              required
              error={errors.confirmPassword?.message}
            >
              <Input
                id="confirmPassword"
                type="password"
                autoComplete="new-password"
                placeholder="Repeat password"
                invalid={Boolean(errors.confirmPassword)}
                {...register('confirmPassword')}
              />
            </Field>
          </div>

          <div>
            <Checkbox
              id="accepted"
              label="I understand that BloodBridge coordinates requests and offers; it does not provide emergency dispatch or medical proof."
              description="Enter accurate information. Donor responses do not guarantee that blood was donated, and hospital compatibility checks still apply."
              {...register('accepted')}
            />
            {errors.accepted?.message ? (
              <p className="mt-1.5 text-xs font-medium text-brand-700" role="alert">
                {errors.accepted.message}
              </p>
            ) : null}
          </div>

          <Button
            type="submit"
            size="lg"
            className="w-full"
            isLoading={isSubmitting}
            disabled={!supabaseConfigured}
            rightIcon={<ArrowRight className="size-4" aria-hidden="true" />}
          >
            Create account
          </Button>
        </form>

        <p className="mt-6 text-center text-sm text-ink-500">
          Already registered?{' '}
          <Link to="/login" className="font-semibold text-brand-700 hover:text-brand-800">
            Sign in
          </Link>
        </p>
      </Card>

      <aside className="space-y-4">
        <div className="rounded-2xl border border-ink-200 bg-white p-6 shadow-card">
          <span className="flex size-10 items-center justify-center rounded-xl bg-brand-50 text-brand-700">
            <Building2 className="size-5" aria-hidden="true" />
          </span>
          <h2 className="mt-4 text-base font-semibold text-ink-900">Hospital verifiers</h2>
          <p className="mt-1.5 text-sm leading-relaxed text-ink-500">
            Register a normal account first, then submit an institutional verification
            application inside the workspace. An administrator reviews registration number,
            contact person and official email.
          </p>
          <ul className="mt-3 space-y-1.5 text-xs text-ink-500">
            <li>• Approved verifiers can review submitted requests.</li>
            <li>• Verification is database-backed in Part 1.</li>
            <li>• Review and rejection reasons are audited.</li>
          </ul>
        </div>

        <div className="rounded-2xl border border-ink-200 bg-ink-950 p-6 text-white">
          <h2 className="text-base font-semibold">Privacy from the first click</h2>
          <ul className="mt-3 space-y-2 text-sm text-ink-300">
            <li className="flex gap-2">
              <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-accent-300" aria-hidden="true" />
              Contact details are never shown in public listings.
            </li>
            <li className="flex gap-2">
              <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-accent-300" aria-hidden="true" />
              Donor coordinates are optional and only used for consented distance ranking.
            </li>
            <li className="flex gap-2">
              <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-accent-300" aria-hidden="true" />
              You can withdraw a donor offer before it is accepted.
            </li>
          </ul>
        </div>
      </aside>
    </div>
  );
}
