import type { AuthContext, BloodGroup } from '../types/domain.js';
import type { ServiceDeps } from './deps.js';
import {
  findDonorByUserId,
  setDonorAvailability,
  upsertDonorProfile,
  findDonorCandidates,
  type DonorProfileInput,
} from '../repositories/donorRepository.js';
import { findRequestById } from '../repositories/requestRepository.js';
import { grantRole } from '../repositories/userRepository.js';
import { haversineDistanceKm, maskName } from '../lib/crypto.js';
import {
  ForbiddenError,
  NotFoundError,
  ValidationError,
} from '../lib/errors.js';
import { toNumberOrNull } from '../lib/serialize.js';
import { canManageRequest } from './access.js';
import { writeAudit } from './notificationService.js';
import {
  toDonorProfileDto,
  toRequestDto,
  type BloodRequestDto,
  type MatchDto,
  type MatchResultDto,
} from './serializers.js';

const MATCHING_NOTICE =
  'Matches use exact recorded blood-group equality, availability, contact consent, city/area and optional approximate location when provided. This is not a medical compatibility assessment; a hospital or blood bank must confirm compatibility and donor eligibility.';

export async function getOwnDonorProfile(deps: ServiceDeps, ctx: AuthContext) {
  const donor = await findDonorByUserId(deps.db, ctx.user.id);
  if (!donor) throw new NotFoundError('You do not have a donor profile yet.');
  return toDonorProfileDto(donor);
}

export async function upsertOwnDonorProfile(
  deps: ServiceDeps,
  ctx: AuthContext,
  input: DonorProfileInput & { privacyAccepted: boolean },
) {
  const existing = await findDonorByUserId(deps.db, ctx.user.id);

  if (!existing && !input.privacyAccepted) {
    throw new ValidationError('You must accept the privacy information before creating a donor profile.');
  }
  if ((input.latitude === null) !== (input.longitude === null)) {
    throw new ValidationError('Provide both latitude and longitude, or neither.');
  }

  const result = await deps.db.transaction(async (tx) => {
    const donor = await upsertDonorProfile(tx, ctx.user.id, input);
    await grantRole(tx, ctx.user.id, 'DONOR', null);
    await writeAudit(tx, {
      actorUserId: ctx.user.id,
      requestId: null,
      eventType: 'DONOR_PROFILE_UPDATED',
      metadata: {
        bloodGroup: input.bloodGroup,
        isAvailable: input.isAvailable,
        consentToContact: input.consentToContact,
        sharesApproximateLocation: input.latitude !== null,
      },
    });
    return donor;
  });

  return toDonorProfileDto(result);
}

export async function updateAvailability(
  deps: ServiceDeps,
  ctx: AuthContext,
  isAvailable: boolean,
) {
  const existing = await findDonorByUserId(deps.db, ctx.user.id);
  if (!existing) throw new NotFoundError('Create a donor profile before changing availability.');

  const result = await deps.db.transaction(async (tx) => {
    const donor = await setDonorAvailability(tx, ctx.user.id, isAvailable);
    if (!donor) throw new NotFoundError('Donor profile not found.');
    await writeAudit(tx, {
      actorUserId: ctx.user.id,
      requestId: null,
      eventType: 'DONOR_AVAILABILITY_CHANGED',
      metadata: { isAvailable },
    });
    return donor;
  });

  return toDonorProfileDto(result);
}

function normalise(value: string | null): string {
  return (value ?? '').trim().toLowerCase();
}

function matchBasis(params: {
  sameCity: boolean;
  sameArea: boolean;
  distanceKm: number | null;
}): MatchDto['matchBasis'] {
  if (params.sameCity && params.sameArea) return 'CITY_AND_AREA';
  if (params.sameCity) return 'CITY';
  if (params.distanceKm !== null) return 'DISTANCE';
  if (params.sameArea) return 'AREA';
  return 'BLOOD_GROUP_ONLY';
}

/**
 * Authorized donor matching for a verified request. Returns masked, general
 * location data only. Coordinates never leave the server.
 */
export async function getMatchesForRequest(
  deps: ServiceDeps,
  ctx: AuthContext,
  requestId: string,
): Promise<MatchResultDto> {
  const request = await findRequestById(deps.db, requestId);
  if (!request) throw new NotFoundError('Blood request not found.');
  if (!canManageRequest(ctx, request)) {
    throw new NotFoundError('Blood request not found.');
  }
  if (!['VERIFIED', 'PARTIALLY_FULFILLED'].includes(request.status)) {
    throw new ForbiddenError('Donor matching becomes available after a request is verified.');
  }

  const candidates = await findDonorCandidates(deps.db, {
    bloodGroup: request.blood_group,
    requestId: request.id,
    excludeUserId: request.requester_id,
    limit: 100,
  });

  const requestLat = toNumberOrNull(request.hospital_latitude);
  const requestLng = toNumberOrNull(request.hospital_longitude);

  const enriched = candidates
    .map((candidate) => {
      const donorLat = toNumberOrNull(candidate.latitude);
      const donorLng = toNumberOrNull(candidate.longitude);
      const distanceKm =
        requestLat !== null && requestLng !== null && donorLat !== null && donorLng !== null
          ? Math.round(haversineDistanceKm(requestLat, requestLng, donorLat, donorLng) * 10) / 10
          : null;

      const sameCity =
        normalise(candidate.city).length > 0 &&
        normalise(candidate.city) === normalise(request.hospital_city);
      const sameArea =
        sameCity &&
        normalise(candidate.area).length > 0 &&
        normalise(candidate.area) === normalise(request.hospital_area);

      return {
        candidate,
        distanceKm,
        sameCity,
        sameArea,
      };
    })
    .filter(({ sameCity, distanceKm }) => sameCity || (distanceKm !== null && distanceKm <= 75))
    .sort((a, b) => {
      if (a.sameCity !== b.sameCity) return a.sameCity ? -1 : 1;
      if (a.sameArea !== b.sameArea) return a.sameArea ? -1 : 1;
      if (a.distanceKm !== null && b.distanceKm !== null) return a.distanceKm - b.distanceKm;
      if (a.distanceKm !== null) return -1;
      if (b.distanceKm !== null) return 1;
      return a.candidate.full_name.localeCompare(b.candidate.full_name);
    });

  const matches: MatchDto[] = enriched.slice(0, 20).map(({ candidate, distanceKm, sameCity, sameArea }) => ({
    displayName: maskName(candidate.full_name),
    bloodGroup: candidate.blood_group,
    city: candidate.city,
    area: candidate.area,
    distanceKm,
    matchBasis: matchBasis({ sameCity, sameArea, distanceKm }),
    isAvailable: candidate.is_available,
  }));

  return {
    matches,
    totalCandidates: enriched.length,
    bloodGroup: request.blood_group as BloodGroup,
    matchingNotice: MATCHING_NOTICE,
  };
}

export type { BloodRequestDto };
