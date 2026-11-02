import { z } from 'zod';
import { BLOOD_GROUPS, type BloodGroup, type DonorProfile } from '../types/api';

/**
 * Donor onboarding deliberately starts from a neutral state. A new user is not
 * enrolled as an available donor, does not share contact details, and has not
 * acknowledged the privacy notice until they explicitly choose each option.
 */
export interface DonorProfileFormValues {
  bloodGroup: BloodGroup | '';
  isAvailable: boolean;
  /** `null` means the user has not made a contact-sharing choice yet. */
  consentToContact: boolean | null;
  shareApproximateLocation: boolean;
  latitude: string;
  longitude: string;
  privacyAccepted: boolean;
}

export function emptyDonorProfileForm(): DonorProfileFormValues {
  return {
    bloodGroup: '',
    isAvailable: false,
    consentToContact: null,
    shareApproximateLocation: false,
    latitude: '',
    longitude: '',
    privacyAccepted: false,
  };
}

/**
 * Existing preferences are loaded exactly as stored. This must never inject
 * onboarding defaults into an existing donor record.
 */
export function donorFormFromProfile(profile: DonorProfile | null | undefined): DonorProfileFormValues {
  if (!profile) return emptyDonorProfileForm();
  return {
    bloodGroup: profile.bloodGroup,
    isAvailable: profile.isAvailable,
    consentToContact: profile.consentToContact,
    shareApproximateLocation: profile.latitude !== null && profile.longitude !== null,
    latitude: profile.latitude === null ? '' : String(profile.latitude),
    longitude: profile.longitude === null ? '' : String(profile.longitude),
    privacyAccepted: true,
  };
}

export const donorProfileSchema = z
  .object({
    bloodGroup: z.union([z.literal(''), z.enum(BLOOD_GROUPS)]),
    isAvailable: z.boolean(),
    consentToContact: z
      .boolean()
      .nullable()
      .refine((value) => value !== null, 'Choose whether your phone number may be shared after acceptance.'),
    shareApproximateLocation: z.boolean(),
    latitude: z.string(),
    longitude: z.string(),
    privacyAccepted: z
      .boolean()
      .refine((value) => value, 'Acknowledge the donor privacy information before continuing.'),
  })
  .superRefine((values, ctx) => {
    if (values.bloodGroup === '') {
      ctx.addIssue({ code: 'custom', path: ['bloodGroup'], message: 'Select your blood group.' });
    }

    const hasLat = Boolean(values.latitude?.trim());
    const hasLng = Boolean(values.longitude?.trim());

    if (hasLat !== hasLng) {
      ctx.addIssue({
        code: 'custom',
        path: hasLat ? ['longitude'] : ['latitude'],
        message: 'Provide both coordinates, or leave both blank.',
      });
    }

    if (values.shareApproximateLocation && !hasLat && !hasLng) {
      ctx.addIssue({
        code: 'custom',
        path: ['latitude'],
        message: 'Enter both coordinates to use approximate location matching.',
      });
    }

    if (!values.shareApproximateLocation && (hasLat || hasLng)) {
      ctx.addIssue({
        code: 'custom',
        path: ['shareApproximateLocation'],
        message: 'Turn on approximate location sharing before adding coordinates.',
      });
    }

    if (hasLat) {
      const lat = Number(values.latitude);
      if (Number.isNaN(lat) || lat < -90 || lat > 90) {
        ctx.addIssue({ code: 'custom', path: ['latitude'], message: 'Latitude must be between -90 and 90.' });
      }
    }
    if (hasLng) {
      const lng = Number(values.longitude);
      if (Number.isNaN(lng) || lng < -180 || lng > 180) {
        ctx.addIssue({ code: 'custom', path: ['longitude'], message: 'Longitude must be between -180 and 180.' });
      }
    }
  });

export type ValidDonorProfileForm = z.infer<typeof donorProfileSchema>;

/** Convert a validated form into the API payload without changing saved values. */
export function toDonorProfileInput(values: ValidDonorProfileForm) {
  return {
    bloodGroup: values.bloodGroup as BloodGroup,
    isAvailable: values.isAvailable,
    consentToContact: values.consentToContact === true,
    latitude: values.shareApproximateLocation && values.latitude.trim() ? Number(values.latitude) : null,
    longitude: values.shareApproximateLocation && values.longitude.trim() ? Number(values.longitude) : null,
    privacyAccepted: values.privacyAccepted,
  };
}
