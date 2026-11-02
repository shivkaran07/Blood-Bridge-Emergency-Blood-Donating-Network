import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { ArrowRight, LockKeyhole, ShieldCheck } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { Field, FormError, PasswordInput } from '../../components/ui/Field';
import { Alert } from '../../components/ui/Alert';
import { errorMessage } from '../../lib/api';

const resetSchema = z
  .object({
    password: z.string().min(8, 'Password must be at least 8 characters.'),
    confirmPassword: z.string().min(1, 'Confirm your password.'),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Passwords do not match.',
    path: ['confirmPassword'],
  });

type ResetForm = z.infer<typeof resetSchema>;

export function ResetPasswordPage() {
  const { updatePassword } = useAuth();
  const navigate = useNavigate();
  const [formError, setFormError] = useState<string | null>(null);
  const [isSuccess, setIsSuccess] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ResetForm>({
    resolver: zodResolver(resetSchema),
    defaultValues: { password: '', confirmPassword: '' },
  });

  useEffect(() => {
    document.title = 'Set new password · BloodBridge';
  }, []);

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null);
    try {
      await updatePassword(values.password);
      setIsSuccess(true);
    } catch (cause) {
      setFormError(errorMessage(cause));
    }
  });

  return (
    <div className="mx-auto flex w-full max-w-lg flex-col px-4 py-12 sm:px-6">
      <Card className="p-6 sm:p-8">
        <div className="mb-6 flex size-12 items-center justify-center rounded-xl bg-accent-50 text-accent-700">
          <ShieldCheck className="size-6" aria-hidden="true" />
        </div>

        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-brand-accent">Security Update</p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight text-ink-900">Set a new password</h1>
        <p className="mt-2 text-sm leading-relaxed text-ink-500">
          Create a strong password of at least 8 characters for your BloodBridge account.
        </p>

        {isSuccess ? (
          <div className="mt-6 space-y-5">
            <Alert variant="success" title="Password updated successfully">
              Your password has been changed. You can now use your new password to sign in to your workspace.
            </Alert>
            <div className="pt-2">
              <Button
                variant="primary"
                className="w-full"
                onClick={() => navigate('/login', { replace: true })}
                rightIcon={<ArrowRight className="size-4" />}
              >
                Proceed to sign in
              </Button>
            </div>
          </div>
        ) : (
          <form onSubmit={onSubmit} className="mt-6 space-y-4" noValidate>
            {formError ? <FormError>{formError}</FormError> : null}

            <Field label="New password" htmlFor="password" required error={errors.password?.message}>
              <PasswordInput
                id="password"
                autoComplete="new-password"
                placeholder="At least 8 characters"
                invalid={Boolean(errors.password)}
                leadingIcon={<LockKeyhole className="size-4" aria-hidden="true" />}
                {...register('password')}
              />
            </Field>

            <Field label="Confirm new password" htmlFor="confirmPassword" required error={errors.confirmPassword?.message}>
              <PasswordInput
                id="confirmPassword"
                autoComplete="new-password"
                placeholder="Repeat your new password"
                invalid={Boolean(errors.confirmPassword)}
                leadingIcon={<LockKeyhole className="size-4" aria-hidden="true" />}
                {...register('confirmPassword')}
              />
            </Field>

            <Button
              type="submit"
              className="w-full"
              size="lg"
              isLoading={isSubmitting}
              rightIcon={<ArrowRight className="size-4" aria-hidden="true" />}
            >
              Update password
            </Button>
          </form>
        )}
      </Card>
    </div>
  );
}
