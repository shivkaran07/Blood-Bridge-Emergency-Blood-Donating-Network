import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Building2,
  ClipboardCheck,
  FileCheck2,
  Mail,
  MapPin,
  Phone,
  ShieldCheck,
} from 'lucide-react';
import { useAuth, useAuthToken } from '../../context/AuthContext';
import { api, errorMessage } from '../../lib/api';
import { queryKeys } from '../../lib/queryClient';
import { invalidateWorkspace } from '../../lib/invalidate';
import { useToast } from '../../context/ToastContext';
import { PageHeader } from '../../components/ui/PageHeader';
import { Card, SectionCard } from '../../components/ui/Card';
import { Alert } from '../../components/ui/Alert';
import { Badge } from '../../components/ui/Badge';
import { Button, buttonClasses } from '../../components/ui/Button';
import { Checkbox, Field, FormError, Input } from '../../components/ui/Field';
import { LoadingState } from '../../components/ui/States';
import { formatDateTime } from '../../lib/format';
import type { HospitalProfile } from '../../types/api';

const applicationSchema = z.object({
  hospitalName: z.string().trim().min(2, 'Enter the hospital name.').max(160, 'Name is too long.'),
  registrationNumber: z
    .string()
    .trim()
    .min(3, 'Enter the institutional registration number.')
    .max(80, 'Registration number is too long.'),
  contactPerson: z.string().trim().min(2, 'Enter a contact person.').max(120, 'Name is too long.'),
  contactPhone: z
    .string()
    .trim()
    .regex(/^\+?[0-9][0-9\s\-()]{6,19}$/, 'Enter a valid phone number (7–20 digits, optional +).'),
  officialEmail: z.string().trim().email('Enter a valid official email address.').max(160),
  address: z.string().trim().min(5, 'Enter the hospital address.').max(300, 'Address is too long.'),
  city: z.string().trim().min(2, 'Enter the city.').max(100, 'City is too long.'),
  area: z.string().trim().min(2, 'Enter the area.').max(120, 'Area is too long.'),
  accuracyConfirmed: z.literal(true, {
    error: 'Confirm that the institutional information is accurate.',
  }),
});

type ApplicationForm = z.infer<typeof applicationSchema>;

