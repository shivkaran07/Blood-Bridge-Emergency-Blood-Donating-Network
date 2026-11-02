/**
 * API response types. These mirror the DTOs built by the Express backend
 * (backend/src/services/serializers.ts). Keep them in sync deliberately.
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

export const RESPONSE_STATUSES = [
  'OFFERED',
  'ACCEPTED',
  'DECLINED',
  'WITHDRAWN',
  'COMPLETED',
  'CANCELLED',
] as const;
export type ResponseStatus = (typeof RESPONSE_STATUSES)[number];

export const ROLES = ['REQUESTER', 'DONOR', 'HOSPITAL', 'ADMIN'] as const;
export type AppRole = (typeof ROLES)[number];

export type HospitalVerificationStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'SUSPENDED';
export type AccountStatus = 'ACTIVE' | 'SUSPENDED';
export type BlockchainSyncStatus =
  | 'NOT_SCHEDULED'
  | 'AWAITING_WALLET'
  | 'SUBMITTED'
  | 'CONFIRMED'
  | 'FAILED'
  | 'NEEDS_RECONCILIATION';

export interface Profile {
  id: string;
  fullName: string;
  phoneNumber: string | null;
  city: string | null;
  area: string | null;
  postalCode: string | null;
  accountStatus: AccountStatus;
  createdAt: string;
  updatedAt: string;
}

export interface DonorProfile {
  userId: string;
  bloodGroup: BloodGroup;
  isAvailable: boolean;
  consentToContact: boolean;
  latitude: number | null;
  longitude: number | null;
  privacyConsentAt: string;
  updatedAt: string;
}

export interface HospitalProfile {
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
  verificationStatus: HospitalVerificationStatus;
  reviewReason: string | null;
  verifiedAt: string | null;
  verifiedWalletAddress: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Me {
  user: { id: string; email: string | null };
  profile: Profile;
  roles: AppRole[];
  permissions: {
    isAdmin: boolean;
    isDonor: boolean;
    isHospital: boolean;
    isApprovedVerifier: boolean;
  };
  profileComplete: boolean;
  emailNotificationsEnabled: boolean;
  emailNotificationsAvailable: boolean;
  donorProfile: DonorProfile | null;
  hospitalProfile: HospitalProfile | null;
  unreadNotifications: number;
}

export interface RequestPermissions {
  canCancel: boolean;
  canComplete: boolean;
  canVerify: boolean;
  canRespond: boolean;
  canViewResponses: boolean;
  canViewMatches: boolean;
  canViewRequesterContact: boolean;
}

export interface Verification {
  mode: 'DATABASE';
  blockchainStatus: BlockchainSyncStatus;
  blockchainVerified: false;
  transactionCount: number;
  note: string;
}

export interface BloodRequest {
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
  permissions: RequestPermissions;
  verification: Verification;
}

export interface Paginated<T> {
  items: T[];
  total: number;
  limit: number;
  offset: number;
}

export type RequestList = Paginated<BloodRequest>;

export interface RequestHistoryEntry {
  id: string;
  fromStatus: RequestStatus | null;
  toStatus: RequestStatus;
  actorUserId: string | null;
  actorName: string | null;
  reason: string | null;
  createdAt: string;
}

export interface DonorResponse {
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

export interface Match {
  displayName: string;
  bloodGroup: BloodGroup;
  city: string | null;
  area: string | null;
  distanceKm: number | null;
  matchBasis: 'DISTANCE' | 'CITY_AND_AREA' | 'CITY' | 'AREA' | 'BLOOD_GROUP_ONLY';
  isAvailable: boolean;
}

export interface MatchResult {
  matches: Match[];
  totalCandidates: number;
  bloodGroup: BloodGroup;
  matchingNotice: string;
}

export interface NotificationItem {
  id: string;
  type: string;
  title: string;
  message: string;
  relatedRequestId: string | null;
  readAt: string | null;
  createdAt: string;
}

export interface NotificationList {
  items: NotificationItem[];
  total: number;
  unread: number;
}

export interface AuditEvent {
  id: string;
  actorUserId: string | null;
  actorName: string | null;
  requestId: string | null;
  requestHospitalName: string | null;
  requestStatus: RequestStatus | null;
  eventType: string;
  metadata: Record<string, unknown>;
  createdAt: string;
}

export interface HospitalApplication {
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
  verificationStatus: HospitalVerificationStatus;
  reviewReason: string | null;
  verifiedByName: string | null;
  verifiedAt: string | null;
  verifiedWalletAddress: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface HospitalDashboard {
  pendingReviews: number;
  verifiedByMe: number;
  rejectedByMe: number;
  recentlyReviewed: number;
  queuePreview: BloodRequest[];
  recentAudit: AuditEvent[];
  hospital: HospitalProfile;
}

export interface AdminUser {
  id: string;
  fullName: string;
  email: string;
  phoneNumber: string | null;
  city: string | null;
  accountStatus: AccountStatus;
  roles: string[];
  hospitalStatus: HospitalVerificationStatus | null;
  hospitalName: string | null;
  createdAt: string;
}

export interface AdminStats {
  total_users: number;
  active_users: number;
  suspended_users: number;
  donors: number;
  hospital_users: number;
  admins: number;
  total_requests: number;
  submitted_requests: number;
  under_review_requests: number;
  verified_requests: number;
  rejected_requests: number;
  fulfilled_requests: number;
  cancelled_requests: number;
  expired_requests: number;
  active_requests: number;
  total_responses: number;
  offered_responses: number;
  accepted_responses: number;
  pending_hospitals: number;
  approved_hospitals: number;
  anchors_not_scheduled: number;
}

export interface SuspiciousRequest {
  request: BloodRequest;
  reasons: string[];
  requestsLast24h: number;
  rejectedLast30d: number;
  activeCount: number;
}

export interface ActivityPoint {
  day: string;
  requests: number;
  responses: number;
}

export interface RecentActivity {
  id: string;
  requestId: string;
  hospitalName: string;
  bloodGroup: BloodGroup;
  fromStatus: RequestStatus | null;
  toStatus: RequestStatus;
  reason: string | null;
  createdAt: string;
}

export interface RequesterSummary {
  total: number;
  active: number;
  verified: number;
  fulfilled: number;
  cancelled: number;
  /** Requests whose deadline passed and which were marked EXPIRED by the backend. */
  expired?: number;
  responses_received: number;
}

