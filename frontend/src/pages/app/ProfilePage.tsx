import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Building2,
  CheckCircle2,
  Droplet,
  Mail,
  MapPin,
  Phone,
  Save,
  ShieldCheck,
  UserRound,
} from 'lucide-react';
import { useAuth, useAuthToken } from '../../context/AuthContext';
import { api, errorMessage } from '../../lib/api';
import { invalidateWorkspace } from '../../lib/invalidate';
import { useToast } from '../../context/ToastContext';
import { PageHeader } from '../../components/ui/PageHeader';
import { Card, SectionCard } from '../../components/ui/Card';
import { Alert } from '../../components/ui/Alert';
import { Avatar, StatCard } from '../../components/ui/StatCard';
import { Badge, RoleBadge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Field, FormError, Input } from '../../components/ui/Field';
import { formatDateTime } from '../../lib/format';

const profileSchema = z.object({
  fullName: z.string().trim().min(2, 'Enter your full name.').max(120, 'Name is too long.'),
  phoneNumber: z
    .string()
    .trim()
    .regex(/^\+?[0-9][0-9\s\-()]{6,19}$/, 'Enter a valid phone number (7–20 digits, optional +).'),
  city: z.string().trim().min(2, 'Enter your city.').max(100, 'City is too long.'),
  area: z.string().trim().min(2, 'Enter your area.').max(120, 'Area is too long.'),
  postalCode: z.string().trim().max(16, 'Postal code is too long.').optional(),
});

type ProfileForm = z.infer<typeof profileSchema>;

