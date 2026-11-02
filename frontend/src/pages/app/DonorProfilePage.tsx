import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Check,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Droplet,
  Info,
  Lock,
  MapPin,
  PauseCircle,
  PlayCircle,
  Save,
  ShieldCheck,
} from 'lucide-react';
import { useAuth, useAuthToken } from '../../context/AuthContext';
import { api, errorMessage } from '../../lib/api';
import { bloodGroupOptions, matchingNotice } from '../../lib/constants';
import { invalidateWorkspace } from '../../lib/invalidate';
import { useToast } from '../../context/ToastContext';
import { PageHeader } from '../../components/ui/PageHeader';
import { Card, SectionCard } from '../../components/ui/Card';
import { Alert } from '../../components/ui/Alert';
import { Button } from '../../components/ui/Button';
import { Checkbox, Field, FormError, Input, Switch } from '../../components/ui/Field';
import { formatDateTime } from '../../lib/format';
import {
  donorFormFromProfile,
  donorProfileSchema,
  toDonorProfileInput,
  type DonorProfileFormValues,
} from '../../lib/donorProfile';
import { useUnsavedChangesWarning } from '../../lib/useUnsavedChangesWarning';
import { cn } from '../../lib/cn';

const steps = [
  { id: 'blood-group', title: 'Blood group', hint: 'Required for exact matching' },
  { id: 'availability', title: 'Availability', hint: 'Off by default' },
  { id: 'contact', title: 'Contact consent', hint: 'Your explicit choice' },
  { id: 'location', title: 'Location', hint: 'Optional' },
  { id: 'review', title: 'Privacy & review', hint: 'Confirm before saving' },
] as const;

const stepFields: Array<Array<keyof DonorProfileFormValues>> = [
  ['bloodGroup'],
  ['isAvailable'],
  ['consentToContact'],
  ['shareApproximateLocation', 'latitude', 'longitude'],
  ['privacyAccepted'],
];