export interface DonorSummary {
  total: number;
  offered: number;
  accepted: number;
  completed: number;
}

export interface AdminOverview {
  stats: AdminStats;
  pendingApplications: number;
  suspiciousCount: number;
  recentAudit: AuditEvent[];
  activity: ActivityPoint[];
}

export interface DashboardData {
  requester: {
    summary: RequesterSummary;
    recentRequests: BloodRequest[];
    recentActivity: RecentActivity[];
  };
  donor: {
    profile: DonorProfile;
    summary: DonorSummary;
    availableRequests: number;
    recentResponses: DonorResponse[];
  } | null;
  hospital: HospitalDashboard | null;
  admin: AdminOverview | null;
  unreadNotifications: number;
}

export interface BlockchainStatus {
  phase: string;
  prepared: boolean;
  connected: boolean;
  operational: boolean;
  enabledByConfiguration: boolean;
  contractAddressConfigured: boolean;
  networkName: string;
  chainId: number;
  verificationMode: 'DATABASE' | 'ON_CHAIN';
  contractAddress?: string | null;
  chainHealth?: { connected: boolean; chainId: number | null; latestBlock: number | null; error: string | null } | null;
  operations?: Array<{
    id: string; requestId: string; transactionHash: string | null; status: string;
    action: string; networkName: string; chainId: number; createdAt: string;
  }>;
  syncCounts: Record<BlockchainSyncStatus, number>;
  pendingAnchors: number;
  transactionsRecorded: number;
  recentTransactions: Array<{
    id: string;
    requestId: string;
    auditKey: string;
    networkName: string;
    chainId: number;
    contractAddress: string;
    transactionHash: string | null;
    action: string;
    status: string;
    blockNumber: number | null;
    createdAt: string;
  }>;
  explanation: string;
  nextPhase: string;
}

export interface RequestBlockchainRecord {
  requestId: string;
  blockchainAuditKey: string;
  blockchainSyncStatus: BlockchainSyncStatus;
  verificationMode: 'DATABASE' | 'ON_CHAIN';
  blockchainVerified: boolean;
  transactionCount: number;
  transactions: Array<{
    id: string;
    transactionHash: string | null;
    networkName: string;
    chainId: number;
    action: string;
    status: string;
    blockNumber: number | null;
    createdAt: string;
  }>;
  note: string;
}

export interface AnchorOperation {
  operationId: string;
  requestId: string;
  auditKey: string;
  action: 'VERIFY_REQUEST' | 'REJECT_REQUEST' | 'FULFILL_REQUEST';
  functionName: 'recordVerifiedRequest' | 'recordRejectedRequest' | 'recordTerminalStatus';
  args: string[];
  contractAddress: string;
  chainId: number;
  networkName: string;
  expectedFromAddress: string;
  expectedStatus: string;
  createdAt: string;
}

export interface BlockchainOperationRow {
  id: string;
  requestId: string;
  auditKey: string;
  action: AnchorOperation['action'];
  functionName: AnchorOperation['functionName'];
  networkName: string;
  chainId: number;
  contractAddress: string;
  transactionHash: string | null;
  status: string;
}

export type RequestDecisionResult =
  | { mode: 'DATABASE'; request: BloodRequest }
  | { mode: 'ON_CHAIN'; operation: AnchorOperation; request: BloodRequest };

export interface WalletChallenge {
  challengeId: string;
  walletAddress: string;
  message: string;
  expiresAt: string;
  instructions: string[];
}

export interface WalletStatus {
  bound: boolean;
  walletAddress: string | null;
  chainId: number | null;
  verifiedAt: string | null;
  /** Binding a wallet never grants on-chain verifier rights by itself. */
  hasOnChainVerifierRole: boolean;
  /**
   * 'GRANTED'         – chain confirmed the role is held.
   * 'NOT_GRANTED'     – chain confirmed the role is not held.
   * 'UNAVAILABLE'     – role could not be checked (RPC error, no adapter).
   * 'NOT_APPLICABLE'  – no wallet is bound or blockchain mode is disabled.
   */
  onChainRoleStatus: 'GRANTED' | 'NOT_GRANTED' | 'UNAVAILABLE' | 'NOT_APPLICABLE';
  note: string;
}

export interface ApiErrorPayload {
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
  requestId?: string;
}
