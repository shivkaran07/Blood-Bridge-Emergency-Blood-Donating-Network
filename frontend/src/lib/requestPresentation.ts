import { formatDateTime, formatRelative } from './format';
import { requestStatusLabels } from './constants';
import type { BloodRequest } from '../types/api';

export type DeadlineTone = 'normal' | 'urgent' | 'past' | 'closed';

export interface DeadlinePresentation {
  /** Relative deadline shown in the desktop deadline column. */
  label: string;
  /** Small caption that explains the state rather than repeating the label. */
  hint: string;
  /** Complete phrase used by the stacked mobile row. */
  mobileLabel: string;
  tone: DeadlineTone;
}

/**
 * A deadline is only meaningful while a request can still receive offers.
 * Expired, fulfilled, cancelled and rejected requests must not keep counting
 * down as though they were open.
 */
export function deadlinePresentation(
  request: Pick<BloodRequest, 'neededBy' | 'status'>,
  now = Date.now(),
): DeadlinePresentation {
  switch (request.status) {
    case 'EXPIRED':
      return {
        label: 'Expired',
        hint: `Deadline passed ${formatDateTime(request.neededBy)}`,
        mobileLabel: `Expired · deadline passed ${formatDateTime(request.neededBy)}`,
        tone: 'past',
      };
    case 'FULFILLED':
      return {
        label: 'Need met',
        hint: requestStatusLabels.FULFILLED,
        mobileLabel: requestStatusLabels.FULFILLED,
        tone: 'closed',
      };
    case 'CANCELLED':
      return {
        label: 'No longer open',
        hint: requestStatusLabels.CANCELLED,
        mobileLabel: requestStatusLabels.CANCELLED,
        tone: 'closed',
      };
    case 'REJECTED':
      return {
        label: 'Not approved',
        hint: requestStatusLabels.REJECTED,
        mobileLabel: requestStatusLabels.REJECTED,
        tone: 'closed',
      };
    default:
      break;
  }

  const target = new Date(request.neededBy).getTime();
  if (Number.isNaN(target)) {
    return {
      label: 'Deadline unavailable',
      hint: 'Needed by',
      mobileLabel: 'Deadline unavailable',
      tone: 'normal',
    };
  }

  if (target <= now) {
    return {
      label: 'Deadline passed',
      hint: 'Awaiting expiry',
      mobileLabel: 'Deadline passed',
      tone: 'past',
    };
  }

  const hoursRemaining = (target - now) / 3_600_000;
  return {
    label: formatRelative(request.neededBy),
    hint: `Needed by ${formatDateTime(request.neededBy)}`,
    mobileLabel: `Needed by ${formatDateTime(request.neededBy)} · ${formatRelative(request.neededBy)}`,
    tone: hoursRemaining <= 24 ? 'urgent' : 'normal',
  };
}
