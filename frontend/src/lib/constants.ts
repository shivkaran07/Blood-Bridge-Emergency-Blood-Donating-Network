import type {
  BloodGroup,
  RequestPriority,
  RequestStatus,
  ResponseStatus,
} from '../types/api';

export const bloodGroupOptions: Array<{ value: BloodGroup; label: string }> = [
  { value: 'A+', label: 'A positive (A+)' },
  { value: 'A-', label: 'A negative (A−)' },
  { value: 'B+', label: 'B positive (B+)' },
  { value: 'B-', label: 'B negative (B−)' },
  { value: 'AB+', label: 'AB positive (AB+)' },
  { value: 'AB-', label: 'AB negative (AB−)' },
  { value: 'O+', label: 'O positive (O+)' },
  { value: 'O-', label: 'O negative (O−)' },
];

export const priorityOptions: Array<{ value: RequestPriority; label: string }> = [
  { value: 'NORMAL', label: 'Normal' },
  { value: 'URGENT', label: 'Urgent' },
  { value: 'CRITICAL', label: 'Critical' },
];

export const requestStatusLabels: Record<RequestStatus, string> = {
  SUBMITTED: 'Submitted',
  UNDER_REVIEW: 'Under review',
  VERIFIED: 'Verified',
  REJECTED: 'Not verified',
  PARTIALLY_FULFILLED: 'Partially fulfilled',
  FULFILLED: 'Fulfilled',
  CANCELLED: 'Cancelled',
  EXPIRED: 'Expired',
};

export const responseStatusLabels: Record<ResponseStatus, string> = {
  OFFERED: 'Offered',
  ACCEPTED: 'Accepted',
  DECLINED: 'Declined',
  WITHDRAWN: 'Withdrawn',
  COMPLETED: 'Completed',
  CANCELLED: 'Cancelled',
};

export const roleLabels: Record<string, string> = {
  REQUESTER: 'Requester',
  DONOR: 'Donor',
  HOSPITAL: 'Hospital verifier',
  ADMIN: 'Administrator',
};

export const notificationLabels: Record<string, string> = {
  REQUEST_SUBMITTED: 'Request submitted',
  REQUEST_UNDER_REVIEW: 'Request under review',
  REQUEST_VERIFIED: 'Request verified',
  REQUEST_REJECTED: 'Request not verified',
  DONOR_RESPONSE_RECEIVED: 'Donor response',
  DONOR_RESPONSE_ACCEPTED: 'Offer accepted',
  DONOR_RESPONSE_DECLINED: 'Offer declined',
  RESPONSE_WITHDRAWN: 'Offer withdrawn',
  RESPONSE_COMPLETED: 'Response completed',
  REQUEST_CANCELLED: 'Request cancelled',
  REQUEST_PARTIALLY_FULFILLED: 'Partially fulfilled',
  REQUEST_FULFILLED: 'Request fulfilled',
  REQUEST_EXPIRED: 'Request expired',
  HOSPITAL_APPLICATION_SUBMITTED: 'Hospital application',
  HOSPITAL_APPLICATION_APPROVED: 'Hospital approved',
  HOSPITAL_APPLICATION_REJECTED: 'Hospital rejected',
  ACCOUNT_SUSPENDED: 'Account suspended',
  ACCOUNT_REACTIVATED: 'Account reactivated',
  BLOCKCHAIN_SYNC_ISSUE: 'Blockchain sync issue',
};

export const auditEventLabels: Record<string, string> = {
  REQUEST_CREATED: 'Request created',
  REQUEST_CLAIMED_FOR_REVIEW: 'Request claimed for review',
  REQUEST_VERIFIED: 'Request verified',
  REQUEST_REJECTED: 'Request rejected',
  REQUEST_CANCELLED: 'Request cancelled',
  REQUEST_PARTIALLY_FULFILLED: 'Request partially fulfilled',
  REQUEST_FULFILLED: 'Request fulfilled',
  REQUEST_EXPIRED: 'Request expired',
  DONOR_PROFILE_UPDATED: 'Donor profile updated',
  DONOR_AVAILABILITY_CHANGED: 'Donor availability changed',
  PROFILE_UPDATED: 'Profile updated',
  DONOR_RESPONSE_CREATED: 'Donor response created',
  DONOR_RESPONSE_ACCEPTED: 'Donor response accepted',
  DONOR_RESPONSE_DECLINED: 'Donor response declined',
  DONOR_RESPONSE_WITHDRAWN: 'Donor response withdrawn',
  DONOR_RESPONSE_COMPLETED: 'Donor response completed',
  HOSPITAL_APPLICATION_SUBMITTED: 'Hospital application submitted',
  HOSPITAL_APPLICATION_APPROVED: 'Hospital application approved',
  HOSPITAL_APPLICATION_REJECTED: 'Hospital application rejected',
  USER_SUSPENDED: 'User suspended',
  USER_REACTIVATED: 'User reactivated',
  ROLE_GRANTED: 'Role granted',
};

export const emergencyNotice =
  'BloodBridge is a coordination tool, not an emergency service or a medical authority. For a life-threatening emergency, call your local emergency number and contact the hospital directly.';

export const matchingNotice =
  'Matches use exact recorded blood-group equality, availability and general location only. This is not a medical compatibility assessment. A hospital or blood bank must confirm compatibility and donor eligibility.';

export const part1Notice =
  'Part 1 verification is database-backed. No smart contract is deployed and no blockchain transaction is created.';
