import type { HTMLAttributes, ReactNode } from 'react';
import { cn } from '../../lib/cn';
import {
  requestStatusLabels,
  responseStatusLabels,
  roleLabels,
} from '../../lib/constants';
import type {
  BlockchainSyncStatus,
  RequestPriority,
  RequestStatus,
  ResponseStatus,
} from '../../types/api';

export type BadgeTone =
  | 'neutral'
  | 'info'
  | 'success'
  | 'warning'
  | 'danger'
  | 'brand'
  | 'outline';

const toneClasses: Record<BadgeTone, string> = {
  neutral: 'border-ink-200 bg-ink-100 text-ink-700',
  info: 'border-sky-200 bg-sky-50 text-sky-800',
  success: 'border-accent-200 bg-accent-50 text-accent-800',
  warning: 'border-amber-200 bg-amber-50 text-amber-800',
  danger: 'border-brand-200 bg-brand-50 text-brand-accent',
  brand: 'border-brand-800 bg-brand-700 text-white',
  outline: 'border-ink-300 bg-transparent text-ink-600',
};

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  tone?: BadgeTone;
  dot?: boolean;
  children: ReactNode;
}

export function Badge({ tone = 'neutral', dot, className, children, ...props }: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border px-2 py-0.5 text-[0.6875rem] font-semibold leading-4 tracking-[0.005em]',
        toneClasses[tone],
        className,
      )}
      {...props}
    >
      {dot ? <span className="size-1.5 shrink-0 rounded-full bg-current" aria-hidden="true" /> : null}
      {children}
    </span>
  );
}

const requestTone: Record<RequestStatus, BadgeTone> = {
  SUBMITTED: 'info',
  UNDER_REVIEW: 'warning',
  VERIFIED: 'success',
  REJECTED: 'danger',
  PARTIALLY_FULFILLED: 'warning',
  FULFILLED: 'success',
  CANCELLED: 'neutral',
  EXPIRED: 'neutral',
};

export function RequestStatusBadge({ status }: { status: RequestStatus }) {
  return (
    <Badge tone={requestTone[status]} dot>
      {requestStatusLabels[status]}
    </Badge>
  );
}

const responseTone: Record<ResponseStatus, BadgeTone> = {
  OFFERED: 'info',
  ACCEPTED: 'success',
  DECLINED: 'neutral',
  WITHDRAWN: 'neutral',
  COMPLETED: 'success',
  CANCELLED: 'neutral',
};

export function ResponseStatusBadge({ status }: { status: ResponseStatus }) {
  return (
    <Badge tone={responseTone[status]} dot>
      {responseStatusLabels[status]}
    </Badge>
  );
}

const priorityTone: Record<RequestPriority, BadgeTone> = {
  NORMAL: 'neutral',
  URGENT: 'warning',
  CRITICAL: 'danger',
};

export function PriorityBadge({ priority }: { priority: RequestPriority }) {
  return (
    <Badge tone={priorityTone[priority]}>
      {priority === 'CRITICAL' ? 'Critical priority' : priority === 'URGENT' ? 'Urgent' : 'Normal priority'}
    </Badge>
  );
}

export function RoleBadge({ role }: { role: string }) {
  const tone: BadgeTone =
    role === 'ADMIN' ? 'brand' : role === 'HOSPITAL' ? 'info' : role === 'DONOR' ? 'success' : 'neutral';
  return <Badge tone={tone}>{roleLabels[role] ?? role}</Badge>;
}

const syncTone: Record<BlockchainSyncStatus, BadgeTone> = {
  NOT_SCHEDULED: 'neutral',
  AWAITING_WALLET: 'warning',
  SUBMITTED: 'info',
  CONFIRMED: 'success',
  FAILED: 'danger',
  NEEDS_RECONCILIATION: 'warning',
};

export function BlockchainStatusBadge({ status }: { status: BlockchainSyncStatus }) {
  const label =
    status === 'NOT_SCHEDULED'
      ? 'Not scheduled'
      : status === 'AWAITING_WALLET'
        ? 'Awaiting wallet'
        : status.charAt(0) + status.slice(1).toLowerCase();
  return <Badge tone={syncTone[status]}>{label}</Badge>;
}

/**
 * Distinguishes an application decision from a transaction confirmed by the
 * backend against the configured chain.
 */
export function VerificationTag({
  status,
  blockchainStatus,
}: {
  status: RequestStatus;
  blockchainStatus: BlockchainSyncStatus;
}) {
  if (['SUBMITTED', 'UNDER_REVIEW'].includes(status)) {
    return <Badge tone="warning">Awaiting hospital review</Badge>;
  }
  if (status === 'VERIFIED' || status === 'PARTIALLY_FULFILLED' || status === 'FULFILLED') {
    return (
      <span className="inline-flex flex-wrap items-center gap-1.5">
        <Badge tone="success">{blockchainStatus === 'CONFIRMED' ? 'On-chain transaction confirmed' : 'Application verified'}</Badge>
        {blockchainStatus !== 'CONFIRMED' ? <Badge tone="outline">No confirmed on-chain anchor</Badge> : null}
      </span>
    );
  }
  if (status === 'REJECTED') return <Badge tone="danger">Verification rejected</Badge>;
  if (blockchainStatus === 'CONFIRMED') {
    return <Badge tone="success">On-chain anchor confirmed</Badge>;
  }
  return <Badge tone="neutral">Not open</Badge>;
}
