import { useState, type ReactNode } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  AlertTriangle,
  ArrowLeft,
  Building2,
  CalendarClock,
  CheckCircle2,
  Copy,
  ExternalLink,
  HandHeart,
  MapPin,
  Package,
  Phone,
  RefreshCw,
  ShieldCheck,
  ShieldQuestion,
  Siren,
  Users,
  XCircle,
} from 'lucide-react';
import { useAuth, useAuthToken } from '../../context/AuthContext';
import { api, errorMessage } from '../../lib/api';
import { queryKeys } from '../../lib/queryClient';
import { requestStatusLabels } from '../../lib/constants';
import { countdown, formatDateTime, formatRelative, pluralize } from '../../lib/format';
import { invalidateRequest, invalidateWorkspace } from '../../lib/invalidate';
import { useToast } from '../../context/ToastContext';
import { Card, SectionCard } from '../../components/ui/Card';
import { Alert } from '../../components/ui/Alert';
import {
  Badge,
  BlockchainStatusBadge,
  PriorityBadge,
  RequestStatusBadge,
  VerificationTag,
} from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Modal } from '../../components/ui/Modal';
import { Field, Select, Textarea } from '../../components/ui/Field';
import { ErrorState, LoadingState } from '../../components/ui/States';
import { Table, TBody, Td, Th, THead, Tr } from '../../components/ui/Table';
import { BloodGroupMark } from '../../components/requests/RequestCard';
import { ResponseCard } from '../../components/responses/ResponseCard';
import type { RequestHistoryEntry } from '../../types/api';

type RequestDialog = 'cancel' | 'complete' | 'verify' | 'reject' | null;

type RequestAction =
  | { type: 'respond' }
  | { type: 'claim' }
  | { type: 'cancel'; reason: string }
  | { type: 'complete'; status: 'PARTIALLY_FULFILLED' | 'FULFILLED'; note: string }
  | { type: 'verify'; reason: string }
  | { type: 'reject'; reason: string };

type ResponseAction = 'accept' | 'decline' | 'withdraw' | 'complete';

