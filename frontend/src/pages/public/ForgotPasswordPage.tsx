import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { ArrowLeft, ArrowRight, KeyRound, Mail } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { Field, FormError, Input } from '../../components/ui/Field';
import { Alert } from '../../components/ui/Alert';
import { supabaseConfigured } from '../../lib/env';
import { errorMessage } from '../../lib/api';

const forgotSchema = z.object({
  email: z.string().trim().email('Enter a valid email address.'),
});

type ForgotForm = z.infer<typeof forgotSchema>;

export function ForgotPasswordPage() {
  const { resetPassword } = useAuth();
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [submittedEmail, setSubmittedEmail] = useState('');

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ForgotForm>({
    resolver: zodResolver(forgotSchema),
    defaultValues: { email: '' },
  });

  useEffect(() => {
    document.title = 'Forgot password · BloodBridge';
  }, []);

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null);
    try {
      await resetPassword(values.email);
      setSubmittedEmail(values.email);
      setIsSubmitted(true);
    } catch (cause) {
      setFormError(errorMessage(cause));
    }
  });

  return (
    <div className="mx-auto flex w-full max-w-lg flex-col px-4 py-12 sm:px-6">
      <Card className="p-6 sm:p-8">
        <div className="mb-6 flex size-12 items-center justify-center rounded-xl bg-brand-50 text-brand-accent">
          <KeyRound className="size-6" aria-hidden="true" />
        </div>

        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-brand-accent">Account Recovery</p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight text-ink-900">Reset your password</h1>
        <p className="mt-2 text-sm leading-relaxed text-ink-500">
          Enter the email address registered with your BloodBridge account. If an account matches,
          we will send a password reset link.
        </p>

        {!supabaseConfigured ? (
          <Alert variant="warning" className="mt-5" title="Supabase is not configured">
            Password reset requires configured Supabase authentication in <code className="rounded bg-ink-100 px-1">frontend/.env</code>.
          </Alert>
        ) : null}

        {isSubmitted ? (
          <div className="mt-6 space-y-5">
            <Alert variant="success" title="Check your inbox">
              A password reset link has been dispatched to{' '}
              <strong className="text-ink-900">{submittedEmail}</strong> if an account exists.
              Click the link in the email to set a new password.
            </Alert>
            <div className="pt-2">
              <Link to="/login">
                <Button variant="secondary" className="w-full" leftIcon={<ArrowLeft className="size-4" />}>
                  Back to sign in
                </Button>
              </Link>
            </div>
          </div>
        ) : (
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

            <Button
              type="submit"
              className="w-full"
              size="lg"
              isLoading={isSubmitting}
              disabled={!supabaseConfigured}
              rightIcon={<ArrowRight className="size-4" aria-hidden="true" />}
            >
              Send reset link
            </Button>

            <div className="pt-2 text-center">
              <Link to="/login" className="inline-flex min-h-11 items-center gap-1.5 text-sm font-medium text-ink-600 hover:text-ink-900">
                <ArrowLeft className="size-3.5" /> Back to sign in
              </Link>
            </div>
          </form>
        )}
      </Card>
    </div>
  );
}
