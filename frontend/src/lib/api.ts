import { env } from './env';
import type {
  AdminOverview,
  AdminStats,
  AdminUser,
  ApiErrorPayload,
  AuditEvent,
  BlockchainStatus,
  BlockchainOperationRow,
  BloodGroup,
  BloodRequest,
  DashboardData,
  DonorProfile,
  DonorResponse,
  HospitalApplication,
  HospitalDashboard,
  HospitalProfile,
  MatchResult,
  Me,
  NotificationItem,
  NotificationList,
  Paginated,
  Profile,
  RequestBlockchainRecord,
  RequestDecisionResult,
  RequestHistoryEntry,
  RequestList,
  RequestPriority,
  RequestStatus,
  SuspiciousRequest,
  WalletChallenge,
  WalletStatus,
} from '../types/api';

export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details: unknown;
  readonly requestId?: string;

  constructor(
    status: number,
    code: string,
    message: string,
    details?: unknown,
    requestId?: string,
  ) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.details = details;
    this.requestId = requestId;
  }
}

type QueryValue = string | number | boolean | null | undefined;

interface ApiRequestOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';
  token?: string | null;
  body?: unknown;
  query?: Record<string, QueryValue>;
  signal?: AbortSignal;
}

function buildUrl(path: string, query?: Record<string, QueryValue>): string {
  const base = env.apiBaseUrl.replace(/\/+$/, '');
  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  const url = new URL(`${base}${cleanPath}`);
  for (const [key, value] of Object.entries(query ?? {})) {
    if (value === null || value === undefined || value === '') continue;
    url.searchParams.set(key, String(value));
  }
  return url.toString();
}

