import type {
  AuditEventType,
  AuthContext,
  BloodGroup,
  BlockchainSyncStatus,
  DonorProfileRow,
  HospitalProfileRow,
  NotificationRow,
  ProfileRow,
  RequestPriority,
  RequestStatus,
  ResponseStatus,
} from '../types/domain.js';
import { maskName } from '../lib/crypto.js';
import { toIso, toIsoOrNull, toNumberOrNull } from '../lib/serialize.js';
import type {
  AdminUserRow,
  AuditWithNames,
  HospitalApplicationRow,
  RequestWithMeta,
  ResponseWithDonor,
  SuspiciousRequestRow,
} from '../repositories/types.js';
import { asStringArray } from '../repositories/types.js';

export interface ProfileDto {
  id: string;
  fullName: string;
  phoneNumber: string | null;
  city: string | null;
  area: string | null;
  postalCode: string | null;
  accountStatus: string;
  createdAt: string;
  updatedAt: string;
}

export function toProfileDto(row: ProfileRow): ProfileDto {
  return {
    id: row.id,
    fullName: row.full_name,
    phoneNumber: row.phone_number,
    city: row.city,
    area: row.area,
    postalCode: row.postal_code,
    accountStatus: row.account_status,
    createdAt: toIso(row.created_at),
    updatedAt: toIso(row.updated_at),
  };
}

export interface DonorProfileDto {
  userId: string;
  bloodGroup: BloodGroup;
  isAvailable: boolean;
  consentToContact: boolean;
  latitude: number | null;
  longitude: number | null;
  privacyConsentAt: string;
  updatedAt: string;
}

export function toDonorProfileDto(row: DonorProfileRow): DonorProfileDto {
  return {
    userId: row.user_id,
    bloodGroup: row.blood_group,
    isAvailable: row.is_available,
    consentToContact: row.consent_to_contact,
    latitude: toNumberOrNull(row.latitude),
    longitude: toNumberOrNull(row.longitude),
    privacyConsentAt: toIso(row.privacy_consent_at),
    updatedAt: toIso(row.updated_at),
  };
}

export interface HospitalProfileDto {
  id: string;
  userId: string;
  hospitalName: string;
  registrationNumber: string;
  contactPerson: string;
  contactPhone: string;
  officialEmail: string;
  address: string;
  city: string;
  area: string;
  verificationStatus: string;
  reviewReason: string | null;
  verifiedAt: string | null;
  verifiedWalletAddress: string | null;
  createdAt: string;
  updatedAt: string;
}

export function toHospitalProfileDto(row: HospitalProfileRow): HospitalProfileDto {
  return {
    id: row.id,
    userId: row.user_id,
    hospitalName: row.hospital_name,
    registrationNumber: row.registration_number,
    contactPerson: row.contact_person,
    contactPhone: row.contact_phone,
    officialEmail: row.official_email,
    address: row.address,
    city: row.city,
    area: row.area,
    verificationStatus: row.verification_status,
    reviewReason: row.review_reason,
    verifiedAt: toIsoOrNull(row.verified_at),
    verifiedWalletAddress: row.verified_wallet_address,
    createdAt: toIso(row.created_at),
    updatedAt: toIso(row.updated_at),
  };
}

export interface RequesterSummaryDto {
  id: string;
  fullName: string;
  phoneNumber: string | null;
}

export interface RequestPermissionsDto {
  canCancel: boolean;
  canComplete: boolean;
  canVerify: boolean;
  canRespond: boolean;
  canViewResponses: boolean;
  canViewMatches: boolean;
  canViewRequesterContact: boolean;
}

export interface VerificationDto {
  mode: 'DATABASE';
  blockchainStatus: BlockchainSyncStatus;
  blockchainVerified: false;
  transactionCount: number;
  note: string;
}

export interface BloodRequestDto {
  id: string;
  requesterId: string;
  requesterName: string | null;
  requesterContactPhone: string | null;
  contactShareConsent: boolean | null;
  bloodGroup: BloodGroup;
  unitsRequested: number;
  hospitalName: string;
  hospitalCity: string;
  hospitalArea: string;
  neededBy: string;
  priority: RequestPriority;
  publicMessage: string | null;
  status: RequestStatus;
  cancellationReason: string | null;
  cancelledAt: string | null;
  reviewedAt: string | null;
  reviewReason: string | null;
  blockchainAuditKey: string | null;
  blockchainSyncStatus: BlockchainSyncStatus;
  responseCount: number;
  acceptedResponseCount: number;
  createdAt: string;
  updatedAt: string;
  isOwner: boolean;
  permissions: RequestPermissionsDto;
  verification: VerificationDto;
}

export interface RequestDtoOptions {
  viewer: AuthContext;
  includeRequesterContact: boolean;
  includeAuditKey: boolean;
  canRespond: boolean;
  transactionCount: number;
}

/**
 * Shapes a request for a specific viewer. PII and internal references are
 * included only when the viewer's role/permissions justify them.
 */