export function ProfilePage() {
  const token = useAuthToken();
  const { me, refreshMe } = useAuth();
  const queryClient = useQueryClient();
  const toast = useToast();
  const [formError, setFormError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isDirty, isSubmitting },
  } = useForm<ProfileForm>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      fullName: me?.profile.fullName ?? '',
      phoneNumber: me?.profile.phoneNumber ?? '',
      city: me?.profile.city ?? '',
      area: me?.profile.area ?? '',
      postalCode: me?.profile.postalCode ?? '',
    },
  });

  useEffect(() => {
    if (!me) return;
    reset({
      fullName: me.profile.fullName,
      phoneNumber: me.profile.phoneNumber ?? '',
      city: me.profile.city ?? '',
      area: me.profile.area ?? '',
      postalCode: me.profile.postalCode ?? '',
    });
  }, [me, reset]);

  const updateProfile = useMutation({
    mutationFn: (values: ProfileForm) =>
      api.updateProfile(token, {
        fullName: values.fullName,
        phoneNumber: values.phoneNumber,
        city: values.city,
        area: values.area,
        postalCode: values.postalCode?.trim() ? values.postalCode.trim() : null,
      }),
    onSuccess: async () => {
      toast.success('Profile updated', 'Your coordination details are current.');
      await refreshMe();
      await invalidateWorkspace(queryClient);
    },
    onError: (error) => {
      const message = errorMessage(error);
      setFormError(message);
      toast.error('Could not update profile', message);
    },
  });

  if (!me) return null;

  const onSubmit = handleSubmit((values) => {
    setFormError(null);
    updateProfile.mutate(values);
  });

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Account"
        title="Profile settings"
        description="Your name and general location help requesters and hospitals coordinate. Contact details are only revealed through consented workflows."
      />

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,0.8fr)]">
        <SectionCard
          title="Coordination details"
          description="Keep these details accurate. A hospital verifier or accepted donor may use them after a request is verified or an offer accepted."
          bodyClassName="space-y-5"
        >
          <form onSubmit={onSubmit} className="space-y-5" noValidate>
            {formError ? <FormError>{formError}</FormError> : null}

            <Field label="Full name" htmlFor="fullName" required error={errors.fullName?.message}>
              <div className="relative">
                <UserRound className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-ink-400" aria-hidden="true" />
                <Input
                  id="fullName"
                  className="pl-9"
                  autoComplete="name"
                  invalid={Boolean(errors.fullName)}
                  {...register('fullName')}
                />
              </div>
            </Field>

            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Phone number" htmlFor="phoneNumber" required error={errors.phoneNumber?.message}>
                <div className="relative">
                  <Phone className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-ink-400" aria-hidden="true" />
                  <Input
                    id="phoneNumber"
                    className="pl-9"
                    inputMode="tel"
                    autoComplete="tel"
                    invalid={Boolean(errors.phoneNumber)}
                    {...register('phoneNumber')}
                  />
                </div>
              </Field>
              <Field label="Postal code" htmlFor="postalCode" optional error={errors.postalCode?.message}>
                <Input
                  id="postalCode"
                  autoComplete="postal-code"
                  invalid={Boolean(errors.postalCode)}
                  {...register('postalCode')}
                />
              </Field>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="City" htmlFor="city" required error={errors.city?.message}>
                <div className="relative">
                  <MapPin className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-ink-400" aria-hidden="true" />
                  <Input
                    id="city"
                    className="pl-9"
                    autoComplete="address-level2"
                    invalid={Boolean(errors.city)}
                    {...register('city')}
                  />
                </div>
              </Field>
              <Field label="Area" htmlFor="area" required error={errors.area?.message}>
                <Input
                  id="area"
                  autoComplete="address-level3"
                  invalid={Boolean(errors.area)}
                  {...register('area')}
                />
              </Field>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2 border-t border-ink-100 pt-4">
              <p className="text-xs text-ink-400">
                {isDirty ? 'You have unsaved changes.' : 'All changes saved.'}
              </p>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="ghost"
                  disabled={!isDirty || isSubmitting}
                  onClick={() => reset()}
                >
                  Reset
                </Button>
                <Button
                  type="submit"
                  isLoading={isSubmitting || updateProfile.isPending}
                  disabled={!isDirty}
                  leftIcon={<Save className="size-4" aria-hidden="true" />}
                >
                  Save profile
                </Button>
              </div>
            </div>
          </form>
        </SectionCard>

        <div className="space-y-4">
          <Card>
            <div className="flex items-center gap-3">
              <Avatar name={me.profile.fullName} size="lg" />
              <div className="min-w-0">
                <p className="truncate text-base font-semibold text-ink-900">{me.profile.fullName}</p>
                <p className="flex items-center gap-1.5 truncate text-xs text-ink-500">
                  <Mail className="size-3.5 shrink-0" aria-hidden="true" />
                  {me.user.email}
                </p>
              </div>
            </div>
            <div className="mt-4 flex flex-wrap gap-1.5">
              {me.roles.map((role) => (
                <RoleBadge key={role} role={role} />
              ))}
              <Badge tone={me.profile.accountStatus === 'ACTIVE' ? 'success' : 'danger'} dot>
                {me.profile.accountStatus === 'ACTIVE' ? 'Active account' : 'Suspended'}
              </Badge>
            </div>
            <dl className="mt-4 space-y-2 border-t border-ink-100 pt-4 text-xs">
              <div className="flex justify-between gap-3">
                <dt className="text-ink-500">Member since</dt>
                <dd className="font-medium text-ink-800">{formatDateTime(me.profile.createdAt)}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-ink-500">Last updated</dt>
                <dd className="font-medium text-ink-800">{formatDateTime(me.profile.updatedAt)}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-ink-500">Profile complete</dt>
                <dd className="font-medium text-ink-800">{me.profileComplete ? 'Yes' : 'No'}</dd>
              </div>
            </dl>
          </Card>

          <SectionCard
            title="Donor profile"
            description="Donor settings are separate from your coordination profile."
            actions={
              <Link to="/app/donor" className="text-sm font-semibold text-brand-700 hover:text-brand-800">
                Manage
              </Link>
            }
          >
            {me.donorProfile ? (
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <span className="flex size-12 items-center justify-center rounded-xl border border-brand-200 bg-brand-50 text-lg font-bold text-brand-800">
                    {me.donorProfile.bloodGroup}
                  </span>
                  <div>
                    <p className="text-sm font-semibold text-ink-900">
                      {me.donorProfile.isAvailable ? 'Available to donate' : 'Availability paused'}
                    </p>
                    <p className="text-xs text-ink-500">
                      {me.donorProfile.consentToContact
                        ? 'Consent to contact after acceptance'
                        : 'Contact sharing disabled'}
                    </p>
                  </div>
                </div>
                <p className="text-xs leading-relaxed text-ink-500">
                  Donor coordinates are optional, never shown to other users, and used only for
                  consented distance ranking.
                </p>
              </div>
            ) : (
              <div className="rounded-xl border border-dashed border-ink-300 bg-ink-50 p-4 text-center">
                <Droplet className="mx-auto size-6 text-ink-400" aria-hidden="true" />
                <p className="mt-2 text-sm font-medium text-ink-800">No donor profile yet</p>
                <p className="mt-1 text-xs text-ink-500">
                  Add your blood group and availability to see relevant verified requests.
                </p>
                <Link to="/app/donor" className="mt-3 inline-flex text-xs font-semibold text-brand-700 hover:text-brand-800">
                  Create donor profile
                </Link>
              </div>
            )}
          </SectionCard>

          <SectionCard
            title="Hospital verification"
            description="Institutional verifier access is granted only after administrator review."
            actions={
              <Link
                to="/app/hospital/application"
                className="text-sm font-semibold text-brand-700 hover:text-brand-800"
              >
                Open
              </Link>
            }
          >
            {me.hospitalProfile ? (
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Building2 className="size-4 text-ink-400" aria-hidden="true" />
                  <p className="text-sm font-semibold text-ink-900">
                    {me.hospitalProfile.hospitalName}
                  </p>
                </div>
                <Badge
                  tone={
                    me.hospitalProfile.verificationStatus === 'APPROVED'
                      ? 'success'
                      : me.hospitalProfile.verificationStatus === 'PENDING'
                        ? 'warning'
                        : 'danger'
                  }
                  dot
                >
                  {me.hospitalProfile.verificationStatus}
                </Badge>
                {me.hospitalProfile.reviewReason ? (
                  <p className="text-xs leading-relaxed text-ink-500">
                    Review note: {me.hospitalProfile.reviewReason}
                  </p>
                ) : null}
              </div>
            ) : (
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm text-ink-600">
                  <ShieldCheck className="size-4 text-ink-400" aria-hidden="true" />
                  No hospital application
                </div>
                <p className="text-xs leading-relaxed text-ink-500">
                  Hospitals and blood banks can apply with registration details after creating a
                  normal account.
                </p>
              </div>
            )}
          </SectionCard>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <StatCard
          label="Roles"
          value={me.roles.length}
          hint={me.roles.map((role) => role.toLowerCase()).join(', ')}
          icon={<UserRound className="size-4" aria-hidden="true" />}
          tone="neutral"
        />
        <StatCard
          label="Unread notifications"
          value={me.unreadNotifications}
          icon={<CheckCircle2 className="size-4" aria-hidden="true" />}
          tone={me.unreadNotifications > 0 ? 'warning' : 'success'}
        />
        <StatCard
          label="Verified verifier"
          value={me.permissions.isApprovedVerifier ? 'Yes' : 'No'}
          hint="Approved hospital accounts can review requests."
          icon={<ShieldCheck className="size-4" aria-hidden="true" />}
          tone={me.permissions.isApprovedVerifier ? 'success' : 'neutral'}
        />
      </div>

      <Alert variant="neutral" title="Contact visibility">
        Your phone number is not shown in public pages or the donor feed. Requesters see donor
        contact only when the donor consented and the offer is accepted. Donors see requester
        contact only when the requester consented and the offer is accepted.
      </Alert>
    </div>
  );
}
