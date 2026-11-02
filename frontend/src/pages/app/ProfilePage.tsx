import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Building2,
  CheckCircle2,
  Download,
  Droplet,
  KeyRound,
  Lock,
  Mail,
  MapPin,
  Monitor,
  Moon,
  Phone,
  Save,
  ShieldCheck,
  Sun,
  Trash2,
  UserRound,
} from 'lucide-react';
import { useAuth, useAuthToken } from '../../context/AuthContext';
import { useTheme, type ThemePreference } from '../../context/ThemeContext';
import { api, errorMessage } from '../../lib/api';
import { invalidateWorkspace } from '../../lib/invalidate';
import { useToast } from '../../context/ToastContext';
import { PageHeader } from '../../components/ui/PageHeader';
import { Card, SectionCard } from '../../components/ui/Card';
import { Alert } from '../../components/ui/Alert';
import { Avatar, StatCard } from '../../components/ui/StatCard';
import { Badge, RoleBadge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Field, FormError, Input, PasswordInput } from '../../components/ui/Field';
import { formatDateTime } from '../../lib/format';
import { useUnsavedChangesWarning } from '../../lib/useUnsavedChangesWarning';
import type { Profile } from '../../types/api';
import { cn } from '../../lib/cn';
import { Modal } from '../../components/ui/Modal';

const themeOptions: Array<{ value: ThemePreference; label: string; Icon: typeof Sun }> = [
  { value: 'light', label: 'Light', Icon: Sun },
  { value: 'dark', label: 'Dark', Icon: Moon },
  { value: 'system', label: 'System', Icon: Monitor },
];

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

function formFromProfile(profile: Profile): ProfileForm {
  return {
    fullName: profile.fullName,
    phoneNumber: profile.phoneNumber ?? '',
    city: profile.city ?? '',
    area: profile.area ?? '',
    postalCode: profile.postalCode ?? '',
  };
}

