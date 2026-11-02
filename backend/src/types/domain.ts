/**
 * Domain vocabulary shared by the API, services and tests.
 * These values mirror the PostgreSQL enums in supabase/migrations.
 */

export const BLOOD_GROUPS = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'] as const;
export type BloodGroup = (typeof BLOOD_GROUPS)[number];

export const PRIORITIES = ['NORMAL', 'URGENT', 'CRITICAL'] as const;
export type RequestPriority = (typeof PRIORITIES)[number];

export const REQUEST_STATUSES = [
  'SUBMITTED',
  'UNDER_REVIEW',
  'VERIFIED',
  'REJECTED',
  'PARTIALLY_FULFILLED',
  'FULFILLED',
  'CANCELLED',
  'EXPIRED',
] as const;
export type RequestStatus = (typeof REQUEST_STATUSES)[number];

/** Statuses in which a request can still receive offers. */
export const OPEN_REQUEST_STATUSES: RequestStatus[] = ['VERIFIED', 'PARTIALLY_FULFILLED'];

/** Statuses considered "active" for duplicate-request protection. */
export const ACTIVE_REQUEST_STATUSES: RequestStatus[] = [
  'SUBMITTED',
  'UNDER_REVIEW',
  'VERIFIED',
  'PARTIALLY_FULFILLED',
];

export const RESPONSE_STATUSES = [
  'OFFERED',
  'ACCEPTED',
  'DECLINED',
  'WITHDRAWN',
  'COMPLETED',
  'CANCELLED',
] as const;
export type ResponseStatus = (typeof RESPONSE_STATUSES)[number];

/** Only one of these may exist per donor/request pair. */
export const ACTIVE_RESPONSE_STATUSES: ResponseStatus[] = ['OFFERED', 'ACCEPTED', 'COMPLETED'];

export const ROLES = ['REQUESTER', 'DONOR', 'HOSPITAL', 'ADMIN'] as const;
export type AppRole = (typeof ROLES)[number];

export const ACCOUNT_STATUSES = ['ACTIVE', 'SUSPENDED'] as const;
export type AccountStatus = (typeof ACCOUNT_STATUSES)[number];

export const HOSPITAL_VERIFICATION_STATUSES = ['PENDING', 'APPROVED', 'REJECTED', 'SUSPENDED'] as const;
export type HospitalVerificationStatus = (typeof HOSPITAL_VERIFICATION_STATUSES)[number];

export const BLOCKCHAIN_SYNC_STATUSES = [
  'NOT_SCHEDULED',
  'AWAITING_WALLET',
  'SUBMITTED',
  'CONFIRMED',
  'FAILED',
  'NEEDS_RECONCILIATION',
] as const;
export type BlockchainSyncStatus = (typeof BLOCKCHAIN_SYNC_STATUSES)[number];

export const NOTIFICATION_TYPES = [
  'REQUEST_SUBMITTED',
  'REQUEST_UNDER_REVIEW',
  'REQUEST_VERIFIED',
  'REQUEST_REJECTED',
  'DONOR_RESPONSE_RECEIVED',
  'DONOR_RESPONSE_ACCEPTED',
  'DONOR_RESPONSE_DECLINED',
  'RESPONSE_WITHDRAWN',
  'RESPONSE_COMPLETED',
  'REQUEST_CANCELLED',
  'REQUEST_PARTIALLY_FULFILLED',
  'REQUEST_FULFILLED',
  'REQUEST_EXPIRED',
  'HOSPITAL_APPLICATION_SUBMITTED',
  'HOSPITAL_APPLICATION_APPROVED',
  'HOSPITAL_APPLICATION_REJECTED',
  'ACCOUNT_SUSPENDED',
  'ACCOUNT_REACTIVATED',
  'BLOCKCHAIN_SYNC_ISSUE',
] as const;
export type NotificationType = (typeof NOTIFICATION_TYPES)[number];

export const AUDIT_EVENT_TYPES = [
  'REQUEST_CREATED',
  'REQUEST_CLAIMED_FOR_REVIEW',
  'REQUEST_VERIFIED',
  'REQUEST_REJECTED',
  'REQUEST_CANCELLED',
  'REQUEST_PARTIALLY_FULFILLED',
  'REQUEST_FULFILLED',
  'REQUEST_EXPIRED',
  'DONOR_PROFILE_UPDATED',
  'DONOR_AVAILABILITY_CHANGED',
  'PROFILE_UPDATED',
  'DONOR_RESPONSE_CREATED',
  'DONOR_RESPONSE_ACCEPTED',
  'DONOR_RESPONSE_DECLINED',
  'DONOR_RESPONSE_WITHDRAWN',
  'DONOR_RESPONSE_COMPLETED',
  'HOSPITAL_APPLICATION_SUBMITTED',
  'HOSPITAL_APPLICATION_APPROVED',
  'HOSPITAL_APPLICATION_REJECTED',
  'USER_SUSPENDED',
  'USER_REACTIVATED',
  'ROLE_GRANTED',
  'WALLET_CHALLENGE_ISSUED',
  'WALLET_BOUND',
  'WALLET_UNBOUND',
  'WALLET_CHALLENGE_REJECTED',
  'BLOCKCHAIN_ANCHOR_PREPARED',
  'BLOCKCHAIN_ANCHOR_CONFIRMED',
  'BLOCKCHAIN_ANCHOR_FAILED',
  'BLOCKCHAIN_RECONCILE_CONFIRMED',
  'BLOCKCHAIN_RECONCILE_FAILED',
  'ACCOUNT_ANONYMIZED',
] as const;
export type AuditEventType = (typeof AUDIT_EVENT_TYPES)[number];

