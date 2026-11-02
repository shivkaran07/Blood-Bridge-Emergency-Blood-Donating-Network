import type {
  AuditEventRow,
  BloodGroup,
  BloodRequestRow,
  BlockchainSyncStatus,
  DbTimestamp,
  DonorResponseRow,
  HospitalVerificationStatus,
  HospitalProfileRow,
  RequestStatus,
} from '../types/domain.js';

export interface RequestWithMeta extends BloodRequestRow {
  requester_name: string;
  response_count: string | number;
  accepted_response_count: string | number;
}

export interface ResponseWithDonor extends DonorResponseRow {
  requester_id: string;
  request_status: RequestStatus;
  request_blood_group: BloodGroup;
  request_needed_by: DbTimestamp;
  request_hospital_name: string;
  request_hospital_city: string;
  request_hospital_area: string;
  donor_name: string;
  donor_phone: string | null;
  donor_city: string | null;
  donor_area: string | null;
  donor_blood_group: BloodGroup | null;
  consent_to_contact: boolean;
}

export interface AdminUserRow {
  id: string;
  full_name: string;
  email: string;
  phone_number: string | null;
  city: string | null;
  account_status: 'ACTIVE' | 'SUSPENDED';
  created_at: DbTimestamp;
  roles: unknown;
  hospital_status: HospitalVerificationStatus | null;
  hospital_name: string | null;
}

export interface HospitalApplicationRow extends HospitalProfileRow {
  applicant_name: string;
  applicant_email: string;
  verified_by_name: string | null;
}

export interface AuditWithNames extends AuditEventRow {
  actor_name: string | null;
  request_hospital_name: string | null;
  request_status: RequestStatus | null;
}

export interface SuspiciousRequestRow extends RequestWithMeta {
  requests_last_24h: string | number;
  rejected_last_30d: string | number;
  active_count: string | number;
}

export interface BlockchainStatusCount {
  blockchain_sync_status: BlockchainSyncStatus;
  count: string | number;
}

export function asStringArray(value: unknown): string[] {
  if (Array.isArray(value)) return value.map(String);
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed.map(String) : [];
    } catch {
      return [];
    }
  }
  return [];
}
