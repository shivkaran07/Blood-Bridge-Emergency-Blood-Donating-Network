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
import { countdown, formatRelative } from '../../lib/format';
import { pluralize } from '../../lib/format';
import type { BloodRequest } from '../../types/api';
import { cn } from '../../lib/cn';

export function BloodGroupMark({ group, size = 'md' }: { group: string; size?: 'sm' | 'md' | 'lg' }) {
  const sizeClass = {
    sm: 'size-10 text-sm',
    md: 'size-12 text-base',
    lg: 'size-16 text-xl',
  }[size];
  return (
    <span
      className={cn(
        'flex shrink-0 items-center justify-center rounded-xl border border-brand-200 bg-brand-50 font-bold tracking-tight text-brand-800',
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

  return (
    <article
      className={cn(
        'group rounded-2xl border bg-white p-5 shadow-card transition hover:border-ink-300 hover:shadow-lift',
        urgent ? 'border-brand-200' : 'border-ink-200/80',
        className,
      )}
    >
      <div className="flex items-start gap-4">
        <BloodGroupMark group={request.bloodGroup} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <Link to={target} className="text-base font-semibold text-ink-900 hover:text-brand-800">
              {request.unitsRequested} {pluralize(request.unitsRequested, 'unit')} · {request.bloodGroup}
            </Link>
            <RequestStatusBadge status={request.status} />
            {urgent ? <PriorityBadge priority={request.priority} /> : null}
            {request.isOwner ? <Badge tone="outline">Your request</Badge> : null}
          </div>

          <div className="mt-2 space-y-1.5 text-sm text-ink-600">
            <p className="flex items-start gap-2">
              <Building2 className="mt-0.5 size-4 shrink-0 text-ink-400" aria-hidden="true" />
              <span className="font-medium text-ink-800">{request.hospitalName}</span>
            </p>
            <p className="flex items-start gap-2">
              <MapPin className="mt-0.5 size-4 shrink-0 text-ink-400" aria-hidden="true" />
              <span>
                {request.hospitalArea}, {request.hospitalCity}
              </span>
            </p>
            <p className="flex items-start gap-2">
              <Clock3 className="mt-0.5 size-4 shrink-0 text-ink-400" aria-hidden="true" />
              <span>
                Needed by {formatRelative(request.neededBy)}
                <span
                  className={cn(
                    'ml-2 font-semibold',
                    urgent ? 'text-brand-700' : 'text-ink-700',
                  )}
                >
                  {countdown(request.neededBy)}
                </span>
              </span>
            </p>
          </div>

          {request.publicMessage ? (
            <p className="mt-3 line-clamp-2 rounded-lg bg-ink-50 px-3 py-2 text-sm leading-relaxed text-ink-600">
              “{request.publicMessage}”
            </p>
          ) : null}

          <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-ink-500">
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
              <span className="inline-flex items-center gap-1.5 text-brand-700">
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
      </div>

      {footer ? <div className="mt-4 border-t border-ink-100 pt-4">{footer}</div> : null}
    </article>
  );
}
