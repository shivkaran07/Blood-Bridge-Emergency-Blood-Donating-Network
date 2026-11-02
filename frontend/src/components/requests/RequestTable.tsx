import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Building2, Clock3 } from 'lucide-react';
import { PriorityBadge, RequestStatusBadge } from '../ui/Badge';
import { BloodGroupMark } from './RequestCard';
import { pluralize } from '../../lib/format';
import { deadlinePresentation } from '../../lib/requestPresentation';
import type { BloodRequest } from '../../types/api';
import { cn } from '../../lib/cn';

/**
 * Compact, structured request list.
 *
 * Desktop renders an aligned column layout; below `md` the same record becomes
 * a readable card row without a horizontally scrolling table.
 */
export function RequestTable({
  requests,
  empty,
  className,
}: {
  requests: BloodRequest[];
  empty?: ReactNode;
  className?: string;
}) {
  if (requests.length === 0) return <>{empty}</>;

  return (
    <div
      className={cn(
        'overflow-hidden rounded-xl border border-ink-200/90 bg-surface-raised shadow-card',
        className,
      )}
    >
      <div className="hidden grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)_auto_auto] gap-4 border-b border-ink-100 bg-ink-50/60 px-4 py-2.5 text-[0.625rem] font-semibold uppercase tracking-[0.1em] text-ink-500 md:grid">
        <span>Request</span>
        <span>Hospital</span>
        <span>Status</span>
        <span className="text-right">Needed by</span>
      </div>
      <ul className="divide-y divide-ink-100">
        {requests.map((request) => (
          <li key={request.id} className={request.status === 'EXPIRED' ? 'opacity-70' : undefined}>
            <RequestRow request={request} />
          </li>
        ))}
      </ul>
    </div>
  );
}

export function RequestRow({ request }: { request: BloodRequest }) {
  const urgent = request.priority === 'CRITICAL' || request.priority === 'URGENT';
  const code = request.id.slice(0, 8).toUpperCase();
  const deadline = deadlinePresentation(request);
  const deadlineTone =
    deadline.tone === 'past'
      ? 'text-ink-500'
      : deadline.tone === 'closed'
        ? 'text-ink-500'
        : deadline.tone === 'urgent' || urgent
          ? 'text-brand-accent'
          : 'text-ink-700';

  return (
    <Link
      to={`/app/requests/${request.id}`}
      className="group block px-4 py-3.5 transition hover:bg-ink-50/60 focus-visible:bg-ink-50/60"
    >
      <div className="flex items-start gap-3 md:grid md:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)_auto_auto] md:items-center md:gap-4">
        <div className="flex min-w-0 flex-1 items-start gap-3">
          <BloodGroupMark group={request.bloodGroup} size="sm" />
          <div className="min-w-0">
            <p className="flex flex-wrap items-center gap-x-2 gap-y-1">
              <span className="text-[0.875rem] font-semibold text-ink-900">
                {request.unitsRequested} {pluralize(request.unitsRequested, 'unit')} ·{' '}
                {request.bloodGroup}
              </span>
              {urgent ? <PriorityBadge priority={request.priority} /> : null}
            </p>
            <p className="mt-1 text-[0.6875rem] text-ink-500">
              REQ-{code} · {request.responseCount}{' '}
              {pluralize(request.responseCount, 'response')}
            </p>
            <p className="mt-1.5 flex items-center gap-1.5 text-[0.75rem] text-ink-600 md:hidden">
              <Building2 className="size-3.5 shrink-0 text-ink-400" aria-hidden="true" />
              <span className="truncate">{request.hospitalName}</span>
            </p>
          </div>
        </div>

        <div className="hidden min-w-0 md:block">
          <p className="truncate text-[0.8125rem] font-medium text-ink-800">
            {request.hospitalName}
          </p>
          <p className="mt-0.5 truncate text-[0.6875rem] text-ink-500">
            {request.hospitalArea}, {request.hospitalCity}
          </p>
        </div>

        <div className="hidden shrink-0 md:block">
          <RequestStatusBadge status={request.status} />
        </div>

        <div className="ml-auto hidden shrink-0 items-center gap-2 md:flex md:w-[7rem] md:justify-end">
          <div className="text-right">
            <p className={cn('text-[0.75rem] font-semibold', deadlineTone)}>
              {deadline.label}
            </p>
            <p className="mt-0.5 flex items-center justify-end gap-1 text-[0.625rem] text-ink-500">
              <Clock3 className="size-3" aria-hidden="true" />
              {deadline.hint}
            </p>
          </div>
          <ArrowRight
            className="size-4 shrink-0 text-ink-300 transition group-hover:translate-x-0.5 group-hover:text-brand-accent"
            aria-hidden="true"
          />
        </div>
      </div>

      <div className="mt-3 flex items-center justify-between gap-3 border-t border-ink-100 pt-2.5 md:hidden">
        <RequestStatusBadge status={request.status} />
        <span
          className={cn(
            'flex items-center gap-1 text-[0.6875rem] font-medium',
            deadlineTone,
          )}
        >
          <Clock3 className="size-3" aria-hidden="true" />
          {deadline.mobileLabel}
        </span>
        <ArrowRight
          className="size-4 shrink-0 text-ink-300 transition group-hover:translate-x-0.5 group-hover:text-brand-accent"
          aria-hidden="true"
        />
      </div>
    </Link>
  );
}