export function RequestDetailPage() {
  const { id } = useParams<{ id: string }>();
  const token = useAuthToken();
  const { me } = useAuth();
  const queryClient = useQueryClient();
  const toast = useToast();

  const [dialog, setDialog] = useState<RequestDialog>(null);
  const [reason, setReason] = useState('');
  const [completionStatus, setCompletionStatus] =
    useState<'PARTIALLY_FULFILLED' | 'FULFILLED'>('FULFILLED');
  const [note, setNote] = useState('');
  const [dialogError, setDialogError] = useState<string | null>(null);

  const requestQuery = useQuery({
    queryKey: queryKeys.request(id ?? ''),
    queryFn: ({ signal }) => api.request(token, id ?? '', signal),
    enabled: Boolean(id),
  });

  const request = requestQuery.data;

  const historyQuery = useQuery({
    queryKey: queryKeys.requestHistory(id ?? ''),
    queryFn: ({ signal }) => api.requestHistory(token, id ?? '', signal),
    enabled: Boolean(
      id && request && (request.isOwner || me?.permissions.isAdmin || me?.permissions.isApprovedVerifier),
    ),
  });

  const responsesQuery = useQuery({
    queryKey: queryKeys.requestResponses(id ?? ''),
    queryFn: ({ signal }) => api.requestResponses(token, id ?? '', signal),
    enabled: Boolean(id && request?.permissions.canViewResponses),
  });

  const matchesQuery = useQuery({
    queryKey: queryKeys.requestMatches(id ?? ''),
    queryFn: ({ signal }) => api.requestMatches(token, id ?? '', signal),
    enabled: Boolean(
      id &&
        request?.permissions.canViewMatches &&
        ['VERIFIED', 'PARTIALLY_FULFILLED'].includes(request.status),
    ),
  });

  const blockchainQuery = useQuery({
    queryKey: queryKeys.requestBlockchain(id ?? ''),
    queryFn: ({ signal }) => api.requestBlockchain(token, id ?? '', signal),
    enabled: Boolean(
      id &&
        request &&
        (request.isOwner || me?.permissions.isAdmin || me?.permissions.isApprovedVerifier),
    ),
  });

  const requestAction = useMutation({
    mutationFn: async (action: RequestAction) => {
      if (!id) throw new Error('Missing request identifier.');
      switch (action.type) {
        case 'respond':
          return api.respondToRequest(token, id);
        case 'claim':
          return api.claimRequest(token, id);
        case 'cancel':
          return api.cancelRequest(token, id, action.reason);
        case 'complete':
          return api.completeRequest(token, id, action.status, action.note || null);
        case 'verify':
          return api.verifyRequest(token, id, action.reason || null);
        case 'reject':
          return api.rejectRequest(token, id, action.reason);
      }
    },
    onSuccess: async (_result, action) => {
      const messages: Record<RequestAction['type'], [string, string]> = {
        respond: ['Offer recorded', 'The requester can now review your offer.'],
        claim: ['Request claimed', 'The requester has been notified that review started.'],
        cancel: ['Request cancelled', 'Active donor offers were closed.'],
        complete: ['Completion recorded', 'This is an application acknowledgement, not medical proof.'],
        verify: ['Request verified', 'It is now visible to available donors with this exact blood group.'],
        reject: ['Request not verified', 'The requester can see the review reason.'],
      };
      const [title, message] = messages[action.type];
      toast.success(title, message);
      setDialog(null);
      setReason('');
      setNote('');
      setDialogError(null);
      await invalidateRequest(queryClient, id ?? '');
      await invalidateWorkspace(queryClient);
    },
    onError: (error) => {
      const message = errorMessage(error);
      if (dialog) {
        setDialogError(message);
      } else {
        toast.error('Action failed', message);
      }
    },
  });

  const responseAction = useMutation({
    mutationFn: ({ responseId, action }: { responseId: string; action: ResponseAction }) => {
      switch (action) {
        case 'accept':
          return api.decideResponse(token, responseId, 'ACCEPTED');
        case 'decline':
          return api.decideResponse(token, responseId, 'DECLINED');
        case 'withdraw':
          return api.withdrawResponse(token, responseId);
        case 'complete':
          return api.completeResponse(token, responseId);
      }
    },
    onSuccess: async (_result, variables) => {
      const messages: Record<ResponseAction, [string, string]> = {
        accept: ['Offer accepted', 'Contact details are shared only when both sides consented.'],
        decline: ['Offer declined', 'The donor has been notified.'],
        withdraw: ['Offer withdrawn', 'The requester has been notified.'],
        complete: ['Response marked complete', 'This is not a medical confirmation of donation.'],
      };
      const [title, message] = messages[variables.action];
      toast.success(title, message);
      await invalidateRequest(queryClient, id ?? '');
      await invalidateWorkspace(queryClient);
    },
    onError: (error) => toast.error('Could not update response', errorMessage(error)),
  });

  if (requestQuery.isLoading) {
    return <LoadingState label="Loading request…" />;
  }

  if (requestQuery.isError) {
    return (
      <div className="space-y-4">
        <Link to="/app/requests" className="inline-flex items-center gap-1.5 text-sm font-medium text-ink-500 hover:text-ink-900">
          <ArrowLeft className="size-4" aria-hidden="true" />
          Back to request feed
        </Link>
        <ErrorState
          title="Request unavailable"
          message={errorMessage(requestQuery.error)}
          onRetry={() => void requestQuery.refetch()}
        />
      </div>
    );
  }

  if (!request) return null;

  const isVerifier = Boolean(me?.permissions.isApprovedVerifier);
  const canCoordinate = request.isOwner || isVerifier;
  const responses = responsesQuery.data ?? [];
  const offered = responses.filter((response) => response.responseStatus === 'OFFERED');
  const accepted = responses.filter((response) => response.responseStatus === 'ACCEPTED');

  const openDialog = (next: Exclude<RequestDialog, null>) => {
    setDialogError(null);
    setDialog(next);
    if (next === 'complete') {
      setCompletionStatus(request.status === 'PARTIALLY_FULFILLED' ? 'FULFILLED' : 'PARTIALLY_FULFILLED');
    }
  };

  const submitDialog = () => {
    setDialogError(null);
    if (dialog === 'cancel') {
      if (reason.trim().length < 5) {
        setDialogError('Provide a cancellation reason of at least 5 characters.');
        return;
      }
      requestAction.mutate({ type: 'cancel', reason: reason.trim() });
    } else if (dialog === 'complete') {
      requestAction.mutate({ type: 'complete', status: completionStatus, note: note.trim() });
    } else if (dialog === 'verify') {
      requestAction.mutate({ type: 'verify', reason: reason.trim() });
    } else if (dialog === 'reject') {
      if (reason.trim().length < 10) {
        setDialogError('Provide a rejection reason of at least 10 characters.');
        return;
      }
      requestAction.mutate({ type: 'reject', reason: reason.trim() });
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Link to="/app/requests" className="inline-flex items-center gap-1.5 text-sm font-medium text-ink-500 hover:text-ink-900">
          <ArrowLeft className="size-4" aria-hidden="true" />
          Back to feed
        </Link>
        <div className="flex flex-wrap items-center gap-2">
          {request.isOwner ? <Badge tone="outline">Your request</Badge> : null}
          <Badge tone="neutral">Part 1 · database verification</Badge>
        </div>
      </div>

      <div className="rounded-2xl border border-ink-200 bg-white p-5 shadow-card sm:p-6">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-start">
          <BloodGroupMark group={request.bloodGroup} size="lg" />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-xl font-semibold tracking-tight text-ink-900 sm:text-2xl">
                {request.unitsRequested} {pluralize(request.unitsRequested, 'unit')} of{' '}
                {request.bloodGroup} needed
              </h1>
              <RequestStatusBadge status={request.status} />
              <PriorityBadge priority={request.priority} />
            </div>
            <p className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-ink-600">
              <span className="inline-flex items-center gap-1.5">
                <Building2 className="size-4 text-ink-400" aria-hidden="true" />
                <span className="font-medium text-ink-800">{request.hospitalName}</span>
              </span>
              <span className="inline-flex items-center gap-1.5">
                <MapPin className="size-4 text-ink-400" aria-hidden="true" />
                {request.hospitalArea}, {request.hospitalCity}
              </span>
              <span className="inline-flex items-center gap-1.5">
                <CalendarClock className="size-4 text-ink-400" aria-hidden="true" />
                Needed by {formatDateTime(request.neededBy)}
              </span>
            </p>
            <p className="mt-1.5 text-xs text-ink-500">
              Posted {formatRelative(request.createdAt)} · {request.responseCount} active{' '}
              {pluralize(request.responseCount, 'offer')} · {request.acceptedResponseCount} accepted
            </p>
            <div className="mt-3">
              <VerificationTag status={request.status} blockchainStatus={request.blockchainSyncStatus} />
            </div>
          </div>
        </div>

        {request.publicMessage ? (
          <blockquote className="mt-5 rounded-xl border-l-4 border-brand-300 bg-brand-50/50 px-4 py-3 text-sm leading-relaxed text-ink-700">
            {request.publicMessage}
          </blockquote>
        ) : null}

        <div className="mt-5 flex flex-wrap gap-2 border-t border-ink-100 pt-4">
          {request.permissions.canRespond ? (
            <Button
              isLoading={requestAction.isPending && requestAction.variables?.type === 'respond'}
              disabled={requestAction.isPending}
              onClick={() => requestAction.mutate({ type: 'respond' })}
              leftIcon={<HandHeart className="size-4" aria-hidden="true" />}
            >
              Offer to help
            </Button>
          ) : null}
          {request.permissions.canVerify && request.status === 'SUBMITTED' ? (
            <Button
              variant="secondary"
              isLoading={requestAction.isPending && requestAction.variables?.type === 'claim'}
              disabled={requestAction.isPending}
              onClick={() => requestAction.mutate({ type: 'claim' })}
            >
              Claim for review
            </Button>
          ) : null}
          {request.permissions.canVerify ? (
            <>
              <Button
                variant="primary"
                disabled={requestAction.isPending}
                onClick={() => openDialog('verify')}
                leftIcon={<CheckCircle2 className="size-4" aria-hidden="true" />}
              >
                Verify request
              </Button>
              <Button
                variant="danger"
                disabled={requestAction.isPending}
                onClick={() => openDialog('reject')}
                leftIcon={<XCircle className="size-4" aria-hidden="true" />}
              >
                Reject
              </Button>
            </>
          ) : null}
          {request.permissions.canComplete ? (
            <Button
              variant="soft"
              disabled={requestAction.isPending}
              onClick={() => openDialog('complete')}
              leftIcon={<Package className="size-4" aria-hidden="true" />}
            >
              Record completion
            </Button>
          ) : null}
          {request.permissions.canCancel ? (
            <Button
              variant="ghost"
              disabled={requestAction.isPending}
              onClick={() => openDialog('cancel')}
              leftIcon={<XCircle className="size-4" aria-hidden="true" />}
            >
              Cancel request
            </Button>
          ) : null}
          <Button
            variant="ghost"
            className="ml-auto"
            onClick={() => {
              void requestQuery.refetch();
              void responsesQuery.refetch();
              void historyQuery.refetch();
            }}
            leftIcon={<RefreshCw className="size-4" aria-hidden="true" />}
          >
            Refresh
          </Button>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,0.8fr)]">
        <div className="space-y-6">
          <SectionCard
            title="Request details"
            description="Only hospital staff and authorized users see requester identity and review notes."
          >
            <dl className="grid gap-4 sm:grid-cols-2">
              <DetailItem label="Blood group" value={request.bloodGroup} />
              <DetailItem label="Units requested" value={String(request.unitsRequested)} />
              <DetailItem label="Hospital" value={request.hospitalName} />
              <DetailItem
                label="Hospital location"
                value={`${request.hospitalArea}, ${request.hospitalCity}`}
              />
              <DetailItem label="Needed by" value={`${formatDateTime(request.neededBy)} (${countdown(request.neededBy)})`} />
              <DetailItem label="Priority" value={request.priority} />
              {request.requesterName ? (
                <DetailItem label="Requester" value={request.requesterName} />
              ) : null}
              <DetailItem label="Created" value={formatDateTime(request.createdAt)} />
              <DetailItem label="Last updated" value={formatDateTime(request.updatedAt)} />
              {request.reviewedAt ? (
                <DetailItem label="Reviewed" value={formatDateTime(request.reviewedAt)} />
              ) : null}
            </dl>

            {request.reviewReason ? (
              <Alert
                variant={request.status === 'REJECTED' ? 'danger' : 'neutral'}
                title={request.status === 'REJECTED' ? 'Review rejection reason' : 'Hospital review note'}
                className="mt-4"
              >
                {request.reviewReason}
              </Alert>
            ) : null}
            {request.cancellationReason ? (
              <Alert variant="warning" title="Cancellation reason" className="mt-4">
                {request.cancellationReason}
                {request.cancelledAt ? ` · ${formatDateTime(request.cancelledAt)}` : ''}
              </Alert>
            ) : null}
          </SectionCard>

          {request.permissions.canViewResponses ? (
            <SectionCard
              title="Donor offers"
              description="Accept or decline offers, then coordinate through consented contact details. Completion is an application acknowledgement, not medical proof."
              actions={
                <Badge tone="outline">
                  {offered.length} offered · {accepted.length} accepted
                </Badge>
              }
              bodyClassName="space-y-3"
            >
              {responsesQuery.isLoading ? (
                <p className="py-4 text-sm text-ink-500">Loading donor offers…</p>
              ) : responsesQuery.isError ? (
                <ErrorState
                  message={errorMessage(responsesQuery.error)}
                  onRetry={() => void responsesQuery.refetch()}
                />
              ) : responses.length === 0 ? (
                <p className="py-4 text-sm text-ink-500">
                  No donor offers yet. Verified requests appear to available donors with the exact
                  recorded blood group.
                </p>
              ) : (
                responses.map((response) => (
                  <ResponseCard
                    key={response.id}
                    response={response}
                    requestIsOwner={request.isOwner}
                    canCoordinate={canCoordinate}
                    canComplete={request.isOwner || isVerifier}
                    busy={
                      responseAction.isPending &&
                      responseAction.variables?.responseId === response.id
                    }
                    onAccept={() =>
                      responseAction.mutate({ responseId: response.id, action: 'accept' })
                    }
                    onDecline={() =>
                      responseAction.mutate({ responseId: response.id, action: 'decline' })
                    }
                    onWithdraw={() =>
                      responseAction.mutate({ responseId: response.id, action: 'withdraw' })
                    }
                    onComplete={() =>
                      responseAction.mutate({ responseId: response.id, action: 'complete' })
                    }
                  />
                ))
              )}
            </SectionCard>
          ) : null}

          {request.permissions.canViewMatches &&
          ['VERIFIED', 'PARTIALLY_FULFILLED'].includes(request.status) ? (
            <SectionCard
              title="Candidate matches"
              description="Masked donor candidates based on exact blood group, availability, consent and general location. This is not a medical compatibility result."
            >
              {matchesQuery.isLoading ? (
                <p className="py-4 text-sm text-ink-500">Loading candidate matches…</p>
              ) : matchesQuery.isError ? (
                <ErrorState
                  message={errorMessage(matchesQuery.error)}
                  onRetry={() => void matchesQuery.refetch()}
                />
              ) : matchesQuery.data && matchesQuery.data.matches.length > 0 ? (
                <>
                  <div className="mb-3 flex flex-wrap items-center gap-2">
                    <Badge tone="success" dot>
                      {matchesQuery.data.totalCandidates} candidates
                    </Badge>
                    <Badge tone="outline">Blood group {matchesQuery.data.bloodGroup}</Badge>
                    <span className="text-xs text-ink-400">Showing up to 20 masked results</span>
                  </div>
                  <Table minWidth={620}>
                    <THead>
                      <Th>Donor</Th>
                      <Th>Group</Th>
                      <Th>Location</Th>
                      <Th>Match basis</Th>
                      <Th>Availability</Th>
                    </THead>
                    <TBody>
                      {matchesQuery.data.matches.map((match, index) => (
                        <Tr key={`${match.displayName}-${index}`}>
                          <Td className="font-medium text-ink-900">{match.displayName}</Td>
                          <Td>
                            <Badge tone="brand">{match.bloodGroup}</Badge>
                          </Td>
                          <Td>
                            {match.city || match.area
                              ? [match.area, match.city].filter(Boolean).join(', ')
                              : 'Not provided'}
                            {match.distanceKm !== null ? (
                              <span className="ml-1 text-xs text-ink-400">
                                · ~{match.distanceKm} km
                              </span>
                            ) : null}
                          </Td>
                          <Td className="text-xs">{humanizeMatchBasis(match.matchBasis)}</Td>
                          <Td>
                            <Badge tone={match.isAvailable ? 'success' : 'neutral'} dot>
                              {match.isAvailable ? 'Available' : 'Paused'}
                            </Badge>
                          </Td>
                        </Tr>
                      ))}
                    </TBody>
                  </Table>
                  <p className="mt-3 text-xs leading-relaxed text-ink-500">{matchesQuery.data.matchingNotice}</p>
                </>
              ) : (
                <div className="rounded-xl border border-dashed border-ink-300 bg-ink-50 p-6 text-center">
                  <Users className="mx-auto size-6 text-ink-400" aria-hidden="true" />
                  <p className="mt-2 text-sm font-medium text-ink-800">No candidates found</p>
                  <p className="mt-1 text-xs text-ink-500">
                    No available donor with this exact blood group matched the city or distance
                    criteria. Matching falls back to general location.
                  </p>
                </div>
              )}
            </SectionCard>
          ) : null}

          {historyQuery.data ? (
            <SectionCard
              title="Status history"
              description="Every status transition is recorded with its actor and reason."
            >
              <RequestTimeline items={historyQuery.data} />
            </SectionCard>
          ) : null}

          {blockchainQuery.data ? (
            <SectionCard
              title="Audit reference"
              description="Opaque audit key and Part 1 synchronization state. No blockchain transaction exists in this phase."
              actions={<BlockchainStatusBadge status={blockchainQuery.data.blockchainSyncStatus} />}
            >
              <dl className="grid gap-4 sm:grid-cols-2">
                <DetailItem
                  label="Audit key"
                  value={
                    <span className="flex items-center gap-2">
                      <code className="break-all rounded bg-ink-100 px-1.5 py-0.5 text-xs">
                        {blockchainQuery.data.blockchainAuditKey}
                      </code>
                      <button
                        type="button"
                        className="rounded p-1 text-ink-400 hover:bg-ink-100 hover:text-ink-700"
                        aria-label="Copy audit key"
                        onClick={() => {
                          void navigator.clipboard?.writeText(
                            blockchainQuery.data.blockchainAuditKey,
                          );
                          toast.info('Audit key copied');
                        }}
                      >
                        <Copy className="size-3.5" />
                      </button>
                    </span>
                  }
                />
                <DetailItem label="Transactions recorded" value={String(blockchainQuery.data.transactionCount)} />
                <DetailItem label="Verification mode" value="Database (Part 1)" />
                <DetailItem
                  label="On-chain verified"
                  value={blockchainQuery.data.blockchainVerified ? 'Yes' : 'No'}
                />
              </dl>
              <p className="mt-3 text-xs leading-relaxed text-ink-500">{blockchainQuery.data.note}</p>
              <Link to="/app/blockchain" className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-brand-700 hover:text-brand-800">
                Verification & audit status
                <ExternalLink className="size-3.5" aria-hidden="true" />
              </Link>
            </SectionCard>
          ) : null}
        </div>

        <aside className="space-y-4">
          <Card>
            <h2 className="flex items-center gap-2 text-sm font-semibold text-ink-900">
              <ShieldCheck className="size-4 text-accent-600" aria-hidden="true" />
              Verification state
            </h2>
            <div className="mt-3 space-y-2 text-sm">
              <div className="flex items-center justify-between gap-2">
                <span className="text-ink-500">Request status</span>
                <RequestStatusBadge status={request.status} />
              </div>
              <div className="flex items-center justify-between gap-2">
                <span className="text-ink-500">Blockchain sync</span>
                <BlockchainStatusBadge status={request.blockchainSyncStatus} />
              </div>
            </div>
            <p className="mt-3 rounded-lg bg-ink-50 px-3 py-2 text-xs leading-relaxed text-ink-600">
              {request.verification.note}
            </p>
          </Card>

          {request.permissions.canViewRequesterContact && request.requesterContactPhone ? (
            <Card>
              <h2 className="flex items-center gap-2 text-sm font-semibold text-ink-900">
                <Phone className="size-4 text-ink-400" aria-hidden="true" />
                Requester contact
              </h2>
              <p className="mt-2 text-sm text-ink-600">
                Shared because{' '}
                {request.isOwner
                  ? 'this is your request'
                  : 'you are an authorized verifier or an accepted donor with consent'}
                .
              </p>
              <a
                href={`tel:${request.requesterContactPhone}`}
                className="mt-3 inline-flex h-10 w-full items-center justify-center rounded-lg bg-brand-700 text-sm font-semibold text-white hover:bg-brand-800"
              >
                {request.requesterContactPhone}
              </a>
            </Card>
          ) : (
            <Card>
              <h2 className="flex items-center gap-2 text-sm font-semibold text-ink-900">
                <ShieldQuestion className="size-4 text-ink-400" aria-hidden="true" />
                Contact protected
              </h2>
              <p className="mt-2 text-xs leading-relaxed text-ink-500">
                Requester phone numbers are not shown to browsing donors. Accepted donors see the
                requester contact only when the requester consented to sharing.
              </p>
            </Card>
          )}

          <Card>
            <h2 className="text-sm font-semibold text-ink-900">Safety and scope</h2>
            <ul className="mt-3 space-y-2 text-xs leading-relaxed text-ink-600">
              <li className="flex gap-2">
                <Siren className="mt-0.5 size-3.5 shrink-0 text-brand-600" aria-hidden="true" />
                For a life-threatening emergency, call local emergency services and the hospital
                directly.
              </li>
              <li className="flex gap-2">
                <AlertTriangle className="mt-0.5 size-3.5 shrink-0 text-amber-600" aria-hidden="true" />
                Exact blood-group matching is not a medical compatibility assessment.
              </li>
              <li className="flex gap-2">
                <ShieldCheck className="mt-0.5 size-3.5 shrink-0 text-accent-600" aria-hidden="true" />
                Hospital verification in Part 1 is database-backed only.
              </li>
            </ul>
          </Card>

          <Card>
            <h2 className="text-sm font-semibold text-ink-900">Request lookup</h2>
            <p className="mt-1.5 break-all text-xs text-ink-400">{request.id}</p>
          </Card>
        </aside>
      </div>

      <Modal
        open={dialog === 'cancel'}
        onClose={() => setDialog(null)}
        title="Cancel this blood request"
        description="Cancelling closes all active donor offers and notifies affected donors."
        footer={
          <>
            <Button variant="ghost" onClick={() => setDialog(null)}>Keep request</Button>
            <Button variant="danger" isLoading={requestAction.isPending} onClick={submitDialog}>
              Cancel request
            </Button>
          </>
        }
      >
        {dialogError ? <Alert variant="danger" className="mb-3">{dialogError}</Alert> : null}
        <Field label="Cancellation reason" htmlFor="cancel-reason" required hint="At least 5 characters.">
          <Textarea
            id="cancel-reason"
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            placeholder="e.g. Blood is no longer required by the hospital."
          />
        </Field>
      </Modal>

      <Modal
        open={dialog === 'complete'}
        onClose={() => setDialog(null)}
        title="Record request completion"
        description="This updates application state only. It is not a medical confirmation that a donation occurred."
        footer={
          <>
            <Button variant="ghost" onClick={() => setDialog(null)}>Cancel</Button>
            <Button isLoading={requestAction.isPending} onClick={submitDialog}>
              Record completion
            </Button>
          </>
        }
      >
        {dialogError ? <Alert variant="danger" className="mb-3">{dialogError}</Alert> : null}
        <div className="space-y-4">
          <Field label="Completion status" htmlFor="completion-status" required>
            <Select
              id="completion-status"
              value={completionStatus}
              onChange={(event) =>
                setCompletionStatus(event.target.value as 'PARTIALLY_FULFILLED' | 'FULFILLED')
              }
            >
              <option value="PARTIALLY_FULFILLED">Partially fulfilled</option>
              <option value="FULFILLED">Fulfilled</option>
            </Select>
          </Field>
          <Field label="Note" htmlFor="completion-note" optional hint="Visible in the request status history.">
            <Textarea
              id="completion-note"
              value={note}
              onChange={(event) => setNote(event.target.value)}
              placeholder="Optional coordination note."
            />
          </Field>
        </div>
      </Modal>

      <Modal
        open={dialog === 'verify'}
        onClose={() => setDialog(null)}
        title="Verify this request"
        description="You are recording a database verification as an approved hospital reviewer. This is not a blockchain verification."
        footer={
          <>
            <Button variant="ghost" onClick={() => setDialog(null)}>Cancel</Button>
            <Button isLoading={requestAction.isPending} onClick={submitDialog}>
              Confirm verification
            </Button>
          </>
        }
      >
        {dialogError ? <Alert variant="danger" className="mb-3">{dialogError}</Alert> : null}
        <Field label="Review note" htmlFor="verify-reason" optional hint="Visible to the requester and recorded in the audit trail.">
          <Textarea
            id="verify-reason"
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            placeholder="e.g. Institutional details and request information checked."
          />
        </Field>
        <Alert variant="info" className="mt-4">
          Verifying does not prove blood compatibility or donor eligibility. It records that a
          hospital reviewer checked the request in this application.
        </Alert>
      </Modal>

      <Modal
        open={dialog === 'reject'}
        onClose={() => setDialog(null)}
        title="Reject this request"
        description="Rejection is a database-backed review decision, recorded with your reason."
        footer={
          <>
            <Button variant="ghost" onClick={() => setDialog(null)}>Cancel</Button>
            <Button variant="danger" isLoading={requestAction.isPending} onClick={submitDialog}>
              Reject request
            </Button>
          </>
        }
      >
        {dialogError ? <Alert variant="danger" className="mb-3">{dialogError}</Alert> : null}
        <Field
          label="Rejection reason"
          htmlFor="reject-reason"
          required
          hint="At least 10 characters. The requester will see this reason."
        >
          <Textarea
            id="reject-reason"
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            placeholder="e.g. Hospital details could not be confirmed with the institution."
          />
        </Field>
      </Modal>
    </div>
  );
}

