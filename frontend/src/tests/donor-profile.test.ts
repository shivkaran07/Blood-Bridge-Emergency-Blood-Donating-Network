import { describe, expect, it } from 'vitest';
import {
  donorFormFromProfile,
  donorProfileSchema,
  emptyDonorProfileForm,
  toDonorProfileInput,
} from '../lib/donorProfile';
import type { DonorProfile } from '../types/api';

const savedProfile: DonorProfile = {
  userId: 'user-1',
  bloodGroup: 'AB-',
  isAvailable: false,
  consentToContact: false,
  latitude: null,
  longitude: null,
  privacyConsentAt: '2026-10-01T10:00:00.000Z',
  updatedAt: '2026-10-02T10:00:00.000Z',
};

describe('donor onboarding defaults', () => {
  it('starts neutral rather than enrolling a new donor', () => {
    expect(emptyDonorProfileForm()).toEqual({
      bloodGroup: '',
      isAvailable: false,
      consentToContact: null,
      shareApproximateLocation: false,
      latitude: '',
      longitude: '',
      privacyAccepted: false,
    });
  });

  it('loads every saved preference instead of replacing it with defaults', () => {
    const form = donorFormFromProfile({
      ...savedProfile,
      bloodGroup: 'O-',
      isAvailable: true,
      consentToContact: true,
      latitude: 18.5204,
      longitude: 73.8567,
    });

    expect(form).toEqual({
      bloodGroup: 'O-',
      isAvailable: true,
      consentToContact: true,
      shareApproximateLocation: true,
      latitude: '18.5204',
      longitude: '73.8567',
      privacyAccepted: true,
    });
  });

  it('keeps an explicitly private saved profile private', () => {
    const form = donorFormFromProfile(savedProfile);
    expect(form.consentToContact).toBe(false);
    expect(form.isAvailable).toBe(false);
    expect(form.shareApproximateLocation).toBe(false);
    expect(form.latitude).toBe('');
    expect(form.longitude).toBe('');
  });
});

describe('donor profile validation', () => {
  const valid = {
    bloodGroup: 'O-' as const,
    isAvailable: false,
    consentToContact: false,
    shareApproximateLocation: false,
    latitude: '',
    longitude: '',
    privacyAccepted: true,
  };

  it('accepts a neutral, private profile', () => {
    expect(donorProfileSchema.safeParse(valid).success).toBe(true);
  });

  it('rejects a missing blood group', () => {
    expect(donorProfileSchema.safeParse({ ...valid, bloodGroup: '' }).success).toBe(false);
  });

  it('requires an explicit contact-sharing choice', () => {
    expect(donorProfileSchema.safeParse({ ...valid, consentToContact: null }).success).toBe(false);
  });

  it('requires privacy acknowledgement', () => {
    expect(donorProfileSchema.safeParse({ ...valid, privacyAccepted: false }).success).toBe(false);
  });

  it('requires both coordinates or neither', () => {
    expect(donorProfileSchema.safeParse({ ...valid, latitude: '18.5' }).success).toBe(false);
    expect(donorProfileSchema.safeParse({ ...valid, longitude: '73.8' }).success).toBe(false);
  });

  it('allows approximate location independently of contact-sharing consent', () => {
    expect(
      donorProfileSchema.safeParse({
        ...valid,
        shareApproximateLocation: true,
        latitude: '18.5',
        longitude: '73.8',
      }).success,
    ).toBe(true);
  });

  it('requires explicit approximate-location opt-in before accepting coordinates', () => {
    expect(
      donorProfileSchema.safeParse({
        ...valid,
        latitude: '18.5',
        longitude: '73.8',
      }).success,
    ).toBe(false);
  });

  it('requires coordinates when approximate location is enabled', () => {
    expect(
      donorProfileSchema.safeParse({
        ...valid,
        shareApproximateLocation: true,
      }).success,
    ).toBe(false);
  });

  it('rejects out-of-range coordinates', () => {
    expect(
      donorProfileSchema.safeParse({
        ...valid,
        shareApproximateLocation: true,
        latitude: '91',
        longitude: '73.8',
      }).success,
    ).toBe(false);
    expect(
      donorProfileSchema.safeParse({
        ...valid,
        shareApproximateLocation: true,
        latitude: '18.5',
        longitude: '-181',
      }).success,
    ).toBe(false);
  });

  it('maps blank optional fields to null without changing saved choices', () => {
    expect(toDonorProfileInput(valid)).toEqual({
      bloodGroup: 'O-',
      isAvailable: false,
      consentToContact: false,
      latitude: null,
      longitude: null,
      privacyAccepted: true,
    });
  });

  it('preserves independent location opt-in while contact sharing is off', () => {
    const values = {
      ...valid,
      shareApproximateLocation: true,
      latitude: '18.5',
      longitude: '73.8',
    };

    expect(toDonorProfileInput(values)).toEqual({
      bloodGroup: 'O-',
      isAvailable: false,
      consentToContact: false,
      latitude: 18.5,
      longitude: 73.8,
      privacyAccepted: true,
    });
  });
});
