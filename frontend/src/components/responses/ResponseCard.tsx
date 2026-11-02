import { Link } from 'react-router-dom';
import {
  Building2,
  Check,
  Clock3,
  MapPin,
  Phone,
  ShieldQuestion,
  UserRound,
  X,
} from 'lucide-react';
import { Badge, ResponseStatusBadge } from '../ui/Badge';
import { Button } from '../ui/Button';
import { BloodGroupMark } from '../requests/RequestCard';
import { formatDateTime, formatRelative } from '../../lib/format';
import type { DonorResponse } from '../../types/api';

export function ResponseCard({
  response,
  requestIsOwner = false,
  canComplete = false,
  canCoordinate = false,
  showRequest = false,
  busy = false,
  onAccept,
  onDecline,
  onWithdraw,
  onComplete,
}: {
  response: DonorResponse;
  requestIsOwner?: boolean;
  canComplete?: boolean;
  canCoordinate?: boolean;
  showRequest?: boolean;
  busy?: boolean;
  onAccept?: () => void;
  onDecline?: () => void;
  onWithdraw?: () => void;
  onComplete?: () => void;
}) {
  const canDecide = requestIsOwner && response.responseStatus === 'OFFERED';
  const canWithdraw =
    response.isOwn && ['OFFERED', 'ACCEPTED'].includes(response.responseStatus);
  const canMarkComplete =
    canComplete && response.responseStatus === 'ACCEPTED' && Boolean(onComplete);

  return (
    <article className="rounded-xl border border-ink-200 bg-surface-raised p-4 sm:p-5">
      <div className="flex flex-wrap items-start gap-4">
        <BloodGroupMark group={response.donorBloodGroup ?? '—'} size="sm" />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="font-semibold text-ink-900">
              {response.donorDisplayName}
              {response.isOwn ? (
                <span className="ml-2 text-xs font-medium text-ink-500">you</span>
              ) : null}
            </p>
            <ResponseStatusBadge status={response.responseStatus} />
            {response.contactShared ? (
              <Badge tone="success" dot>
                Contact shared
              </Badge>
            ) : (
              <Badge tone="outline">Contact protected</Badge>
            )}
          </div>

          <div className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-ink-500">
            <span className="inline-flex items-center gap-1">
              <UserRound className="size-3.5" aria-hidden="true" />
              {response.donorCity || response.donorArea
                ? [response.donorArea, response.donorCity].filter(Boolean).join(', ')
                : 'Location not provided'}
            </span>
            <span className="inline-flex items-center gap-1">
              <Clock3 className="size-3.5" aria-hidden="true" />
              Offered {formatRelative(response.createdAt)}
            </span>
          </div>

          {response.donorPhone ? (
            <p className="mt-2 inline-flex items-center gap-1.5 rounded-lg bg-accent-50 px-2.5 py-1.5 text-xs font-medium text-accent-800">
              <Phone className="size-3.5" aria-hidden="true" />
              <a href={`tel:${response.donorPhone}`} className="underline-offset-2 hover:underline">
                {response.donorPhone}
              </a>
            </p>
          ) : canCoordinate && response.responseStatus === 'OFFERED' ? (
            <p className="mt-2 flex items-start gap-1.5 text-xs leading-relaxed text-ink-500">
              <ShieldQuestion className="mt-px size-3.5 shrink-0" aria-hidden="true" />
              {response.isOwn
                ? 'Your phone number is hidden until the requester accepts your offer and you have consented to contact.'
                : 'Phone number is revealed only after acceptance, when the donor consented to contact.'}
            </p>
          ) : null}

          {showRequest && response.request ? (
            <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 rounded-lg bg-ink-50 px-3 py-2 text-xs text-ink-600">
              <span className="inline-flex items-center gap-1.5">
                <Building2 className="size-3.5" aria-hidden="true" />
                <Link
                  to={`/app/requests/${response.request.id}`}
                  className="font-semibold text-ink-800 hover:text-brand-accent"
                >
                  {response.request.hospitalName}
                </Link>
              </span>
              <span className="inline-flex items-center gap-1.5">
                <MapPin className="size-3.5" aria-hidden="true" />
                {response.request.hospitalArea}, {response.request.hospitalCity}
              </span>
              <span>
                {response.request.bloodGroup} · needed by {formatDateTime(response.request.neededBy)}
              </span>
            </div>
          ) : null}
        </div>
      </div>

      {canDecide || canWithdraw || canMarkComplete ? (
        <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-ink-100 pt-3.5">
          {canDecide ? (
            <>
              <Button
                size="sm"
                isLoading={busy}
                onClick={onAccept}
                leftIcon={<Check className="size-4" />}
              >
                Accept offer
              </Button>
              <Button
                size="sm"
                variant="secondary"
                disabled={busy}
                onClick={onDecline}
                leftIcon={<X className="size-4" />}
              >
                Decline
              </Button>
            </>
          ) : null}
          {canWithdraw ? (
            <Button size="sm" variant="secondary" disabled={busy} onClick={onWithdraw}>
              Withdraw offer
            </Button>
          ) : null}
          {canMarkComplete ? (
            <Button size="sm" variant="soft" disabled={busy} onClick={onComplete}>
              Mark response complete
            </Button>
          ) : null}
          <span className="text-xs text-ink-500">
            Completion is an application acknowledgement, not medical proof.
          </span>
        </div>
      ) : null}
    </article>
  );
}