export function DonorProfilePage() {
  const token = useAuthToken();
  const { me, refreshMe } = useAuth();
  const queryClient = useQueryClient();
  const toast = useToast();
  const [formError, setFormError] = useState<string | null>(null);
  const [step, setStep] = useState(0);
  const initialisedProfile = useRef<string | null>(null);
  const stepHeadingRef = useRef<HTMLHeadingElement | null>(null);

  const existing = me?.donorProfile ?? null;

  const {
    register,
    handleSubmit,
    reset,
    watch,
    setValue,
    setError,
    trigger,
    formState: { errors, isSubmitting, isDirty },
  } = useForm<DonorProfileFormValues>({
    resolver: zodResolver(donorProfileSchema),
    defaultValues: donorFormFromProfile(existing),
  });

  // Load saved preferences exactly once, then only refresh them after a save or
  // when the profile changes while the form has no unsaved edits. This prevents
  // an unrelated `me` refresh from discarding a half-completed edit.
  useEffect(() => {
    if (!me) return;
    const signature = me.donorProfile?.updatedAt ?? 'none';
    if (initialisedProfile.current === null) {
      reset(donorFormFromProfile(me.donorProfile));
      initialisedProfile.current = signature;
      return;
    }
    if (signature !== initialisedProfile.current && !isDirty) {
      reset(donorFormFromProfile(me.donorProfile));
      initialisedProfile.current = signature;
    }
  }, [me, reset, isDirty]);

  useUnsavedChangesWarning(isDirty);

  const saveProfile = useMutation({
    mutationFn: (values: DonorProfileFormValues) =>
      api.saveDonorProfile(token, toDonorProfileInput(donorProfileSchema.parse(values))),
    onSuccess: async (profile) => {
      setFormError(null);
      reset(donorFormFromProfile(profile));
      initialisedProfile.current = profile.updatedAt;
      toast.success(
        existing ? 'Donor profile updated' : 'Donor profile created',
        `You are ${profile.isAvailable ? 'available' : 'paused'} for ${profile.bloodGroup}. Contact sharing is ${
          profile.consentToContact ? 'enabled' : 'off'
        }.`,
      );
      await refreshMe();
      await invalidateWorkspace(queryClient);
    },
    onError: (error) => {
      const message = errorMessage(error);
      setFormError(message);
      toast.error('Could not save donor profile', message);
    },
  });

  const availability = useMutation({
    mutationFn: (next: boolean) => api.setAvailability(token, next),
    onSuccess: async (profile) => {
      toast.success(
        profile.isAvailable ? 'You are available' : 'Availability paused',
        profile.isAvailable
          ? 'Verified requests for your exact recorded blood group can now receive your offer.'
          : 'You will not appear as an available candidate until you resume. Existing offers and history are kept.',
      );
      if (!isDirty) {
        reset(donorFormFromProfile(profile));
        initialisedProfile.current = profile.updatedAt;
      }
      await refreshMe();
      await invalidateWorkspace(queryClient);
    },
    onError: (error) => toast.error('Could not update availability', errorMessage(error)),
  });

  if (!me) return null;

  const values = watch();
  const consentToContact = values.consentToContact;
  const saving = isSubmitting || saveProfile.isPending;

  const goNext = async () => {
    const valid = await trigger(stepFields[step] ?? []);
    if (!valid) return;
    setStep((value) => Math.min(value + 1, steps.length - 1));
    window.setTimeout(() => stepHeadingRef.current?.focus(), 0);
  };

  const goBack = () => {
    setStep((value) => Math.max(value - 1, 0));
    window.setTimeout(() => stepHeadingRef.current?.focus(), 0);
  };

  const onSubmit = handleSubmit((formValues) => {
    setFormError(null);
    if (!formValues.privacyAccepted) {
      setStep(steps.length - 1);
      setError('privacyAccepted', {
        message: 'Acknowledge the donor privacy information before creating a profile.',
      });
      return;
    }
    saveProfile.mutate(formValues);
  });

  const saveState = formError
    ? { text: 'Save failed. Your edits are still here.', tone: 'danger' as const }
    : saving
      ? { text: 'Saving your choices…', tone: 'neutral' as const }
      : saveProfile.isSuccess && !isDirty
        ? { text: 'Donor settings saved.', tone: 'success' as const }
        : isDirty
          ? { text: 'You have unsaved changes.', tone: 'warning' as const }
          : { text: 'No unsaved changes.', tone: 'neutral' as const };

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Donor"
        title={existing ? 'Donor profile' : 'Become a donor'}
        description="Every choice here is optional and reversible. Availability, contact sharing and location are separate consents — none are enabled by default for a new donor."
        actions={
          existing ? (
            <Button
              variant={existing.isAvailable ? 'secondary' : 'primary'}
              isLoading={availability.isPending}
              onClick={() => availability.mutate(!existing.isAvailable)}
              leftIcon={
                existing.isAvailable ? (
                  <PauseCircle className="size-4" aria-hidden="true" />
                ) : (
                  <PlayCircle className="size-4" aria-hidden="true" />
                )
              }
            >
              {existing.isAvailable ? 'Pause availability' : 'Resume availability'}
            </Button>
          ) : undefined
        }
      />

      {existing ? (
        <div className="grid gap-3 sm:grid-cols-3">
          <Card className="flex items-center gap-3">
            <span className="flex size-12 items-center justify-center rounded-xl border border-brand-200 bg-brand-50 text-lg font-bold text-brand-accent dark:border-brand-800 dark:bg-brand-950/60">
              {existing.bloodGroup}
            </span>
            <div>
              <p className="text-sm font-semibold text-ink-900">Recorded blood group</p>
              <p className="text-xs text-ink-500">Exact-match feeding only</p>
            </div>
          </Card>
          <Card className="flex items-center gap-3">
            <span
              className={cn(
                'flex size-10 items-center justify-center rounded-lg',
                existing.isAvailable ? 'bg-accent-50 text-accent-700' : 'bg-ink-100 text-ink-500',
              )}
            >
              {existing.isAvailable ? (
                <CheckCircle2 className="size-5" aria-hidden="true" />
              ) : (
                <PauseCircle className="size-5" aria-hidden="true" />
              )}
            </span>
            <div>
              <p className="text-sm font-semibold text-ink-900">
                {existing.isAvailable ? 'Available' : 'Paused'}
              </p>
              <p className="text-xs text-ink-500">Offer eligibility</p>
            </div>
          </Card>
          <Card className="flex items-center gap-3">
            <span className="flex size-10 items-center justify-center rounded-lg bg-ink-100 text-ink-600">
              <ShieldCheck className="size-5" aria-hidden="true" />
            </span>
            <div>
              <p className="text-sm font-semibold text-ink-900">
                {existing.consentToContact ? 'Contact on acceptance' : 'Contact protected'}
              </p>
              <p className="text-xs text-ink-500">No public exposure</p>
            </div>
          </Card>
        </div>
      ) : (
        <Alert variant="info" title="Nothing is enabled until you choose it">
          Creating a donor profile does not make you available and does not share your phone number.
          A donor offer is a coordination request, not a medical commitment. Hospital screening and
          eligibility checks still apply.
        </Alert>
      )}

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,0.8fr)]">
        <SectionCard
          title={existing ? 'Donor settings' : 'Create your donor profile'}
          description="Your exact recorded blood group is used for the feed and response rules. Changing it affects which requests you can see and answer."
          bodyClassName="space-y-5"
        >
          <form onSubmit={onSubmit} noValidate className="space-y-5">
            {formError ? <FormError>{formError}</FormError> : null}

            <nav aria-label="Donor profile steps">
              <ol className="grid gap-2 sm:grid-cols-5">
                {steps.map((item, index) => {
                  const current = index === step;
                  const complete = index < step;
                  return (
                    <li key={item.id}>
                      <button
                        type="button"
                        onClick={() => {
                          if (index <= step) setStep(index);
                        }}
                        disabled={index > step}
                        aria-current={current ? 'step' : undefined}
                        className={cn(
                          'flex min-h-11 w-full items-center gap-2 rounded-lg border px-2.5 py-2 text-left transition',
                          current
                            ? 'border-brand-300 bg-brand-50 text-brand-accent'
                            : complete
                              ? 'border-ink-200 bg-surface-raised text-ink-700 hover:border-ink-300'
                              : 'border-ink-100 bg-ink-50/40 text-ink-400',
                        )}
                      >
                        <span
                          className={cn(
                            'flex size-5 shrink-0 items-center justify-center rounded-full text-[0.625rem] font-bold',
                            current
                              ? 'bg-brand-700 text-white'
                              : complete
                                ? 'bg-accent-600 text-white'
                                : 'bg-ink-200 text-ink-600',
                          )}
                        >
                          {complete ? <Check className="size-3" aria-hidden="true" /> : index + 1}
                        </span>
                        <span className="min-w-0">
                          <span className="block truncate text-[0.75rem] font-semibold">
                            {item.title}
                          </span>
                          <span className="hidden text-[0.625rem] text-ink-500 sm:block">
                            {item.hint}
                          </span>
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ol>
            </nav>

            <div
              className={cn(
                'space-y-5 rounded-xl border border-ink-200 bg-surface-raised p-4 sm:p-5',
                step === 0 ? 'block' : 'hidden',
              )}
            >
              <h2
                ref={stepHeadingRef}
                tabIndex={-1}
                className="text-base font-semibold text-ink-900 focus:outline-none"
              >
                Which blood group should we record?
              </h2>
              <p className="text-sm leading-relaxed text-ink-600">
                There is no default. Choose the group you want stored for exact-match requests. This
                application does not calculate medical compatibility.
              </p>
              <fieldset>
                <legend className="sr-only">Blood group</legend>
                {!values.bloodGroup ? (
                  <p className="mb-2 text-xs font-medium text-ink-600">Select your blood group</p>
                ) : null}
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                  {bloodGroupOptions.map((option) => {
                    const selected = values.bloodGroup === option.value;
                    return (
                      <label
                        key={option.value}
                        className={cn(
                          'flex min-h-14 cursor-pointer flex-col items-center justify-center rounded-xl border px-2 py-2 text-center transition has-[:focus-visible]:border-brand-500 has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-focus-ring/50',
                          selected
                            ? 'border-brand-400 bg-brand-50 text-brand-accent ring-1 ring-focus-ring/40'
                            : 'border-ink-200 bg-surface-raised text-ink-700 hover:border-ink-300',
                        )}
                      >
                        <input
                          type="radio"
                          className="sr-only"
                          value={option.value}
                          checked={selected}
                          {...register('bloodGroup')}
                        />
                        <span className="text-base font-bold">{option.value}</span>
                        <span className="mt-0.5 text-[0.625rem] text-ink-500">{option.label}</span>
                      </label>
                    );
                  })}
                </div>
              </fieldset>
              {errors.bloodGroup?.message ? (
                <p className="text-xs font-medium text-brand-accent" role="alert">
                  {errors.bloodGroup.message}
                </p>
              ) : null}
              <p className="flex items-start gap-2 rounded-lg border border-ink-200 bg-ink-50/60 px-3 py-2.5 text-xs leading-relaxed text-ink-600">
                <Info className="mt-0.5 size-3.5 shrink-0 text-ink-500" aria-hidden="true" />
                Only requests for your exact recorded group appear in your feed. Missing or invalid
                groups are rejected by the backend and never treated as a match.
              </p>
            </div>

            <div
              className={cn(
                'space-y-4 rounded-xl border border-ink-200 bg-surface-raised p-4 sm:p-5',
                step === 1 ? 'block' : 'hidden',
              )}
            >
              <h2
                ref={step === 1 ? stepHeadingRef : undefined}
                tabIndex={-1}
                className="text-base font-semibold text-ink-900 focus:outline-none"
              >
                Do you want to be available?
              </h2>
              <p className="text-sm leading-relaxed text-ink-600">
                Availability is off for new profiles. Turning it on means you are willing to receive
                relevant coordination offers for your recorded blood group. It is not a medical
                commitment and can be paused at any time.
              </p>
              <div className="rounded-xl border border-ink-200 bg-ink-50/60 p-4">
                <Switch
                  id="isAvailable"
                  checked={Boolean(values.isAvailable)}
                  onChange={(checked) => setValue('isAvailable', checked, { shouldDirty: true })}
                  label={values.isAvailable ? 'Available to consider requests' : 'Currently unavailable'}
                  description={
                    values.isAvailable
                      ? 'Your profile may be included in matching for verified requests with your exact blood group.'
                      : 'Your profile is saved but will not appear as an available donor. You can turn this on whenever you choose.'
                  }
                />
              </div>
              <p className="text-xs leading-relaxed text-ink-500">
                Pausing does not delete your profile, past offers or response history.
              </p>
            </div>

            <div
              className={cn(
                'space-y-4 rounded-xl border border-ink-200 bg-surface-raised p-4 sm:p-5',
                step === 2 ? 'block' : 'hidden',
              )}
            >
              <h2
                ref={step === 2 ? stepHeadingRef : undefined}
                tabIndex={-1}
                className="text-base font-semibold text-ink-900 focus:outline-none"
              >
                May we share your phone number after an accepted offer?
              </h2>
              <p className="text-sm leading-relaxed text-ink-600">
                This is a separate permission from availability. A requester or hospital sees your
                phone number only when your offer is accepted and this consent is active.
              </p>
              <fieldset className="space-y-2">
                <legend className="sr-only">Contact-sharing consent</legend>
                <label
                  className={cn(
                    'flex cursor-pointer items-start gap-3 rounded-xl border p-3.5 transition',
                    consentToContact === true
                      ? 'border-brand-300 bg-brand-50/70'
                      : 'border-ink-200 hover:border-ink-300',
                  )}
                >
                  <input
                    type="radio"
                    className="mt-1 size-4 accent-brand-700"
                    checked={consentToContact === true}
                    onChange={() => setValue('consentToContact', true, { shouldDirty: true })}
                  />
                  <span>
                    <span className="block text-sm font-semibold text-ink-900">
                      Allow contact after acceptance
                    </span>
                    <span className="mt-0.5 block text-xs leading-relaxed text-ink-500">
                      My phone number may be shared with the requester or hospital only after an
                      eligible offer is accepted.
                    </span>
                  </span>
                </label>
                <label
                  className={cn(
                    'flex cursor-pointer items-start gap-3 rounded-xl border p-3.5 transition',
                    consentToContact === false
                      ? 'border-ink-300 bg-ink-50/70'
                      : 'border-ink-200 hover:border-ink-300',
                  )}
                >
                  <input
                    type="radio"
                    className="mt-1 size-4 accent-brand-700"
                    checked={consentToContact === false}
                    onChange={() => {
                      setValue('consentToContact', false, { shouldDirty: true });
                    }}
                  />
                  <span>
                    <span className="flex items-center gap-1.5 text-sm font-semibold text-ink-900">
                      <Lock className="size-3.5" aria-hidden="true" />
                      Keep my phone number private
                    </span>
                    <span className="mt-0.5 block text-xs leading-relaxed text-ink-500">
                      Your profile can still exist, but your phone number will not be shared through
                      the request workflow.
                    </span>
                  </span>
                </label>
              </fieldset>
              {errors.consentToContact?.message ? (
                <p className="text-xs font-medium text-brand-accent" role="alert">
                  {errors.consentToContact.message}
                </p>
              ) : null}
            </div>

            <div
              className={cn(
                'space-y-4 rounded-xl border border-ink-200 bg-surface-raised p-4 sm:p-5',
                step === 3 ? 'block' : 'hidden',
              )}
            >
              <h2
                ref={step === 3 ? stepHeadingRef : undefined}
                tabIndex={-1}
                className="text-base font-semibold text-ink-900 focus:outline-none"
              >
                Optional approximate location
              </h2>
              <p className="text-sm leading-relaxed text-ink-600">
                Coordinates are completely optional and are never requested automatically. They are
                used only to estimate distance for matching, are never returned in match results, and
                are never shown to other users.
              </p>
              <Switch
                id="shareApproximateLocation"
                checked={values.shareApproximateLocation}
                onChange={(checked) => {
                  setValue('shareApproximateLocation', checked, { shouldDirty: true });
                  if (!checked) {
                    setValue('latitude', '', { shouldDirty: true });
                    setValue('longitude', '', { shouldDirty: true });
                  }
                }}
                label="Use my approximate location for distance estimates"
                description="This is independent of phone-sharing consent. You can opt out at any time."
              />
              {values.shareApproximateLocation ? (
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="Latitude" htmlFor="latitude" error={errors.latitude?.message}>
                    <Input
                      id="latitude"
                      inputMode="decimal"
                      placeholder="e.g. 18.5204"
                      invalid={Boolean(errors.latitude)}
                      {...register('latitude')}
                    />
                  </Field>
                  <Field label="Longitude" htmlFor="longitude" error={errors.longitude?.message}>
                    <Input
                      id="longitude"
                      inputMode="decimal"
                      placeholder="e.g. 73.8567"
                      invalid={Boolean(errors.longitude)}
                      {...register('longitude')}
                    />
                  </Field>
                </div>
              ) : (
                <p className="rounded-lg border border-ink-200 bg-ink-50/60 px-3 py-2 text-xs leading-relaxed text-ink-600">
                  Approximate location is off. You can leave this step blank and continue.
                </p>
              )}
            </div>

            <div
              className={cn(
                'space-y-4 rounded-xl border border-ink-200 bg-surface-raised p-4 sm:p-5',
                step === 4 ? 'block' : 'hidden',
              )}
            >
              <h2
                ref={step === 4 ? stepHeadingRef : undefined}
                tabIndex={-1}
                className="text-base font-semibold text-ink-900 focus:outline-none"
              >
                Review and privacy
              </h2>

              <dl className="divide-y divide-ink-100 rounded-xl border border-ink-200 bg-ink-50/40">
                <SummaryRow label="Blood group" value={values.bloodGroup || 'Not selected'} />
                <SummaryRow
                  label="Availability"
                  value={values.isAvailable ? 'Available to consider requests' : 'Paused'}
                />
                <SummaryRow
                  label="Contact sharing"
                  value={
                    consentToContact === true
                      ? 'Allowed only after an accepted offer'
                      : consentToContact === false
                        ? 'Phone number stays private'
                        : 'Not chosen yet'
                  }
                />
                <SummaryRow
                  label="Approximate location"
                  value={
                    values.shareApproximateLocation &&
                    values.latitude?.trim() &&
                    values.longitude?.trim()
                      ? 'Shared for distance estimates only'
                      : 'Not shared'
                  }
                />
              </dl>

              {existing ? (
                <p className="rounded-lg border border-ink-200 bg-ink-50/60 px-3 py-2.5 text-xs leading-relaxed text-ink-600">
                  Privacy information was acknowledged on{' '}
                  {formatDateTime(existing.privacyConsentAt)}. Contact consent and availability
                  remain separate choices and can be changed independently.
                </p>
              ) : (
                <div>
                  <Checkbox
                    id="privacyAccepted"
                    label="I have read and acknowledge the donor privacy information."
                    description="Your blood group, availability, city and area may appear in authorized matching results with a masked name. Phone and coordinates remain hidden."
                    {...register('privacyAccepted')}
                  />
                  {errors.privacyAccepted?.message ? (
                    <p className="mt-1.5 text-xs font-medium text-brand-accent" role="alert">
                      {errors.privacyAccepted.message}
                    </p>
                  ) : null}
                </div>
              )}

              <p className="flex items-start gap-2 text-xs leading-relaxed text-ink-500">
                <ShieldCheck className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
                Saving records this consent choice in the application database. On-chain anchoring
                is optional and never decides medical eligibility. Read the{' '}
                <Link to="/privacy" className="font-semibold text-brand-accent hover:text-brand-accent-strong">
                  privacy notice
                </Link>
                .
              </p>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-ink-100 pt-4">
              <p
                className={cn(
                  'text-xs',
                  saveState.tone === 'danger'
                    ? 'font-medium text-brand-accent'
                    : saveState.tone === 'success'
                      ? 'font-medium text-accent-700'
                      : saveState.tone === 'warning'
                        ? 'font-medium text-amber-700'
                        : 'text-ink-500',
                )}
                aria-live="polite"
              >
                {saveState.text}
              </p>
              <div className="flex flex-wrap gap-2">
                {step > 0 ? (
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={goBack}
                    leftIcon={<ChevronLeft className="size-4" aria-hidden="true" />}
                  >
                    Back
                  </Button>
                ) : null}
                {step < steps.length - 1 ? (
                  <Button
                    type="button"
                    onClick={() => void goNext()}
                    rightIcon={<ChevronRight className="size-4" aria-hidden="true" />}
                  >
                    Continue
                  </Button>
                ) : (
                  <>
                    <Button
                      type="button"
                      variant="ghost"
                      disabled={!isDirty || saving}
                      onClick={() => {
                        reset(donorFormFromProfile(existing));
                        setFormError(null);
                        setStep(0);
                      }}
                    >
                      Reset
                    </Button>
                    <Button
                      type="submit"
                      isLoading={saving}
                      disabled={!isDirty && Boolean(existing)}
                      leftIcon={<Save className="size-4" aria-hidden="true" />}
                    >
                      {existing ? 'Save donor profile' : 'Create donor profile'}
                    </Button>
                  </>
                )}
              </div>
            </div>
          </form>
        </SectionCard>

        <aside className="space-y-4">
          <Card>
            <span className="flex size-10 items-center justify-center rounded-lg bg-brand-50 text-brand-accent">
              <Droplet className="size-5" aria-hidden="true" />
            </span>
            <h2 className="mt-4 text-sm font-semibold text-ink-900">How matching works</h2>
            <p className="mt-1.5 text-xs leading-relaxed text-ink-600">{matchingNotice}</p>
            <ul className="mt-3 space-y-2 text-xs leading-relaxed text-ink-500">
              <li className="flex gap-2">
                <CheckCircle2 className="mt-0.5 size-3.5 shrink-0 text-accent-600" aria-hidden="true" />
                Only verified, open requests are visible.
              </li>
              <li className="flex gap-2">
                <CheckCircle2 className="mt-0.5 size-3.5 shrink-0 text-accent-600" aria-hidden="true" />
                One active offer per request is enforced.
              </li>
              <li className="flex gap-2">
                <CheckCircle2 className="mt-0.5 size-3.5 shrink-0 text-accent-600" aria-hidden="true" />
                You can withdraw an offer before or after acceptance.
              </li>
            </ul>
          </Card>

          <Alert variant="warning" title="Contact protection">
            Matching results show a masked name, blood group and general city/area. Phone numbers
            appear only to a requester or hospital when your offer is accepted and you consented.
          </Alert>

          <Card>
            <h2 className="flex items-center gap-2 text-sm font-semibold text-ink-900">
              <MapPin className="size-4 text-ink-500" aria-hidden="true" />
              Distance is optional
            </h2>
            <p className="mt-1.5 text-xs leading-relaxed text-ink-500">
              Without coordinates, matching falls back to exact blood group, city and area. Providing
              coordinates never exposes your precise location to another user.
            </p>
          </Card>

          <Card className="flex items-start gap-3">
            <Info className="mt-0.5 size-5 shrink-0 text-ink-500" aria-hidden="true" />
            <div>
              <p className="text-sm font-semibold text-ink-900">Verification scope</p>
              <p className="mt-1 text-xs leading-relaxed text-ink-500">
                Donor matching and hospital review are recorded in the application database.
                On-chain anchoring is an optional audit layer; it never decides medical eligibility.
              </p>
              <Link
                to="/app/blockchain"
                className="mt-1 inline-flex min-h-11 items-center text-xs font-semibold text-brand-accent hover:text-brand-accent-strong"
              >
                See verification status
              </Link>
            </div>
          </Card>
        </aside>
      </div>
    </div>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-4 px-4 py-3">
      <dt className="text-xs font-medium text-ink-500">{label}</dt>
      <dd className="max-w-[65%] text-right text-xs font-semibold text-ink-800">{value}</dd>
    </div>
  );
}
