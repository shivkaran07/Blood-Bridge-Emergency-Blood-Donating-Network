import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  CheckCircle2,
  Droplet,
  Info,
  MapPin,
  PauseCircle,
  PlayCircle,
  Save,
  ShieldCheck,
} from 'lucide-react';
import { useAuth, useAuthToken } from '../../context/AuthContext';
import { api, errorMessage } from '../../lib/api';
import { BLOOD_GROUPS } from '../../types/api';
import { bloodGroupOptions, matchingNotice } from '../../lib/constants';
import { invalidateWorkspace } from '../../lib/invalidate';
import { useToast } from '../../context/ToastContext';
import { PageHeader } from '../../components/ui/PageHeader';
import { Card, SectionCard } from '../../components/ui/Card';
import { Alert } from '../../components/ui/Alert';
import { Button } from '../../components/ui/Button';
import { Checkbox, Field, FormError, Input, Select } from '../../components/ui/Field';
import { formatDateTime } from '../../lib/format';

const donorSchema = z
  .object({
    bloodGroup: z.enum(BLOOD_GROUPS),
    isAvailable: z.boolean(),
    consentToContact: z.boolean(),
    latitude: z.string().optional(),
    longitude: z.string().optional(),
    privacyAccepted: z.boolean(),
  })
  .superRefine((values, ctx) => {
    const hasLat = Boolean(values.latitude?.trim());
    const hasLng = Boolean(values.longitude?.trim());
    if (hasLat !== hasLng) {
      ctx.addIssue({
        code: 'custom',
        path: hasLat ? ['longitude'] : ['latitude'],
        message: 'Provide both coordinates, or leave both blank.',
      });
    }
    if ((hasLat || hasLng) && !values.consentToContact) {
      ctx.addIssue({
        code: 'custom',
        path: ['consentToContact'],
        message: 'Approximate coordinates require consent to being contacted.',
      });
    }
    if (hasLat && hasLng) {
      const lat = Number(values.latitude);
      const lng = Number(values.longitude);
      if (Number.isNaN(lat) || lat < -90 || lat > 90) {
        ctx.addIssue({ code: 'custom', path: ['latitude'], message: 'Latitude must be between -90 and 90.' });
      }
      if (Number.isNaN(lng) || lng < -180 || lng > 180) {
        ctx.addIssue({ code: 'custom', path: ['longitude'], message: 'Longitude must be between -180 and 180.' });
      }
    }
  });

type DonorForm = z.infer<typeof donorSchema>;