export type DbTimestamp = string | Date;

export interface ProfileRow {
  id: string;
  full_name: string;
  phone_number: string | null;
  city: string | null;
  area: string | null;
  postal_code: string | null;
  email_notifications_enabled: boolean;
  account_status: AccountStatus;
  created_at: DbTimestamp;
  updated_at: DbTimestamp;
}

export interface UserRoleRow {
  id: string;
  user_id: string;
  role: AppRole;
  granted_by: string | null;
  created_at: DbTimestamp;
}

export interface DonorProfileRow {
  user_id: string;
  blood_group: BloodGroup;
  is_available: boolean;
  consent_to_contact: boolean;
  latitude: string | number | null;
  longitude: string | number | null;
  privacy_consent_at: DbTimestamp;
  created_at: DbTimestamp;
  updated_at: DbTimestamp;
}

export interface BloodRequestRow {
  id: string;
  requester_id: string;
  blood_group: BloodGroup;
  units_requested: number;
  hospital_name: string;
  hospital_city: string;
  hospital_area: string;
  hospital_latitude: string | number | null;
  hospital_longitude: string | number | null;
  needed_by: DbTimestamp;
  priority: RequestPriority;
  public_message: string | null;
  requester_contact_phone: string | null;
  contact_share_consent: boolean;
  status: RequestStatus;
  cancellation_reason: string | null;
  cancelled_at: DbTimestamp | null;
  reviewed_by: string | null;
  reviewed_at: DbTimestamp | null;
  review_reason: string | null;
  blockchain_audit_key: string;
  blockchain_sync_status: BlockchainSyncStatus;
  created_at: DbTimestamp;
  updated_at: DbTimestamp;
}

export interface RequestHistoryRow {
  id: string;
  seq: number | string;
  request_id: string;
  from_status: RequestStatus | null;
  to_status: RequestStatus;
  actor_user_id: string | null;
  reason: string | null;
  created_at: DbTimestamp;
}

export interface DonorResponseRow {
  id: string;
  request_id: string;
  donor_id: string;
  response_status: ResponseStatus;
  created_at: DbTimestamp;
  updated_at: DbTimestamp;
}

export interface HospitalProfileRow {
  id: string;
  user_id: string;
  hospital_name: string;
  registration_number: string;
  contact_person: string;
  contact_phone: string;
  official_email: string;
  address: string;
  city: string;
  area: string;
  verification_status: HospitalVerificationStatus;
  review_reason: string | null;
  verified_by: string | null;
  verified_at: DbTimestamp | null;
  verified_wallet_address: string | null;
  created_at: DbTimestamp;
  updated_at: DbTimestamp;
}

export interface NotificationRow {
  id: string;
  recipient_user_id: string;
  notification_type: NotificationType;
  title: string;
  message: string;
  related_request_id: string | null;
  read_at: DbTimestamp | null;
  created_at: DbTimestamp;
}

export interface AuditEventRow {
  id: string;
  actor_user_id: string | null;
  request_id: string | null;
  event_type: string;
  metadata: Record<string, unknown>;
  created_at: DbTimestamp;
}

/** On-chain BloodBridge contract states. */
export const ON_CHAIN_STATUS_VALUES = [
  'NONE',
  'VERIFIED',
  'REJECTED',
  'CANCELLED',
  'COMPLETED',
] as const;

/** Operations the wallet anchors on chain, with the contract function to call. */
export const BLOCKCHAIN_ANCHOR_ACTIONS = ['VERIFY_REQUEST', 'REJECT_REQUEST', 'FULFILL_REQUEST'] as const;
export type BlockchainAnchorAction = (typeof BLOCKCHAIN_ANCHOR_ACTIONS)[number];

export interface WalletChallengeRow {
  id: string;
  user_id: string;
  wallet_address: string;
  nonce_hash: string;
  message_hash: string;
  purpose: 'WALLET_BINDING';
  expires_at: DbTimestamp;
  consumed_at: DbTimestamp | null;
  created_at: DbTimestamp;
}

export interface WalletBindingRow {
  user_id: string;
  wallet_address: string;
  chain_id: number | string;
  verified_at: DbTimestamp;
  created_at: DbTimestamp;
  updated_at: DbTimestamp;
}

export interface BlockchainTransactionRow {
  id: string;
  request_id: string;
  blockchain_audit_key: string;
  network_name: string;
  chain_id: number | string;
  contract_address: string;
  transaction_hash: string | null;
  action: string;
  transaction_status:
    | 'PENDING'
    | 'SUBMITTED'
    | 'CONFIRMED'
    | 'FAILED'
    | 'NEEDS_RECONCILIATION';
  block_number: number | string | null;
  actor_user_id: string | null;
  source_address: string | null;
  error_message: string | null;
  confirmed_at: DbTimestamp | null;
  created_at: DbTimestamp;
  updated_at: DbTimestamp;
}

export interface AuthenticatedUser {
  id: string;
  email: string | null;
  emailConfirmedAt: string | null;
  authTime?: number | null;
}

export interface AuthContext {
  user: AuthenticatedUser;
  profile: ProfileRow;
  roles: AppRole[];
  accountStatus: AccountStatus;
  isAdmin: boolean;
  isApprovedHospital: boolean;
}