export async function apiRequest<T>(
  path: string,
  options: ApiRequestOptions = {},
): Promise<T> {
  const { method = 'GET', token, body, query, signal } = options;
  const headers: Record<string, string> = { Accept: 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;
  if (body !== undefined) headers['Content-Type'] = 'application/json';

  let response: Response;
  try {
    response = await fetch(buildUrl(path, query), {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
      signal,
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') throw error;
    throw new ApiError(
      0,
      'NETWORK_ERROR',
      'The BloodBridge API could not be reached. Check that the backend is running and VITE_API_BASE_URL is correct.',
    );
  }

  const raw = await response.text();
  let payload: unknown = null;
  if (raw) {
    try {
      payload = JSON.parse(raw);
    } catch {
      payload = null;
    }
  }

  if (!response.ok) {
    const errorPayload = payload as ApiErrorPayload | null;
    throw new ApiError(
      response.status,
      errorPayload?.error?.code ?? 'REQUEST_FAILED',
      errorPayload?.error?.message ?? `The request failed (HTTP ${response.status}).`,
      errorPayload?.error?.details,
      errorPayload?.requestId,
    );
  }

  if (payload && typeof payload === 'object' && 'data' in payload) {
    return (payload as { data: T }).data;
  }
  return payload as T;
}

export function errorMessage(error: unknown): string {
  if (error instanceof ApiError) return error.message;
  if (error instanceof Error) return error.message;
  return 'Something went wrong. Please try again.';
}

// ---------------------------------------------------------------------------
// Input payloads
// ---------------------------------------------------------------------------

export interface ProfileInput {
  fullName: string;
  phoneNumber: string;
  city: string;
  area: string;
  postalCode?: string | null;
}

export interface DonorProfileInput {
  bloodGroup: BloodGroup;
  isAvailable: boolean;
  consentToContact: boolean;
  latitude?: number | null;
  longitude?: number | null;
  privacyAccepted: boolean;
}

export interface CreateRequestInput {
  bloodGroup: BloodGroup;
  unitsRequested: number;
  hospitalName: string;
  hospitalCity: string;
  hospitalArea: string;
  neededBy: string;
  priority: RequestPriority;
  publicMessage?: string | null;
  contactPhone: string;
  contactShareConsent: true;
  accuracyConfirmed: true;
  latitude?: number | null;
  longitude?: number | null;
}

export interface HospitalApplicationInput {
  hospitalName: string;
  registrationNumber: string;
  contactPerson: string;
  contactPhone: string;
  officialEmail: string;
  address: string;
  city: string;
  area: string;
  accuracyConfirmed: true;
}

// ---------------------------------------------------------------------------
// Typed endpoint helpers
// ---------------------------------------------------------------------------

export const api = {
  me: (token: string, signal?: AbortSignal) => apiRequest<Me>('/me', { token, signal }),

  updateProfile: (token: string, input: ProfileInput) =>
    apiRequest<Profile>('/me', { method: 'PATCH', token, body: input }),

  updateEmailNotifications: (token: string, enabled: boolean) =>
    apiRequest<{ enabled: boolean }>('/me/email-notifications', {
      method: 'PATCH',
      token,
      body: { enabled },
    }),

  anonymizeAccount: (token: string) =>
    apiRequest<{ status: 'ANONYMIZED'; requestHistoryRetained: true }>('/me', {
      method: 'DELETE',
      token,
      body: { confirmation: 'DELETE' },
    }),

  getDonorProfile: (token: string, signal?: AbortSignal) =>
    apiRequest<DonorProfile>('/donor/profile', { token, signal }),

  saveDonorProfile: (token: string, input: DonorProfileInput) =>
    apiRequest<DonorProfile>('/donor/profile', { method: 'PUT', token, body: input }),

  setAvailability: (token: string, isAvailable: boolean) =>
    apiRequest<DonorProfile>('/donor/availability', {
      method: 'PATCH',
      token,
      body: { isAvailable },
    }),

  feed: (
    token: string,
    filters: { bloodGroup?: BloodGroup; city?: string; limit?: number; offset?: number },
    signal?: AbortSignal,
  ) => apiRequest<RequestList>('/requests/feed', { token, query: filters, signal }),

  myRequests: (
    token: string,
    filters: { status?: RequestStatus; limit?: number; offset?: number },
    signal?: AbortSignal,
  ) => apiRequest<RequestList>('/requests/mine', { token, query: filters, signal }),

  createRequest: (token: string, input: CreateRequestInput) =>
    apiRequest<BloodRequest>('/requests', { method: 'POST', token, body: input }),

  request: (token: string, id: string, signal?: AbortSignal) =>
    apiRequest<BloodRequest>(`/requests/${id}`, { token, signal }),

  requestHistory: (token: string, id: string, signal?: AbortSignal) =>
    apiRequest<RequestHistoryEntry[]>(`/requests/${id}/history`, { token, signal }),

  requestMatches: (token: string, id: string, signal?: AbortSignal) =>
    apiRequest<MatchResult>(`/requests/${id}/matches`, { token, signal }),

  requestBlockchain: (token: string, id: string, signal?: AbortSignal) =>
    apiRequest<RequestBlockchainRecord>(`/requests/${id}/blockchain`, { token, signal }),

  requestResponses: (token: string, id: string, signal?: AbortSignal) =>
    apiRequest<DonorResponse[]>(`/requests/${id}/responses`, { token, signal }),

  respondToRequest: (token: string, id: string) =>
    apiRequest<DonorResponse>(`/requests/${id}/respond`, { method: 'POST', token }),

  cancelRequest: (token: string, id: string, reason: string) =>
    apiRequest<BloodRequest>(`/requests/${id}/cancel`, {
      method: 'POST',
      token,
      body: { reason },
    }),

  completeRequest: (
    token: string,
    id: string,
    status: 'PARTIALLY_FULFILLED' | 'FULFILLED',
    note?: string | null,
  ) =>
    apiRequest<BloodRequest>(`/requests/${id}/complete`, {
      method: 'POST',
      token,
      body: { status, note: note ?? null },
    }),

  claimRequest: (token: string, id: string) =>
    apiRequest<BloodRequest>(`/requests/${id}/claim`, { method: 'POST', token }),

  verifyRequest: (token: string, id: string, reason?: string | null) =>
    apiRequest<RequestDecisionResult>(`/requests/${id}/verify`, {
      method: 'POST',
      token,
      body: { reason: reason ?? null },
    }),

  rejectRequest: (token: string, id: string, reason: string) =>
    apiRequest<RequestDecisionResult>(`/requests/${id}/reject`, {
      method: 'POST',
      token,
      body: { reason },
    }),

  myResponses: (token: string, query: { limit?: number; offset?: number }, signal?: AbortSignal) =>
    apiRequest<DonorResponse[]>('/responses/mine', { token, query, signal }),

  decideResponse: (token: string, id: string, decision: 'ACCEPTED' | 'DECLINED') =>
    apiRequest<DonorResponse>(`/responses/${id}/decision`, {
      method: 'POST',
      token,
      body: { decision },
    }),

  withdrawResponse: (token: string, id: string) =>
    apiRequest<DonorResponse>(`/responses/${id}/withdraw`, { method: 'POST', token }),

  declineResponse: (token: string, id: string) =>
    apiRequest<DonorResponse>(`/responses/${id}/decline`, { method: 'POST', token }),

  completeResponse: (token: string, id: string) =>
    apiRequest<DonorResponse>(`/responses/${id}/complete`, { method: 'POST', token }),

  notifications: (
    token: string,
    query: { unreadOnly?: boolean; limit?: number; offset?: number },
    signal?: AbortSignal,
  ) => apiRequest<NotificationList>('/notifications', { token, query, signal }),

  markNotificationRead: (token: string, id: string) =>
    apiRequest<NotificationItem>(`/notifications/${id}/read`, { method: 'POST', token }),

  dashboard: (token: string, signal?: AbortSignal) =>
    apiRequest<DashboardData>('/dashboard', { token, signal }),

  blockchainStatus: (token: string, signal?: AbortSignal) =>
    apiRequest<BlockchainStatus>('/blockchain/status', { token, signal }),

  prepareChainCompletion: (token: string, id: string) =>
    apiRequest<RequestDecisionResult>(`/requests/${id}/chain-complete`, { method: 'POST', token }),

  confirmAnchor: (token: string, operationId: string, transactionHash: string) =>
    apiRequest<{ status: string; transactionHash: string | null; request: BloodRequest }>(
      `/blockchain/operations/${operationId}/confirm`,
      { method: 'POST', token, body: { transactionHash } },
    ),

  reconcileAnchor: (token: string, operationId: string) =>
    apiRequest<{ status: string; transactionHash: string | null; request: BloodRequest }>(
      `/blockchain/operations/${operationId}/reconcile`, { method: 'POST', token },
    ),

  blockchainOperations: (token: string, requestId: string, status?: string) =>
    apiRequest<{ items: BlockchainOperationRow[]; total: number }>('/blockchain/operations', {
      token, query: { requestId, status, limit: 50 },
    }),

  walletChallenge: (token: string, walletAddress: string) =>
    apiRequest<WalletChallenge>('/wallet/challenge', {
      method: 'POST', token, body: { walletAddress },
    }),

  verifyWallet: (token: string, message: string, signature: string) =>
    apiRequest<{ walletAddress: string; chainId: number; verifiedAt: string }>('/wallet/verify', {
      method: 'POST', token, body: { message, signature },
    }),

  walletStatus: (token: string) =>
    apiRequest<WalletStatus>('/wallet/status', { token }),

  unbindWallet: (token: string) =>
    apiRequest<{ unbound: boolean }>('/wallet/binding', { method: 'DELETE', token }),

  hospitalApplication: (token: string, signal?: AbortSignal) =>
    apiRequest<HospitalProfile>('/hospital/application', { token, signal }),

  applyHospital: (token: string, input: HospitalApplicationInput) =>
    apiRequest<HospitalProfile>('/hospital/applications', {
      method: 'POST',
      token,
      body: input,
    }),

  hospitalQueue: (token: string, query: { limit?: number; offset?: number }, signal?: AbortSignal) =>
    apiRequest<RequestList>('/hospital/queue', { token, query, signal }),

  hospitalDashboard: (token: string, signal?: AbortSignal) =>
    apiRequest<HospitalDashboard>('/hospital/dashboard', { token, signal }),

  hospitalAudit: (token: string, query: { limit?: number; offset?: number }, signal?: AbortSignal) =>
    apiRequest<{ items: AuditEvent[]; summary: { verified: number; rejected: number } }>(
      '/hospital/audit',
      { token, query, signal },
    ),

  adminOverview: (token: string, signal?: AbortSignal) =>
    apiRequest<AdminOverview>('/admin/overview', { token, signal }),

  adminStats: (token: string, signal?: AbortSignal) =>
    apiRequest<AdminStats>('/admin/stats', { token, signal }),

  adminUsers: (
    token: string,
    query: { search?: string; limit?: number; offset?: number },
    signal?: AbortSignal,
  ) => apiRequest<{ items: AdminUser[]; total: number }>('/admin/users', { token, query, signal }),

  adminUserStatus: (
    token: string,
    id: string,
    status: 'ACTIVE' | 'SUSPENDED',
    reason?: string | null,
  ) =>
    apiRequest<{ id: string; accountStatus: string }>(`/admin/users/${id}/status`, {
      method: 'PATCH',
      token,
      body: { status, reason: reason ?? null },
    }),

  adminRequests: (
    token: string,
    query: {
      status?: RequestStatus;
      bloodGroup?: BloodGroup;
      priority?: RequestPriority;
      city?: string;
      search?: string;
      limit?: number;
      offset?: number;
    },
    signal?: AbortSignal,
  ) => apiRequest<RequestList>('/admin/requests', { token, query, signal }),

  adminCancelRequest: (token: string, id: string, reason: string) =>
    apiRequest<BloodRequest>(`/admin/requests/${id}/cancel`, {
      method: 'POST',
      token,
      body: { reason },
    }),

  adminSuspicious: (token: string, signal?: AbortSignal) =>
    apiRequest<{ items: SuspiciousRequest[]; total: number }>('/admin/suspicious', {
      token,
      signal,
    }),

  adminAudit: (
    token: string,
    query: {
      eventType?: string;
      actorUserId?: string;
      requestId?: string;
      limit?: number;
      offset?: number;
    },
    signal?: AbortSignal,
  ) => apiRequest<{ items: AuditEvent[]; total: number }>('/admin/audit', { token, query, signal }),

  adminHospitalApplications: (
    token: string,
    query: { status?: string; limit?: number; offset?: number },
    signal?: AbortSignal,
  ) =>
    apiRequest<{ items: HospitalApplication[]; total: number }>(
      '/admin/hospital-applications',
      { token, query, signal },
    ),

  adminHospitalDecision: (
    token: string,
    id: string,
    decision: 'APPROVED' | 'REJECTED',
    reason?: string | null,
  ) =>
    apiRequest<HospitalProfile>(`/admin/hospital-applications/${id}/decision`, {
      method: 'POST',
      token,
      body: { decision, reason: reason ?? null },
    }),
};

export type PaginatedList<T> = Paginated<T>;