export function toRequestDto(
  row: BloodRequestRowLike,
  options: RequestDtoOptions,
): BloodRequestDto {
  const isOwner = row.requester_id === options.viewer.user.id;
  const isAdmin = options.viewer.isAdmin;
  const isVerifier = options.viewer.isApprovedHospital;
  const status = row.status;
  const isClosed = ['FULFILLED', 'CANCELLED', 'EXPIRED', 'REJECTED'].includes(status);

  return {
    id: row.id,
    requesterId: row.requester_id,
    requesterName: isOwner || isAdmin || isVerifier ? row.requester_name : null,
    requesterContactPhone: options.includeRequesterContact ? row.requester_contact_phone : null,
    contactShareConsent:
      isOwner || isAdmin ? row.contact_share_consent : null,
    bloodGroup: row.blood_group,
    unitsRequested: row.units_requested,
    hospitalName: row.hospital_name,
    hospitalCity: row.hospital_city,
    hospitalArea: row.hospital_area,
    neededBy: toIso(row.needed_by),
    priority: row.priority,
    publicMessage: row.public_message,
    status,
    cancellationReason: isOwner || isAdmin || isVerifier ? row.cancellation_reason : null,
    cancelledAt: toIsoOrNull(row.cancelled_at),
    reviewedAt: toIsoOrNull(row.reviewed_at),
    reviewReason: isOwner || isAdmin || isVerifier ? row.review_reason : null,
    blockchainAuditKey: options.includeAuditKey ? row.blockchain_audit_key : null,
    blockchainSyncStatus: row.blockchain_sync_status,
    responseCount: Number(row.response_count ?? 0),
    acceptedResponseCount: Number(row.accepted_response_count ?? 0),
    createdAt: toIso(row.created_at),
    updatedAt: toIso(row.updated_at),
    isOwner,
    permissions: {
      canCancel:
        isOwner &&
        ['SUBMITTED', 'UNDER_REVIEW', 'VERIFIED'].includes(status) &&
        !isClosed,
      canComplete:
        (isOwner || isAdmin) &&
        ['VERIFIED', 'PARTIALLY_FULFILLED'].includes(status),
      canVerify:
        isVerifier && ['SUBMITTED', 'UNDER_REVIEW'].includes(status),
      canRespond: options.canRespond,
      canViewResponses: isOwner || isVerifier,
      canViewMatches: isOwner || isVerifier || isAdmin,
      canViewRequesterContact: options.includeRequesterContact,
    },
    verification: {
      mode: 'DATABASE',
      blockchainStatus: row.blockchain_sync_status,
      blockchainVerified: false,
      transactionCount: options.transactionCount,
      note: 'Part 1 verification is database-backed. No blockchain transaction has been submitted.',
    },
  };
}

interface BloodRequestRowLike extends RequestWithMeta {}

export interface DonorResponseDto {
  id: string;
  requestId: string;
  donorId: string | null;
  donorDisplayName: string;
  donorBloodGroup: BloodGroup | null;
  donorCity: string | null;
  donorArea: string | null;
  donorPhone: string | null;
  responseStatus: ResponseStatus;
  isOwn: boolean;
  contactShared: boolean;
  createdAt: string;
  updatedAt: string;
  request?: {
    id: string;
    hospitalName: string;
    hospitalCity: string;
    hospitalArea: string;
    bloodGroup: BloodGroup;
    neededBy: string;
    status: RequestStatus;
    requesterId: string;
  };
}

export function toResponseDto(
  row: ResponseWithDonor,
  viewer: AuthContext,
): DonorResponseDto {
  const isOwn = row.donor_id === viewer.user.id;
  const isRequestOwner = row.requester_id === viewer.user.id;
  const canCoordinate = isRequestOwner || viewer.isApprovedHospital;
  const contactShared =
    canCoordinate &&
    row.consent_to_contact &&
    ['ACCEPTED', 'COMPLETED'].includes(row.response_status);

  return {
    id: row.id,
    requestId: row.request_id,
    donorId: isOwn ? row.donor_id : null,
    donorDisplayName: contactShared || isOwn ? row.donor_name : maskName(row.donor_name),
    donorBloodGroup: row.donor_blood_group,
    donorCity: row.donor_city,
    donorArea: row.donor_area,
    donorPhone: contactShared ? row.donor_phone : null,
    responseStatus: row.response_status,
    isOwn,
    contactShared,
    createdAt: toIso(row.created_at),
    updatedAt: toIso(row.updated_at),
    request: {
      id: row.request_id,
      hospitalName: row.request_hospital_name,
      hospitalCity: row.request_hospital_city,
      hospitalArea: row.request_hospital_area,
      bloodGroup: row.request_blood_group,
      neededBy: toIso(row.request_needed_by),
      status: row.request_status,
      requesterId: row.requester_id,
    },
  };
}

export interface NotificationDto {
  id: string;
  type: string;
  title: string;
  message: string;
  relatedRequestId: string | null;
  readAt: string | null;
  createdAt: string;
}