export function ProfilePage() {
  const token = useAuthToken();
  const { me, refreshMe, updatePassword, reauthenticate, signOut } = useAuth();
  const { theme, resolvedTheme, setTheme } = useTheme();
  const queryClient = useQueryClient();
  const toast = useToast();
  const [formError, setFormError] = useState<string | null>(null);
  const [closeAccountOpen, setCloseAccountOpen] = useState(false);
  const [closePassword, setClosePassword] = useState('');
  const [closeConfirmation, setCloseConfirmation] = useState('');
  const [closeAccountError, setCloseAccountError] = useState<string | null>(null);
  const [isClosingAccount, setIsClosingAccount] = useState(false);

  // Password update state
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [isUpdatingPassword, setIsUpdatingPassword] = useState(false);

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

  const initialisedProfile = useRef<string | null>(null);

  // Refresh the form when the server profile changes, but never discard edits
  // that the user has not saved yet.
  useEffect(() => {
    if (!me) return;
    const signature = me.profile.updatedAt;
    if (initialisedProfile.current === null) {
      reset(formFromProfile(me.profile));
      initialisedProfile.current = signature;
      return;
    }
    if (signature !== initialisedProfile.current && !isDirty) {
      reset(formFromProfile(me.profile));
      initialisedProfile.current = signature;
    }
  }, [me, reset, isDirty]);

  useUnsavedChangesWarning(isDirty);

  const updateProfile = useMutation({
    mutationFn: (values: ProfileForm) =>
      api.updateProfile(token, {
        fullName: values.fullName,
        phoneNumber: values.phoneNumber,
        city: values.city,
        area: values.area,
        postalCode: values.postalCode?.trim() ? values.postalCode.trim() : null,
      }),
    onSuccess: async (profile) => {
      setFormError(null);
      reset(formFromProfile(profile));
      initialisedProfile.current = profile.updatedAt;
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

  const updateEmailNotifications = useMutation({
    mutationFn: (enabled: boolean) => api.updateEmailNotifications(token, enabled),
    onSuccess: async ({ enabled }) => {
      await refreshMe();
      toast.success(
        enabled ? 'Email alerts enabled' : 'Email alerts disabled',
        enabled
          ? 'New notifications will be emailed without request or health details.'
          : 'Pending email alerts have been cancelled.',
      );
    },
    onError: (error) => {
      const message = errorMessage(error);
      toast.error('Could not update email alerts', message);
    },
  });

  if (!me) return null;

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordError(null);
    if (!newPassword || newPassword.length < 8) {
      setPasswordError('New password must be at least 8 characters.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordError('Passwords do not match.');
      return;
    }
    setIsUpdatingPassword(true);
    try {
      await updatePassword(newPassword);
      toast.success('Password changed', 'Your account credentials have been updated.');
      setNewPassword('');
      setConfirmPassword('');
    } catch (cause) {
      const msg = errorMessage(cause);
      setPasswordError(msg);
      toast.error('Failed to update password', msg);
    } finally {
      setIsUpdatingPassword(false);
    }
  };

  const handleExportData = () => {
    const exportPayload = {
      exportedAt: new Date().toISOString(),
      account: {
        userId: me.user.id,
        email: me.user.email,
        roles: me.roles,
        permissions: me.permissions,
      },
      profile: me.profile,
      donorProfile: me.donorProfile,
      hospitalProfile: me.hospitalProfile,
    };

    const blob = new Blob([JSON.stringify(exportPayload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `bloodbridge-account-export-${me.user.id.slice(0, 8)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast.info('Account data exported', 'Your account and profile details have been downloaded.');
  };

  const handleCloseAccount = async (event: React.FormEvent) => {
    event.preventDefault();
    setCloseAccountError(null);
    setIsClosingAccount(true);
    try {
      const recentToken = await reauthenticate(closePassword);
      await api.anonymizeAccount(recentToken);
      await signOut();
    } catch (cause) {
      setCloseAccountError(errorMessage(cause));
    } finally {
      setIsClosingAccount(false);
    }
  };

  const onSubmit = handleSubmit((values) => {
    setFormError(null);
    updateProfile.mutate(values);
  });

  const missingProfileFields = [
    !me.profile.fullName.trim() ? 'full name' : null,
    !me.profile.phoneNumber ? 'phone number' : null,
    !me.profile.city ? 'city' : null,
    !me.profile.area ? 'area' : null,
  ].filter(Boolean) as string[];

  const saveState = formError
    ? { text: 'Save failed. Your edits are still here.', className: 'text-brand-accent' }
    : isSubmitting || updateProfile.isPending
      ? { text: 'Saving your changes…', className: 'text-ink-500' }
      : updateProfile.isSuccess && !isDirty
        ? { text: 'Profile saved.', className: 'text-accent-700' }
        : isDirty
          ? { text: 'You have unsaved changes.', className: 'text-amber-700' }
          : { text: 'No unsaved changes.', className: 'text-ink-500' };

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Account"
        title="Profile settings"
        description="Your name and general location help requesters and hospitals coordinate. Contact details are only revealed through consented workflows."
      />

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,0.8fr)]">
        <SectionCard
          title="Coordination details"
          description="Keep these details accurate. A hospital verifier or accepted donor may use them after a request is verified or an offer accepted."
          bodyClassName="space-y-5"
        >
          {!me.profileComplete ? (
            <Alert variant="info" title="Required profile details are incomplete">
              Add your {missingProfileFields.join(', ')} to complete your coordination profile.
              Postal code is optional.
            </Alert>
          ) : null}
          <form onSubmit={onSubmit} className="space-y-5" noValidate>
            {formError ? <FormError>{formError}</FormError> : null}

            <Field label="Full name" htmlFor="fullName" required error={errors.fullName?.message}>
              <div className="relative">
                <UserRound className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-ink-500" aria-hidden="true" />
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
                  <Phone className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-ink-500" aria-hidden="true" />
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
                  <MapPin className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-ink-500" aria-hidden="true" />
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
              <p className={cn('text-xs font-medium', saveState.className)} aria-live="polite">
                {saveState.text}
              </p>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="ghost"
                  disabled={!isDirty || isSubmitting}
                  onClick={() => {
                    if (!window.confirm('Discard your unsaved profile changes?')) return;
                    setFormError(null);
                    reset();
                  }}
                >
                  Reset
                </Button>
                <Button
                  type="submit"
                  isLoading={isSubmitting || updateProfile.isPending}
                  disabled={!isDirty || updateProfile.isPending}
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
              <Link to="/app/donor" className="inline-flex min-h-11 items-center text-sm font-semibold text-brand-accent hover:text-brand-accent-strong">
                Manage
              </Link>
            }
          >
            {me.donorProfile ? (
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <span className="flex size-12 items-center justify-center rounded-xl border border-brand-200 bg-brand-50 text-lg font-bold text-brand-accent">
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
                <Droplet className="mx-auto size-6 text-ink-500" aria-hidden="true" />
                <p className="mt-2 text-sm font-medium text-ink-800">No donor profile yet</p>
                <p className="mt-1 text-xs text-ink-500">
                  Add your blood group and availability to see relevant verified requests.
                </p>
                <Link to="/app/donor" className="mt-2 inline-flex min-h-11 items-center text-xs font-semibold text-brand-accent hover:text-brand-accent-strong">
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
                className="inline-flex min-h-11 items-center text-sm font-semibold text-brand-accent hover:text-brand-accent-strong"
              >
                Open
              </Link>
            }
          >
            {me.hospitalProfile ? (
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Building2 className="size-4 text-ink-500" aria-hidden="true" />
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
                  <ShieldCheck className="size-4 text-ink-500" aria-hidden="true" />
                  No hospital application
                </div>
                <p className="text-xs leading-relaxed text-ink-500">
                  Hospitals and blood banks can apply with registration details after creating a
                  normal account.
                </p>
              </div>
            )}
          </SectionCard>

          <SectionCard
            title="Appearance"
            description="Choose how BloodBridge looks on this device."
            bodyClassName="space-y-3"
          >
            <div role="radiogroup" aria-label="Theme" className="grid grid-cols-3 gap-2">
              {themeOptions.map(({ value, label, Icon }) => {
                const selected = theme === value;
                return (
                  <button
                    key={value}
                    type="button"
                    role="radio"
                    aria-checked={selected}
                    onClick={() => setTheme(value)}
                    className={cn(
                      'flex min-h-11 flex-col items-center justify-center gap-1.5 rounded-xl border px-2 py-3 text-xs font-semibold transition',
                      selected
                        ? 'border-brand-400 bg-brand-50 text-brand-accent ring-1 ring-focus-ring/40'
                        : 'border-ink-200 bg-surface-raised text-ink-600 hover:border-ink-300 hover:text-ink-900',
                    )}
                  >
                    <Icon className="size-4" aria-hidden="true" />
                    {label}
                  </button>
                );
              })}
            </div>
            <p className="text-xs leading-relaxed text-ink-500">
              {theme === 'system'
                ? `Following your system setting — currently ${resolvedTheme} mode.`
                : `Using ${theme} mode. Your choice is saved in this browser.`}
            </p>
          </SectionCard>

          <SectionCard
            title="Email alerts"
            description="Optional email notices never include request or health details."
            bodyClassName="space-y-3"
          >
            <label className="flex items-start gap-3 text-sm text-ink-700">
              <input
                type="checkbox"
                checked={me.emailNotificationsEnabled}
                disabled={
                  updateEmailNotifications.isPending ||
                  (!me.emailNotificationsAvailable && !me.emailNotificationsEnabled)
                }
                onChange={(event) => updateEmailNotifications.mutate(event.target.checked)}
                className="mt-0.5 size-4 rounded border-ink-300 text-brand-accent focus:ring-focus-ring"
              />
              <span>
                <span className="block font-semibold text-ink-900">Send email alerts</span>
                <span className="mt-1 block text-xs leading-relaxed text-ink-500">
                  You can turn these off at any time. In-app notifications remain available.
                </span>
              </span>
            </label>
            {!me.emailNotificationsAvailable ? (
              <p className="text-xs leading-relaxed text-ink-500">
                Email delivery is not configured by this deployment. You may still turn off an
                existing preference; new alerts cannot be enabled.
              </p>
            ) : null}
            {updateEmailNotifications.isError ? (
              <p role="alert" className="text-xs text-brand-accent">
                The preference could not be saved. Your previous setting is unchanged.
              </p>
            ) : null}
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

      <div className="grid gap-6 lg:grid-cols-2">
        <SectionCard
          title="Account security"
          description="Update your sign-in password to keep your account safe."
          bodyClassName="space-y-4"
        >
          <form onSubmit={handleUpdatePassword} className="space-y-4" noValidate>
            {passwordError ? <FormError>{passwordError}</FormError> : null}
            <Field label="New password" htmlFor="new-password" required>
              <PasswordInput
                id="new-password"
                autoComplete="new-password"
                placeholder="At least 8 characters"
                leadingIcon={<Lock className="size-4" aria-hidden="true" />}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
              />
            </Field>
            <Field label="Confirm new password" htmlFor="confirm-new-password" required>
              <PasswordInput
                id="confirm-new-password"
                autoComplete="new-password"
                placeholder="Repeat new password"
                leadingIcon={<Lock className="size-4" aria-hidden="true" />}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
              />
            </Field>
            <Button
              type="submit"
              variant="secondary"
              size="md"
              isLoading={isUpdatingPassword}
              disabled={!newPassword || !confirmPassword}
              leftIcon={<KeyRound className="size-4" />}
            >
              Update password
            </Button>
          </form>
        </SectionCard>

        <SectionCard
          title="Data privacy & export"
          description="You can download your personal data stored within BloodBridge at any time."
          bodyClassName="space-y-4"
        >
          <p className="text-sm leading-relaxed text-ink-600">
            BloodBridge follows strict data minimization. Your coordination information is only
            shared when an active request or offer is explicitly verified and accepted.
          </p>
          <div className="rounded-xl border border-ink-200 bg-ink-50 p-4 text-xs text-ink-600 space-y-1">
            <p><strong>Database:</strong> Profiles, roles, donor preferences and responses.</p>
            <p><strong>Audit anchor:</strong> only a random opaque audit key. No personal data is written on-chain.</p>
          </div>
          <div className="pt-1">
            <Button
              type="button"
              variant="secondary"
              size="md"
              onClick={handleExportData}
              leftIcon={<Download className="size-4" />}
            >
              Export account data (JSON)
            </Button>
          </div>
        </SectionCard>
      </div>

      <Alert variant="neutral" title="Contact visibility">
        Your phone number is not shown in public pages or the donor feed. Requesters see donor
        contact only when the donor consented and the offer is accepted. Donors see requester
        contact only when the requester consented and the offer is accepted.
      </Alert>

      <SectionCard
        title="Close account"
        description="Anonymize your BloodBridge profile and disable sign-in. Request and audit history is retained in anonymized form."
        bodyClassName="space-y-3"
      >
        <p className="text-sm leading-relaxed text-ink-600">
          Open requests will be cancelled and contact details, donor settings, hospital application
          details, wallet bindings, and notifications will be removed. This action cannot be undone.
        </p>
        <Button
          type="button"
          variant="danger"
          leftIcon={<Trash2 className="size-4" aria-hidden="true" />}
          onClick={() => {
            setCloseAccountError(null);
            setCloseAccountOpen(true);
          }}
        >
          Close my account
        </Button>
      </SectionCard>

      <Modal
        open={closeAccountOpen}
        onClose={() => setCloseAccountOpen(false)}
        title="Close your account?"
        description="This permanently anonymizes your BloodBridge profile and disables sign-in."
        footer={
          <>
            <Button
              type="button"
              variant="secondary"
              onClick={() => setCloseAccountOpen(false)}
              disabled={isClosingAccount}
            >
              Keep account
            </Button>
            <Button
              type="submit"
              form="close-account-form"
              variant="danger"
              isLoading={isClosingAccount}
              disabled={closeConfirmation !== 'DELETE' || !closePassword}
            >
              Close account
            </Button>
          </>
        }
      >
        <form id="close-account-form" onSubmit={handleCloseAccount} className="space-y-4">
          <Alert variant="warning" title="This cannot be undone">
            Active requests will be cancelled. Request and audit records needed for network integrity
            will remain without your direct contact details. The Supabase login record is retained with
            sign-in disabled and a non-deliverable email; this does not delete any external identity-provider account.
          </Alert>
          {closeAccountError ? <FormError>{closeAccountError}</FormError> : null}
          <Field label="Current password" htmlFor="close-account-password" required>
            <PasswordInput
              id="close-account-password"
              autoComplete="current-password"
              value={closePassword}
              onChange={(event) => setClosePassword(event.target.value)}
            />
          </Field>
          <Field label="Type DELETE to confirm" htmlFor="close-account-confirmation" required>
            <Input
              id="close-account-confirmation"
              autoComplete="off"
              value={closeConfirmation}
              onChange={(event) => setCloseConfirmation(event.target.value)}
            />
          </Field>
        </form>
      </Modal>
    </div>
  );
}
