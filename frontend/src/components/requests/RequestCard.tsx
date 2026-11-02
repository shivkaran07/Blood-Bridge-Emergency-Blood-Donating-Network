import { Link } from 'react-router-dom';
import {
  Building2,
  Clock3,
  Droplets,
  MapPin,
  ShieldCheck,
  UserRound,
  Users,
} from 'lucide-react';
import { Badge, PriorityBadge, RequestStatusBadge } from '../ui/Badge';
import { countdown, formatDateTime, formatRelative, pluralize } from '../../lib/format';
import type { BloodRequest } from '../../types/api';
import { cn } from '../../lib/cn';

export function BloodGroupMark({ group, size = 'md' }: { group: string; size?: 'sm' | 'md' | 'lg' }) {
  const sizeClass = {
    sm: 'size-9 text-[0.8125rem] rounded-lg',
    md: 'size-11 text-[0.9375rem] rounded-xl',
    lg: 'size-14 text-xl rounded-xl',
  }[size];
  return (
    <span
      className={cn(
        'flex shrink-0 items-center justify-center border border-brand-200/90 bg-brand-50/90 dark:border-brand-800/80 dark:bg-brand-950/60 font-bold tracking-tight text-brand-accent shadow-[inset_0_1px_0_rgba(255,255,255,0.2)]',
        sizeClass,
      )}
      aria-label={`Blood group ${group}`}
    >
      {group}
    </span>
  );
}

export function RequestCard({
  request,
  to,
  footer,
  className,
}: {
  request: BloodRequest;
  to?: string;
  footer?: React.ReactNode;
  className?: string;
}) {
  const target = to ?? `/app/requests/${request.id}`;
  const urgent = request.priority === 'CRITICAL' || request.priority === 'URGENT';
  const code = request.id.slice(0, 8).toUpperCase();

  return (
    <article
      className={cn(
        'group interactive-surface relative overflow-hidden rounded-xl border bg-surface-raised shadow-card transition hover:border-ink-300 hover:shadow-lift',
        urgent ? 'border-brand-200' : 'border-ink-200/90',
        className,
      )}
    >
      {urgent ? (
        <span className="absolute inset-y-0 left-0 w-[3px] bg-brand-500" aria-hidden="true" />
      ) : null}

      <div className="p-5">
        <div className="flex items-start gap-3.5">
          <BloodGroupMark group={request.bloodGroup} />

          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-2">
              <div className="min-w-0">
                <p className="text-[0.625rem] font-semibold uppercase tracking-[0.12em] text-ink-400">
                  REQ-{code}
                </p>
                <Link
                  to={target}
                  className="mt-0.5 block text-[1.0625rem] font-semibold tracking-[-0.015em] text-ink-900 hover:text-brand-accent-strong"
                >
                  {request.unitsRequested} {pluralize(request.unitsRequested, 'unit')} ·{' '}
                  {request.bloodGroup}
                </Link>
              </div>
              <div className="flex flex-wrap items-center gap-1.5">
                <RequestStatusBadge status={request.status} />
                {urgent ? <PriorityBadge priority={request.priority} /> : null}
                {request.isOwner ? <Badge tone="outline">Your request</Badge> : null}
              </div>
            </div>

            <div className="mt-3 grid gap-2 text-[0.8125rem] text-ink-600 sm:grid-cols-2">
              <p className="flex items-start gap-2">
                <Building2 className="mt-0.5 size-4 shrink-0 text-ink-400" aria-hidden="true" />
                <span className="min-w-0 font-medium text-ink-800">{request.hospitalName}</span>
              </p>
              <p className="flex items-start gap-2">
                <MapPin className="mt-0.5 size-4 shrink-0 text-ink-400" aria-hidden="true" />
                <span className="min-w-0">
                  {request.hospitalArea}, {request.hospitalCity}
                </span>
              </p>
              <p className="flex items-start gap-2 sm:col-span-2">
                <Clock3 className="mt-0.5 size-4 shrink-0 text-ink-400" aria-hidden="true" />
                <span>
                  Needed by {formatDateTime(request.neededBy)}
                  <span
                    className={cn(
                      'ml-2 font-semibold',
                      urgent ? 'text-brand-accent' : 'text-ink-700',
                    )}
                  >
                    {countdown(request.neededBy)}
                  </span>
                </span>
              </p>
            </div>
          </div>
        </div>

        {request.publicMessage ? (
          <p className="mt-4 line-clamp-2 border-l-2 border-ink-200 pl-3 text-[0.8125rem] leading-relaxed text-ink-600">
            “{request.publicMessage}”
          </p>
        ) : null}

        <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1.5 border-t border-ink-100 pt-3 text-[0.6875rem] text-ink-500">
          <span className="inline-flex items-center gap-1.5">
            <Users className="size-3.5" aria-hidden="true" />
            {request.responseCount} active {pluralize(request.responseCount, 'response')}
          </span>
          <span className="inline-flex items-center gap-1.5">
            <UserRound className="size-3.5" aria-hidden="true" />
            {request.acceptedResponseCount} accepted
          </span>
          {['VERIFIED', 'PARTIALLY_FULFILLED', 'FULFILLED'].includes(request.status) ? (
            <span className="inline-flex items-center gap-1.5 text-accent-700">
              <ShieldCheck className="size-3.5" aria-hidden="true" />
              Database verified — not on-chain
            </span>
          ) : request.status === 'SUBMITTED' || request.status === 'UNDER_REVIEW' ? (
            <span className="inline-flex items-center gap-1.5 text-amber-700">
              <ShieldCheck className="size-3.5" aria-hidden="true" />
              Awaiting hospital review
            </span>
          ) : request.status === 'REJECTED' ? (
            <span className="inline-flex items-center gap-1.5 text-brand-accent">
              <ShieldCheck className="size-3.5" aria-hidden="true" />
              Verification rejected
            </span>
          ) : null}
          <span className="inline-flex items-center gap-1.5">
            <Droplets className="size-3.5" aria-hidden="true" />
            Posted {formatRelative(request.createdAt)}
          </span>
        </div>
      </div>

      {footer ? <div className="border-t border-ink-100 px-5 py-3.5">{footer}</div> : null}
    </article>
  );
}