export function toNotificationDto(row: NotificationRow): NotificationDto {
  return {
    id: row.id,
    type: row.notification_type,
    title: row.title,
    message: row.message,
    relatedRequestId: row.related_request_id,
    readAt: toIsoOrNull(row.read_at),
    createdAt: toIso(row.created_at),
  };
}

export interface AuditEventDto {
  id: string;
  actorUserId: string | null;
  actorName: string | null;
  requestId: string | null;
  requestHospitalName: string | null;
  requestStatus: RequestStatus | null;
  eventType: AuditEventType | string;
  metadata: Record<string, unknown>;
  createdAt: string;
}

export interface MatchDto {
  displayName: string;
  bloodGroup: BloodGroup;
  city: string | null;
  area: string | null;
  distanceKm: number | null;
  matchBasis: 'DISTANCE' | 'CITY_AND_AREA' | 'CITY' | 'AREA' | 'BLOOD_GROUP_ONLY';
  isAvailable: boolean;
}

export interface MatchResultDto {
  matches: MatchDto[];
  totalCandidates: number;
  bloodGroup: BloodGroup;
  matchingNotice: string;
}

export function toAuditDto(row: AuditWithNames): AuditEventDto {
  return {
    id: row.id,
    actorUserId: row.actor_user_id,
    actorName: row.actor_name,
    requestId: row.request_id,
    requestHospitalName: row.request_hospital_name,
    requestStatus: row.request_status,
    eventType: row.event_type,
    metadata: row.metadata,
    createdAt: toIso(row.created_at),
  };
}

export interface HospitalApplicationDto {
  id: string;
  userId: string;
  applicantName: string;
  applicantEmail: string;
  hospitalName: string;
  registrationNumber: string;
  contactPerson: string;
  contactPhone: string;
  officialEmail: string;
  address: string;
  city: string;
  area: string;
  verificationStatus: string;
  reviewReason: string | null;
  verifiedByName: string | null;
  verifiedAt: string | null;
  verifiedWalletAddress: string | null;
  createdAt: string;
  updatedAt: string;
}

export function toHospitalApplicationDto(row: HospitalApplicationRow): HospitalApplicationDto {
  return {
    id: row.id,
    userId: row.user_id,
    applicantName: row.applicant_name,
    applicantEmail: row.applicant_email,
    hospitalName: row.hospital_name,
    registrationNumber: row.registration_number,
    contactPerson: row.contact_person,
    contactPhone: row.contact_phone,
    officialEmail: row.official_email,
    address: row.address,
    city: row.city,
    area: row.area,
    verificationStatus: row.verification_status,
    reviewReason: row.review_reason,
    verifiedByName: row.verified_by_name,
    verifiedAt: toIsoOrNull(row.verified_at),
    verifiedWalletAddress: row.verified_wallet_address,
    createdAt: toIso(row.created_at),
    updatedAt: toIso(row.updated_at),
  };
}

export interface AdminUserDto {
  id: string;
  fullName: string;
  email: string;
  phoneNumber: string | null;
  city: string | null;
  accountStatus: string;
  roles: string[];
  hospitalStatus: string | null;
  hospitalName: string | null;
  createdAt: string;
}

export function toAdminUserDto(row: AdminUserRow): AdminUserDto {
  return {
    id: row.id,
    fullName: row.full_name,
    email: row.email,
    phoneNumber: row.phone_number,
    city: row.city,
    accountStatus: row.account_status,
    roles: asStringArray(row.roles),
    hospitalStatus: row.hospital_status,
    hospitalName: row.hospital_name,
    createdAt: toIso(row.created_at),
  };
}

export interface SuspiciousRequestDto {
  request: BloodRequestDto;
  reasons: string[];
  requestsLast24h: number;
  rejectedLast30d: number;
  activeCount: number;
}

export function toSuspiciousDto(
  row: SuspiciousRequestRow,
  viewer: AuthContext,
  transactionCount: number,
): SuspiciousRequestDto {
  const reasons: string[] = [];
  if (Number(row.requests_last_24h) >= 3) reasons.push('Three or more requests submitted in 24 hours');
  if (Number(row.rejected_last_30d) >= 1) reasons.push('A request was rejected in the last 30 days');
  if (Number(row.active_count) >= 5) reasons.push('Five or more concurrently active requests');

  return {
    request: toRequestDto(row, {
      viewer,
      includeRequesterContact: false,
      includeAuditKey: false,
      canRespond: false,
      transactionCount,
    }),
    reasons,
    requestsLast24h: Number(row.requests_last_24h),
    rejectedLast30d: Number(row.rejected_last_30d),
    activeCount: Number(row.active_count),
  };
}

export interface MeDto {
  user: { id: string; email: string | null };
  profile: ProfileDto;
  roles: string[];
  permissions: {
    isAdmin: boolean;
    isDonor: boolean;
    isHospital: boolean;
    isApprovedVerifier: boolean;
  };
  profileComplete: boolean;
  donorProfile: DonorProfileDto | null;
  hospitalProfile: HospitalProfileDto | null;
  unreadNotifications: number;
}