export function HospitalApplicationPage() {
  const token = useAuthToken();
  const { me, refreshMe } = useAuth();
  const queryClient = useQueryClient();
  const toast = useToast();
  const [formError, setFormError] = useState<string | null>(null);

  const applicationQuery = useQuery({
    queryKey: queryKeys.hospitalApplication,
    queryFn: ({ signal }) => api.hospitalApplication(token, signal),
    enabled: Boolean(me?.hospitalProfile),
    retry: false,
  });

  const application: HospitalProfile | null =
    applicationQuery.data ?? me?.hospitalProfile ?? null;

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<ApplicationForm>({
    resolver: zodResolver(applicationSchema),
    defaultValues: {
      hospitalName: application?.hospitalName ?? '',
      registrationNumber: application?.registrationNumber ?? '',
      contactPerson: application?.contactPerson ?? '',
      contactPhone: application?.contactPhone ?? me?.profile.phoneNumber ?? '',
      officialEmail: application?.officialEmail ?? me?.user.email ?? '',
      address: application?.address ?? '',
      city: application?.city ?? me?.profile.city ?? '',
      area: application?.area ?? me?.profile.area ?? '',
      accuracyConfirmed: false as unknown as true,
    },
  });

  useEffect(() => {
    if (!application) return;
    reset({
      hospitalName: application.hospitalName,
      registrationNumber: application.registrationNumber,
      contactPerson: application.contactPerson,
      contactPhone: application.contactPhone,
      officialEmail: application.officialEmail,
      address: application.address,
      city: application.city,
      area: application.area,
      accuracyConfirmed: false as unknown as true,
    });
  }, [application, reset]);

  const submitApplication = useMutation({
    mutationFn: (values: ApplicationForm) =>
      api.applyHospital(token, {
        hospitalName: values.hospitalName,
        registrationNumber: values.registrationNumber,
        contactPerson: values.contactPerson,
        contactPhone: values.contactPhone,
        officialEmail: values.officialEmail,
        address: values.address,
        city: values.city,
        area: values.area,
        accuracyConfirmed: true,
      }),
    onSuccess: async (profile) => {
      toast.success(
        application ? 'Application resubmitted' : 'Application submitted',
        `${profile.hospitalName} is awaiting administrator review.`,
      );
      await refreshMe();
      await invalidateWorkspace(queryClient);
    },
    onError: (error) => {
      const message = errorMessage(error);
      setFormError(message);
      toast.error('Could not submit application', message);
    },
  });

  if (!me) return null;

  if (me.permissions.isApprovedVerifier) {
    return (
      <div className="space-y-6">
        <PageHeader
          eyebrow="Hospital"
          title="Hospital verification"
          description="Your institutional account is approved to review blood requests."
        />
        <Alert variant="success" title="Approved hospital verifier">
          {me.hospitalProfile?.hospitalName ?? 'Your hospital'} can access the verification
          queue. Verification decisions are database-backed in Part 1 and recorded in the audit
          trail.
        </Alert>
        <div className="flex flex-wrap gap-2">
          <Link to="/app/hospital" className={buttonClasses('primary', 'md')}>
            Open hospital overview
          </Link>
          <Link to="/app/hospital/queue" className={buttonClasses('secondary', 'md')}>
            Verification queue
          </Link>
        </div>
      </div>
    );
  }

  if (applicationQuery.isLoading) {
    return <LoadingState label="Loading your hospital application…" />;
  }

  const status = application?.verificationStatus ?? null;
  const canResubmit = !application || status === 'REJECTED' || status === 'SUSPENDED';
  const isPending = status === 'PENDING';

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Hospital verifier"
        title={application ? 'Hospital verification application' : 'Apply as a hospital verifier'}
        description="Institutional accounts are reviewed by an administrator. Approval grants database-backed request verification permissions only."
      />

      {application ? (
        <Card>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="flex items-start gap-3">
              <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-700">
                <Building2 className="size-5" aria-hidden="true" />
              </span>
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-base font-semibold text-ink-900">
                    {application.hospitalName}
                  </h2>
                  <Badge
                    tone={
                      status === 'APPROVED'
                        ? 'success'
                        : status === 'PENDING'
                          ? 'warning'
                          : 'danger'
                    }
                    dot
                  >
                    {status}
                  </Badge>
                </div>
                <p className="mt-1 text-sm text-ink-500">
                  {application.city}, {application.area} · Reg. {application.registrationNumber}
                </p>
                <p className="mt-1 text-xs text-ink-400">
                  Submitted {formatDateTime(application.createdAt)} · Updated{' '}
                  {formatDateTime(application.updatedAt)}
                </p>
              </div>
            </div>
            <div className="rounded-lg bg-ink-50 px-3 py-2 text-xs text-ink-500">
              <p className="font-semibold text-ink-700">Part 1 verification</p>
              <p>Database-backed review only</p>
            </div>
          </div>

          {application.reviewReason ? (
            <Alert
              variant={status === 'REJECTED' || status === 'SUSPENDED' ? 'danger' : 'neutral'}
              title={status === 'REJECTED' ? 'Application rejected' : status === 'SUSPENDED' ? 'Application suspended' : 'Review note'}
              className="mt-4"
            >
              {application.reviewReason}
            </Alert>
          ) : null}

          {isPending ? (
            <Alert variant="warning" title="Awaiting administrator review" className="mt-4">
              Your application is in the administrator review queue. You cannot review blood
              requests until it is approved. You will receive an in-app notification when a
              decision is recorded.
            </Alert>
          ) : null}

          {status === 'APPROVED' ? (
            <Alert variant="success" title="Approved" className="mt-4">
              You can review requests in the verification queue. This approval is
              database-backed; no blockchain transaction is created in Part 1.
            </Alert>
          ) : null}
        </Card>
      ) : (
        <Alert variant="info" title="Before you apply">
          Use a real institutional email and registration number. The administrator may reject an
          application with a reason. Approval does not grant administrator access and cannot be
          self-assigned.
        </Alert>
      )}

      {canResubmit ? (
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,0.8fr)]">
          <SectionCard
            title={application ? 'Resubmit institutional details' : 'Institutional details'}
            description="All fields are required. Provide the information an administrator needs to verify your institution."
            bodyClassName="space-y-5"
          >
            <form
              onSubmit={handleSubmit((values) => {
                setFormError(null);
                submitApplication.mutate(values);
              })}
              noValidate
              className="space-y-5"
            >
              {formError ? <FormError>{formError}</FormError> : null}
              <Field label="Hospital name" htmlFor="hospitalName" required error={errors.hospitalName?.message}>
                <Input
                  id="hospitalName"
                  invalid={Boolean(errors.hospitalName)}
                  {...register('hospitalName')}
                />
              </Field>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field
                  label="Registration number"
                  htmlFor="registrationNumber"
                  required
                  error={errors.registrationNumber?.message}
                >
                  <Input
                    id="registrationNumber"
                    invalid={Boolean(errors.registrationNumber)}
                    {...register('registrationNumber')}
                  />
                </Field>
                <Field label="Contact person" htmlFor="contactPerson" required error={errors.contactPerson?.message}>
                  <Input
                    id="contactPerson"
                    invalid={Boolean(errors.contactPerson)}
                    {...register('contactPerson')}
                  />
                </Field>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Contact phone" htmlFor="contactPhone" required error={errors.contactPhone?.message}>
                  <div className="relative">
                    <Phone className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-ink-400" aria-hidden="true" />
                    <Input
                      id="contactPhone"
                      className="pl-9"
                      inputMode="tel"
                      invalid={Boolean(errors.contactPhone)}
                      {...register('contactPhone')}
                    />
                  </div>
                </Field>
                <Field label="Official email" htmlFor="officialEmail" required error={errors.officialEmail?.message}>
                  <div className="relative">
                    <Mail className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-ink-400" aria-hidden="true" />
                    <Input
                      id="officialEmail"
                      className="pl-9"
                      type="email"
                      invalid={Boolean(errors.officialEmail)}
                      {...register('officialEmail')}
                    />
                  </div>
                </Field>
              </div>
              <Field label="Institutional address" htmlFor="address" required error={errors.address?.message}>
                <Input id="address" invalid={Boolean(errors.address)} {...register('address')} />
              </Field>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="City" htmlFor="hospitalCity" required error={errors.city?.message}>
                  <div className="relative">
                    <MapPin className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-ink-400" aria-hidden="true" />
                    <Input
                      id="hospitalCity"
                      className="pl-9"
                      invalid={Boolean(errors.city)}
                      {...register('city')}
                    />
                  </div>
                </Field>
                <Field label="Area" htmlFor="hospitalArea" required error={errors.area?.message}>
                  <Input
                    id="hospitalArea"
                    invalid={Boolean(errors.area)}
                    {...register('area')}
                  />
                </Field>
              </div>

              <div>
                <Checkbox
                  id="accuracyConfirmed"
                  label="I confirm that I am authorized to submit institutional information for this hospital or blood bank."
                  description="Knowingly false applications may be rejected and the account reviewed. Administrator privileges cannot be requested through this form."
                  {...register('accuracyConfirmed')}
                />
                {errors.accuracyConfirmed?.message ? (
                  <p className="mt-1.5 text-xs font-medium text-brand-700" role="alert">
                    {errors.accuracyConfirmed.message}
                  </p>
                ) : null}
              </div>

              <div className="flex flex-wrap justify-end gap-2 border-t border-ink-100 pt-4">
                <Button
                  type="submit"
                  size="lg"
                  isLoading={isSubmitting || submitApplication.isPending}
                  leftIcon={<FileCheck2 className="size-4" aria-hidden="true" />}
                >
                  {application ? 'Resubmit application' : 'Submit application'}
                </Button>
              </div>
            </form>
          </SectionCard>

          <aside className="space-y-4">
            <Card>
              <h2 className="flex items-center gap-2 text-sm font-semibold text-ink-900">
                <ClipboardCheck className="size-4 text-ink-400" aria-hidden="true" />
                Review process
              </h2>
              <ol className="mt-3 space-y-3 text-xs leading-relaxed text-ink-600">
                <li className="flex gap-2">
                  <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-ink-100 text-[0.65rem] font-bold">1</span>
                  An administrator reviews your institutional details.
                </li>
                <li className="flex gap-2">
                  <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-ink-100 text-[0.65rem] font-bold">2</span>
                  Approval grants the HOSPITAL role. Rejection removes verifier access.
                </li>
                <li className="flex gap-2">
                  <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-ink-100 text-[0.65rem] font-bold">3</span>
                  Approved verifiers can review submitted requests and record decisions.
                </li>
                <li className="flex gap-2">
                  <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-ink-100 text-[0.65rem] font-bold">4</span>
                  In Part 2, an authorized wallet transaction may add an on-chain anchor.
                </li>
              </ol>
            </Card>

            <Alert variant="warning" title="What approval does not mean">
              Approval does not make you an administrator, does not verify every future request,
              and does not create a blockchain transaction. It grants access to the application's
              database-backed review queue.
            </Alert>

            <Card>
              <h2 className="flex items-center gap-2 text-sm font-semibold text-ink-900">
                <ShieldCheck className="size-4 text-accent-600" aria-hidden="true" />
                Privacy
              </h2>
              <p className="mt-1.5 text-xs leading-relaxed text-ink-500">
                Institutional contact details are visible only to administrators reviewing the
                application. They are not included in public request listings.
              </p>
            </Card>
          </aside>
        </div>
      ) : null}
    </div>
  );
}