export function DonorProfilePage() {
  const token = useAuthToken();
  const { me, refreshMe } = useAuth();
  const queryClient = useQueryClient();
  const toast = useToast();
  const [formError, setFormError] = useState<string | null>(null);

  const existing = me?.donorProfile ?? null;

  const {
    register,
    handleSubmit,
    reset,
    watch,
    setError,
    formState: { errors, isSubmitting, isDirty },
  } = useForm<DonorForm>({
    resolver: zodResolver(donorSchema),
    defaultValues: {
      bloodGroup: existing?.bloodGroup ?? me?.donorProfile?.bloodGroup ?? 'O+',
      isAvailable: existing?.isAvailable ?? true,
      consentToContact: existing?.consentToContact ?? true,
      latitude: existing?.latitude?.toString() ?? '',
      longitude: existing?.longitude?.toString() ?? '',
      privacyAccepted: Boolean(existing),
    },
  });

  useEffect(() => {
    if (!me) return;
    const profile = me.donorProfile;
    reset({
      bloodGroup: profile?.bloodGroup ?? 'O+',
      isAvailable: profile?.isAvailable ?? true,
      consentToContact: profile?.consentToContact ?? true,
      latitude: profile?.latitude?.toString() ?? '',
      longitude: profile?.longitude?.toString() ?? '',
      privacyAccepted: Boolean(profile),
    });
  }, [me, reset]);

  const saveProfile = useMutation({
    mutationFn: (values: DonorForm) =>
      api.saveDonorProfile(token, {
        bloodGroup: values.bloodGroup,
        isAvailable: values.isAvailable,
        consentToContact: values.consentToContact,
        latitude: values.latitude?.trim() ? Number(values.latitude) : null,
        longitude: values.longitude?.trim() ? Number(values.longitude) : null,
        privacyAccepted: values.privacyAccepted,
      }),
    onSuccess: async (profile) => {
      toast.success(
        existing ? 'Donor profile updated' : 'Donor profile created',
        `You are ${profile.isAvailable ? 'available' : 'paused'} for ${profile.bloodGroup}.`,
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
          ? 'Verified requests for your blood group can now receive your offer.'
          : 'You will not be able to offer blood until you resume.',
      );
      await refreshMe();
      await invalidateWorkspace(queryClient);
    },
    onError: (error) => toast.error('Could not update availability', errorMessage(error)),
  });

  if (!me) return null;

  const consentToContact = watch('consentToContact');

  const onSubmit = handleSubmit((values) => {
    setFormError(null);
    if (!existing && !values.privacyAccepted) {
      setError('privacyAccepted', {
        message: 'Accept the donor privacy information before creating a profile.',
      });
      return;
    }
    saveProfile.mutate(values);
  });

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Donor"
        title={existing ? 'Donor profile' : 'Become a donor'}
        description="Set your recorded blood group, availability and contact consent. Your contact details and coordinates are never shown in listings."
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
            <span className="flex size-12 items-center justify-center rounded-xl border border-brand-200 bg-brand-50 text-lg font-bold text-brand-800">
              {existing.bloodGroup}
            </span>
            <div>
              <p className="text-sm font-semibold text-ink-900">Recorded blood group</p>
              <p className="text-xs text-ink-500">Exact-match feeding only</p>
            </div>
          </Card>
          <Card className="flex items-center gap-3">
            <span
              className={`flex size-10 items-center justify-center rounded-lg ${
                existing.isAvailable ? 'bg-accent-50 text-accent-700' : 'bg-ink-100 text-ink-500'
              }`}
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
        <Alert variant="info" title="Your donor profile is optional and reversible">
          You can pause availability at any time. A donor offer is a coordination request, not a
          medical commitment. Hospital screening and eligibility checks still apply.
        </Alert>
      )}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,0.8fr)]">
        <SectionCard
          title={existing ? 'Donor settings' : 'Create your donor profile'}
          description="Your exact recorded blood group is used for the feed and response rules. Changing it affects which requests you can see and answer."
          bodyClassName="space-y-5"
        >
          <form onSubmit={onSubmit} noValidate className="space-y-5">
            {formError ? <FormError>{formError}</FormError> : null}

            <Field
              label="Blood group"
              htmlFor="bloodGroup"
              required
              error={errors.bloodGroup?.message}
              hint="Only exact recorded matches appear in your feed. This application does not calculate medical compatibility."
            >
              <Select id="bloodGroup" invalid={Boolean(errors.bloodGroup)} {...register('bloodGroup')}>
                {bloodGroupOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </Select>
            </Field>

            <div className="space-y-4 rounded-xl border border-ink-200 bg-ink-50/60 p-4">
              <Checkbox
                id="isAvailable"
                label="I am currently available to consider donation requests."
                description="Pausing availability hides your eligibility to respond; it does not delete your profile or past responses."
                {...register('isAvailable')}
              />
              <Checkbox
                id="consentToContact"
                label="My phone number may be shared with a requester or hospital after my offer is accepted."
                description="Without this consent, your phone number is never revealed through the request workflow."
                {...register('consentToContact')}
              />
              {errors.consentToContact?.message ? (
                <p className="text-xs font-medium text-brand-700" role="alert">
                  {errors.consentToContact.message}
                </p>
              ) : null}
            </div>

            <details className="rounded-xl border border-ink-200 p-4">
              <summary className="cursor-pointer text-sm font-medium text-ink-800">
                Optional approximate location
              </summary>
              <p className="mt-2 text-xs leading-relaxed text-ink-500">
                Coordinates are used only to estimate distance for matching. They require contact
                consent, are never returned in match results, and are never shown to other users.
              </p>
              <div className="mt-3 grid gap-4 sm:grid-cols-2">
                <Field label="Latitude" htmlFor="latitude" error={errors.latitude?.message}>
                  <Input
                    id="latitude"
                    inputMode="decimal"
                    placeholder="e.g. 18.5204"
                    disabled={!consentToContact}
                    invalid={Boolean(errors.latitude)}
                    {...register('latitude')}
                  />
                </Field>
                <Field label="Longitude" htmlFor="longitude" error={errors.longitude?.message}>
                  <Input
                    id="longitude"
                    inputMode="decimal"
                    placeholder="e.g. 73.8567"
                    disabled={!consentToContact}
                    invalid={Boolean(errors.longitude)}
                    {...register('longitude')}
                  />
                </Field>
              </div>
              {!consentToContact ? (
                <p className="mt-2 text-xs text-ink-500">
                  Enable contact consent to store approximate coordinates.
                </p>
              ) : null}
            </details>

            {!existing ? (
              <div>
                <Checkbox
                  id="privacyAccepted"
                  label="I have read and accept the donor privacy information."
                  description="Your blood group, availability, city and area may appear in authorized matching results with a masked name. Phone and coordinates remain hidden."
                  {...register('privacyAccepted')}
                />
                {errors.privacyAccepted?.message ? (
                  <p className="mt-1.5 text-xs font-medium text-brand-700" role="alert">
                    {errors.privacyAccepted.message}
                  </p>
                ) : null}
              </div>
            ) : (
              <p className="text-xs text-ink-400">
                Privacy consent originally recorded {formatDateTime(existing.privacyConsentAt)}.
              </p>
            )}

            <div className="flex flex-wrap items-center justify-between gap-2 border-t border-ink-100 pt-4">
              <p className="text-xs text-ink-400">
                {isDirty ? 'You have unsaved changes.' : 'Donor settings are saved.'}
              </p>
              <div className="flex gap-2">
                <Button type="button" variant="ghost" disabled={!isDirty || isSubmitting} onClick={() => reset()}>
                  Reset
                </Button>
                <Button
                  type="submit"
                  isLoading={isSubmitting || saveProfile.isPending}
                  disabled={!isDirty && Boolean(existing)}
                  leftIcon={<Save className="size-4" aria-hidden="true" />}
                >
                  {existing ? 'Save donor profile' : 'Create donor profile'}
                </Button>
              </div>
            </div>
          </form>
        </SectionCard>

        <aside className="space-y-4">
          <Card>
            <span className="flex size-10 items-center justify-center rounded-lg bg-brand-50 text-brand-700">
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
              <MapPin className="size-4 text-ink-400" aria-hidden="true" />
              Distance is optional
            </h2>
            <p className="mt-1.5 text-xs leading-relaxed text-ink-500">
              Without coordinates, matching falls back to exact blood group, city and area. Providing
              coordinates never exposes your precise location to another user.
            </p>
          </Card>

          <Card className="flex items-start gap-3">
            <Info className="mt-0.5 size-5 shrink-0 text-ink-400" aria-hidden="true" />
            <div>
              <p className="text-sm font-semibold text-ink-900">Part 1 scope</p>
              <p className="mt-1 text-xs leading-relaxed text-ink-500">
                Donor matching and verification are database-backed. Blockchain anchoring is a
                planned Part 2 capability, not an active feature.
              </p>
              <Link to="/app/blockchain" className="mt-2 inline-flex text-xs font-semibold text-brand-700 hover:text-brand-800">
                See verification status
              </Link>
            </div>
          </Card>
        </aside>
      </div>
    </div>
  );
}
