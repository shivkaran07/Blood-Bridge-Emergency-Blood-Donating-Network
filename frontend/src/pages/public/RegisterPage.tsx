import { useEffect, useState } from 'react';
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  ArrowRight,
  Building2,
  Check,
  CheckCircle2,
  Droplets,
  MailCheck,
  Siren,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { Checkbox, Field, FormError, Input, PasswordInput } from '../../components/ui/Field';
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
    mode: 'onTouched',
    reValidateMode: 'onChange',
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
  const passwordValue = watch('password') ?? '';
  const confirmPasswordValue = watch('confirmPassword') ?? '';
  const passwordLengthValid = passwordValue.length >= 8 && passwordValue.length <= 72;
  const passwordsMatch =
    confirmPasswordValue.length > 0 && passwordValue === confirmPasswordValue;

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
    <div className="mx-auto grid w-full max-w-6xl gap-6 px-4 py-8 sm:px-6 sm:py-10 lg:grid-cols-[minmax(0,1.08fr)_minmax(18rem,0.82fr)] lg:items-start lg:gap-8 lg:py-14">
      <Card className="relative overflow-hidden p-5 sm:p-8">
        <div className="pointer-events-none absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-brand-600 via-brand-400 to-accent-400" aria-hidden="true" />
        <p className="type-eyebrow">
          Join the network
        </p>
        <h1 className="type-title mt-2 text-[1.75rem] text-ink-900">Create your account</h1>
        <p className="mt-2 text-sm leading-relaxed text-ink-500">
          One account to get started. Your role and profile can be updated later.
        </p>
        <ol className="mt-5 grid grid-cols-3 gap-2" aria-label="Account setup steps">
          {['Account', 'Profile', 'Get started'].map((step, index) => (
            <li
              key={step}
              className={cn(
                'flex min-w-0 items-center gap-2 border-t-2 pt-2.5 text-[0.6875rem] font-semibold',
                index === 0
                  ? 'border-brand-500 text-brand-accent'
                  : 'border-ink-200 text-ink-500',
              )}
              aria-current={index === 0 ? 'step' : undefined}
            >
              <span
                className={cn(
                  'flex size-5 shrink-0 items-center justify-center rounded-full text-[0.625rem]',
                  index === 0
                    ? 'bg-brand-100 text-brand-accent'
                    : 'bg-ink-100 text-ink-500',
                )}
              >
                {index + 1}
              </span>
              <span className="truncate">{step}</span>
            </li>
          ))}
        </ol>

        {!supabaseConfigured ? (
          <Alert variant="warning" className="mt-5" title="Supabase is not configured">
            Add the <code className="rounded bg-ink-100 px-1">VITE_SUPABASE_*</code> values to{' '}
            <code className="rounded bg-ink-100 px-1">frontend/.env</code> and restart the dev
            server before creating an account.
          </Alert>
        ) : null}

        <form onSubmit={onSubmit} className="mt-6 space-y-5" noValidate>
          {formError ? (
            <FormError>
              <span className="block font-semibold">We couldn’t create your account.</span>
              <span className="mt-0.5 block">
                {formError} Your entries are still here; review the message and try again.
              </span>
            </FormError>
          ) : null}

          <Field label="Full name" htmlFor="fullName" required error={errors.fullName?.message}>
            <Input
              id="fullName"
              autoComplete="name"
              placeholder="e.g. Asha Verma"
              invalid={Boolean(errors.fullName)}
              aria-invalid={Boolean(errors.fullName)}
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
              aria-invalid={Boolean(errors.email)}
              {...register('email')}
            />
          </Field>

          <fieldset>
            <legend className="text-sm font-semibold text-ink-900">
              How will you use BloodBridge?
            </legend>
            <p className="mt-1 text-xs leading-relaxed text-ink-500">
              Pick the role that best describes what you need today.
            </p>
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              {accountTypes.map((type) => {
                const Icon = type.icon;
                const selected = accountType === type.value;
                const donor = type.value === 'DONOR';
                return (
                  <label
                    key={type.value}
                    className={cn(
                      'group flex cursor-pointer gap-3 rounded-2xl border p-3.5 transition-[border-color,background-color,box-shadow,transform] duration-200 hover:-translate-y-0.5 has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-brand-500 motion-reduce:hover:translate-y-0',
                      selected
                        ? donor
                          ? 'border-accent-400 bg-accent-50/70 shadow-[0_0_0_1px_color-mix(in_srgb,var(--color-accent-500)_25%,transparent)]'
                          : 'border-brand-400 bg-brand-50/70 shadow-[0_0_0_1px_color-mix(in_srgb,var(--color-brand-500)_22%,transparent)]'
                        : 'border-ink-200 bg-surface-raised hover:border-ink-300 hover:bg-ink-50/50',
                    )}
                  >
                    <input
                      type="radio"
                      value={type.value}
                      className="peer sr-only"
                      aria-label={type.title}
                      {...register('accountType')}
                    />
                    <span
                      className={cn(
                        'flex size-10 shrink-0 items-center justify-center rounded-xl transition-colors',
                        selected
                          ? donor
                            ? 'bg-accent-700 text-white'
                            : 'bg-brand-700 text-white'
                          : 'bg-ink-100 text-ink-500 group-hover:bg-ink-200',
                      )}
                    >
                      <Icon className="size-4" aria-hidden="true" />
                    </span>
                    <span>
                      <span className="flex items-center gap-1.5 text-sm font-semibold text-ink-900">
                        {type.title}
                        {selected ? (
                          <CheckCircle2 className="size-3.5 text-brand-accent" aria-hidden="true" />
                        ) : null}
                      </span>
                      <span className="mt-0.5 block text-xs leading-relaxed text-ink-600">
                        {type.description}
                      </span>
                    </span>
                  </label>
                );
              })}
            </div>
            <p className="mt-2 text-xs leading-relaxed text-ink-600">
              {accountType === 'DONOR'
                ? 'Next, add your blood group and choose whether you are available. Contact sharing and location are separate optional settings.'
                : 'You can create and track requests from your workspace. Hospital verifier access requires a separate application and administrator approval.'}
            </p>
          </fieldset>

          <div className="rounded-2xl border border-ink-200/80 bg-ink-50/55 p-4 sm:p-5">
            <div className="mb-4">
              <h2 className="text-sm font-semibold text-ink-900">Secure your account</h2>
              <p className="mt-1 text-xs leading-relaxed text-ink-500">
                Use 8–72 characters. You can show or hide your password while typing.
              </p>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Password" htmlFor="password" required error={errors.password?.message}>
                <PasswordInput
                  id="password"
                  autoComplete="new-password"
                  placeholder="At least 8 characters"
                  invalid={Boolean(errors.password)}
                  aria-invalid={Boolean(errors.password)}
                  {...register('password')}
                />
              </Field>
              <Field
                label="Confirm password"
                htmlFor="confirmPassword"
                required
                error={errors.confirmPassword?.message}
              >
                <PasswordInput
                  id="confirmPassword"
                  autoComplete="new-password"
                  placeholder="Repeat password"
                  invalid={Boolean(errors.confirmPassword)}
                  aria-invalid={Boolean(errors.confirmPassword)}
                  {...register('confirmPassword')}
                />
              </Field>
            </div>
            {passwordValue || confirmPasswordValue ? (
              <ul
                className="mt-3 flex flex-wrap gap-x-4 gap-y-2 border-t border-ink-200/70 pt-3 text-xs"
                aria-live="polite"
                aria-label="Password checks"
              >
                <li className={cn('inline-flex items-center gap-1.5', passwordLengthValid ? 'text-accent-700' : 'text-ink-500')}>
                  <Check className={cn('size-3.5', !passwordLengthValid && 'opacity-30')} aria-hidden="true" />
                  8–72 characters
                </li>
                {confirmPasswordValue ? (
                  <li className={cn('inline-flex items-center gap-1.5', passwordsMatch ? 'text-accent-700' : 'text-ink-500')}>
                    <Check className={cn('size-3.5', !passwordsMatch && 'opacity-30')} aria-hidden="true" />
                    {passwordsMatch ? 'Passwords match' : 'Passwords do not match yet'}
                  </li>
                ) : null}
              </ul>
            ) : null}
          </div>

          <div className="rounded-xl border border-ink-200/80 bg-surface-raised p-3.5 sm:p-4">
            <Checkbox
              id="accepted"
              label="I understand that BloodBridge coordinates requests and offers; it does not provide emergency dispatch or medical proof."
              description="Enter accurate information. Donor responses do not guarantee that blood was donated, and hospital compatibility checks still apply."
              {...register('accepted')}
            />
            {errors.accepted?.message ? (
              <p className="mt-1.5 text-xs font-medium text-brand-accent" role="alert">
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

        <p className="mt-5 text-center text-sm text-ink-500">
          Already registered?{' '}
          <Link to="/login" className="font-semibold text-brand-accent hover:text-brand-accent-strong">
            Sign in
          </Link>
        </p>
      </Card>

      <aside className="space-y-4 lg:sticky lg:top-24">
        <div className="rounded-2xl border border-ink-200 bg-surface-raised p-5 shadow-card sm:p-6">
          <span className="flex size-10 items-center justify-center rounded-lg bg-brand-50 text-brand-accent">
            <Building2 className="size-5" aria-hidden="true" />
          </span>
          <h2 className="type-title mt-4 text-base text-ink-900">Hospital verifiers</h2>
          <p className="mt-1.5 text-sm leading-relaxed text-ink-500">
            Register a normal account first, then submit an institutional verification
            application inside the workspace. An administrator reviews registration number,
            contact person and official email.
          </p>
          <ul className="mt-3 space-y-1.5 text-xs text-ink-500">
            <li>• Approved verifiers can review submitted requests.</li>
            <li>• Review decisions are recorded in the application audit trail.</li>
            <li>• Review and rejection reasons are audited.</li>
          </ul>
        </div>

        <div className="brand-surface relative isolate overflow-hidden rounded-2xl border border-brand-900/40 p-5 text-white shadow-hero sm:p-6">
          <div className="blueprint-grid pointer-events-none absolute inset-0 opacity-50" aria-hidden="true" />
          <div className="relative">
            <h2 className="type-title text-base text-white">Privacy from the first click</h2>
            <ul className="mt-3 space-y-2 text-sm text-white/75">
              <li className="flex gap-2">
                <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-emerald-300" aria-hidden="true" />
                Contact details are never shown in public listings.
              </li>
              <li className="flex gap-2">
                <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-emerald-300" aria-hidden="true" />
                Donor coordinates are optional and only used for consented distance ranking.
              </li>
              <li className="flex gap-2">
                <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-emerald-300" aria-hidden="true" />
                You can withdraw a donor offer before it is accepted.
              </li>
            </ul>
          </div>
        </div>
      </aside>
    </div>
  );
}