function DetailItem({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div>
      <dt className="text-xs font-medium uppercase tracking-wide text-ink-400">{label}</dt>
      <dd className="mt-1 text-sm font-medium text-ink-800">{value}</dd>
    </div>
  );
}

function RequestTimeline({ items }: { items: RequestHistoryEntry[] }) {
  if (items.length === 0) {
    return <p className="text-sm text-ink-500">No history entries.</p>;
  }
  return (
    <ol className="relative space-y-5 border-l border-ink-200 pl-5">
      {items.map((entry) => (
        <li key={entry.id} className="relative">
          <span className="absolute -left-[1.4rem] top-1.5 size-2.5 rounded-full border-2 border-white bg-brand-500" />
          <div className="flex flex-wrap items-center gap-2">
            <RequestStatusBadge status={entry.toStatus} />
            {entry.fromStatus ? (
              <span className="text-xs text-ink-400">
                from {requestStatusLabels[entry.fromStatus]}
              </span>
            ) : null}
          </div>
          <p className="mt-1 text-sm text-ink-700">{entry.reason ?? 'Status updated.'}</p>
          <p className="mt-0.5 text-xs text-ink-400">
            {entry.actorName ?? 'System'} · {formatDateTime(entry.createdAt)}
          </p>
        </li>
      ))}
    </ol>
  );
}

function humanizeMatchBasis(value: string): string {
  return value
    .toLowerCase()
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}
