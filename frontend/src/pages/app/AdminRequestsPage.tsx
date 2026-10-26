import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, ClipboardList, Filter, Search, ShieldAlert, XCircle } from 'lucide-react';
import { useAuthToken } from '../../context/AuthContext';
import { api, errorMessage } from '../../lib/api';
import { queryKeys } from '../../lib/queryClient';
import {
  bloodGroupOptions,
  priorityOptions,
  requestStatusLabels,
} from '../../lib/constants';
import { invalidateWorkspace } from '../../lib/invalidate';
import { useToast } from '../../context/ToastContext';
import { PageHeader } from '../../components/ui/PageHeader';
import { SectionCard } from '../../components/ui/Card';
import { Alert } from '../../components/ui/Alert';
import { Badge } from '../../components/ui/Badge';
import { Button, buttonClasses } from '../../components/ui/Button';
import { Field, FormError, Input, Select, Textarea } from '../../components/ui/Field';
import { Modal } from '../../components/ui/Modal';
import { Pagination } from '../../components/ui/Pagination';
import { EmptyState, ErrorState, LoadingState } from '../../components/ui/States';
import { RequestCard } from '../../components/requests/RequestCard';
import type { BloodGroup, RequestPriority, RequestStatus } from '../../types/api';

const PAGE_SIZE = 10;

const cancellableStatuses: RequestStatus[] = ['SUBMITTED', 'UNDER_REVIEW', 'VERIFIED'];

export function AdminRequestsPage() {
  const token = useAuthToken();
  const queryClient = useQueryClient();
  const toast = useToast();

  const [status, setStatus] = useState<RequestStatus | ''>('');
  const [bloodGroup, setBloodGroup] = useState<BloodGroup | ''>('');
  const [priority, setPriority] = useState<RequestPriority | ''>('');
  const [cityDraft, setCityDraft] = useState('');
  const [city, setCity] = useState('');
  const [searchDraft, setSearchDraft] = useState('');
  const [search, setSearch] = useState('');
  const [offset, setOffset] = useState(0);

  const [cancelTarget, setCancelTarget] = useState<{ id: string; label: string } | null>(null);
  const [reason, setReason] = useState('');
  const [dialogError, setDialogError] = useState<string | null>(null);

  const filters = { status, bloodGroup, priority, city, search };

  const requests = useQuery({
    queryKey: queryKeys.adminRequests(filters),
    queryFn: ({ signal }) =>
      api.adminRequests(
        token,
        {
          status: status || undefined,
          bloodGroup: bloodGroup || undefined,
          priority: priority || undefined,
          city: city || undefined,
          search,
          limit: PAGE_SIZE,
          offset,
        },
        signal,
      ),
  });

  const suspicious = useQuery({
    queryKey: queryKeys.adminSuspicious,
    queryFn: ({ signal }) => api.adminSuspicious(token, signal),
  });

  const cancelRequest = useMutation({
    mutationFn: ({ id, reason: value }: { id: string; reason: string }) =>
      api.adminCancelRequest(token, id, value),
    onSuccess: async () => {
      toast.success('Request cancelled', 'The requester and active donors have been notified.');
      setCancelTarget(null);
      setReason('');
      setDialogError(null);
      await invalidateWorkspace(queryClient);
    },
    onError: (error) => {
      const message = errorMessage(error);
      setDialogError(message);
      toast.error('Could not cancel request', message);
    },
  });

  const clearFilters = () => {
    setStatus('');
    setBloodGroup('');
    setPriority('');
    setCity('');
    setCityDraft('');
    setSearch('');
    setSearchDraft('');
    setOffset(0);
  };

  const submitCancel = () => {
    if (!cancelTarget) return;
    setDialogError(null);
    if (reason.trim().length < 10) {
      setDialogError('Provide a cancellation reason of at least 10 characters.');
      return;
    }
    cancelRequest.mutate({ id: cancelTarget.id, reason: reason.trim() });
  };

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Administrator"
        title="All blood requests"
        description="Inspect every request, filter suspicious patterns and cancel an active request with a recorded administrative reason."
      />

      <Alert variant="warning" title="Administrative cancellation">
        Cancelling closes active donor offers and notifies participants. It does not delete the
        request or audit history. Use only when a request is invalid, duplicated or unsafe.
      </Alert>

      {suspicious.data && suspicious.data.items.length > 0 ? (
        <SectionCard
          title="Suspicious request patterns"
          description="Heuristic flags based on submission volume, recent rejections and concurrently active requests. Flags are not proof of abuse."
          actions={<Badge tone="warning">{suspicious.data.total} flagged</Badge>}
          bodyClassName="space-y-3"
        >
          {suspicious.data.items.slice(0, 3).map((item) => (
            <div key={item.request.id} className="rounded-xl border border-amber-200 bg-amber-50/50 p-4">
              <div className="flex flex-wrap items-start gap-2">
                <ShieldAlert className="mt-0.5 size-4 shrink-0 text-amber-700" aria-hidden="true" />
                <div className="min-w-0 flex-1">
                  <Link
                    to={`/app/requests/${item.request.id}`}
                    className="text-sm font-semibold text-ink-900 hover:text-brand-700"
                  >
                    {item.request.hospitalName} · {item.request.bloodGroup}
                  </Link>
                  <div className="mt-1.5 flex flex-wrap gap-1.5">
                    {item.reasons.map((flag) => (
                      <Badge key={flag} tone="warning">{flag}</Badge>
                    ))}
                  </div>
                  <p className="mt-2 text-xs text-ink-500">
                    {item.requestsLast24h} in 24h · {item.rejectedLast30d} rejected in 30d ·{' '}
                    {item.activeCount} active
                  </p>
                </div>
                {cancellableStatuses.includes(item.request.status) ? (
                  <Button
                    size="sm"
                    variant="danger"
                    onClick={() =>
                      setCancelTarget({
                        id: item.request.id,
                        label: `${item.request.hospitalName} · ${item.request.bloodGroup}`,
                      })
                    }
                  >
                    Cancel
                  </Button>
                ) : null}
              </div>
            </div>
          ))}
          {suspicious.data.items.length > 3 ? (
            <p className="text-xs text-ink-500">
              Showing 3 of {suspicious.data.items.length} flagged requests. Filter the full list
              below.
            </p>
          ) : null}
        </SectionCard>
      ) : null}

      <SectionCard title="Filter requests" bodyClassName="space-y-4">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Field label="Status" htmlFor="admin-status">
            <Select
              id="admin-status"
              value={status}
              onChange={(event) => {
                setStatus(event.target.value as RequestStatus | '');
                setOffset(0);
              }}
            >
              <option value="">All statuses</option>
              {Object.entries(requestStatusLabels).map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </Select>
          </Field>
          <Field label="Blood group" htmlFor="admin-group">
            <Select
              id="admin-group"
              value={bloodGroup}
              onChange={(event) => {
                setBloodGroup(event.target.value as BloodGroup | '');
                setOffset(0);
              }}
            >
              <option value="">All groups</option>
              {bloodGroupOptions.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </Select>
          </Field>
          <Field label="Priority" htmlFor="admin-priority">
            <Select
              id="admin-priority"
              value={priority}
              onChange={(event) => {
                setPriority(event.target.value as RequestPriority | '');
                setOffset(0);
              }}
            >
              <option value="">All priorities</option>
              {priorityOptions.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </Select>
          </Field>
          <Field label="City" htmlFor="admin-city">
            <Input
              id="admin-city"
              value={cityDraft}
              onChange={(event) => setCityDraft(event.target.value)}
              placeholder="Partial city"
            />
          </Field>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-ink-400" aria-hidden="true" />
            <Input
              className="pl-9"
              value={searchDraft}
              onChange={(event) => setSearchDraft(event.target.value)}
              placeholder="Search hospital name, requester or city"
              aria-label="Search requests"
            />
          </div>
          <Button
            leftIcon={<Filter className="size-4" aria-hidden="true" />}
            onClick={() => {
              setCity(cityDraft.trim());
              setSearch(searchDraft.trim());
              setOffset(0);
            }}
          >
            Apply filters
          </Button>
          <Button variant="ghost" onClick={clearFilters}>Clear</Button>
        </div>
      </SectionCard>

      {requests.isLoading ? (
        <LoadingState label="Loading requests…" />
      ) : requests.isError ? (
        <ErrorState message={errorMessage(requests.error)} onRetry={() => void requests.refetch()} />
      ) : requests.data && requests.data.items.length > 0 ? (
        <>
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone="outline">{requests.data.total} requests</Badge>
            <Badge tone="neutral">Live database results</Badge>
          </div>
          <div className="space-y-4">
            {requests.data.items.map((request) => (
              <RequestCard
                key={request.id}
                request={request}
                footer={
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <Link
                      to={`/app/requests/${request.id}`}
                      className={buttonClasses('secondary', 'sm')}
                    >
                      Inspect request
                    </Link>
                    {cancellableStatuses.includes(request.status) ? (
                      <Button
                        size="sm"
                        variant="danger"
                        onClick={() =>
                          setCancelTarget({
                            id: request.id,
                            label: `${request.hospitalName} · ${request.bloodGroup}`,
                          })
                        }
                        leftIcon={<XCircle className="size-3.5" aria-hidden="true" />}
                      >
                        Cancel request
                      </Button>
                    ) : (
                      <Badge tone="outline">No cancellation available</Badge>
                    )}
                  </div>
                }
              />
            ))}
          </div>
          <Pagination
            total={requests.data.total}
            limit={requests.data.limit}
            offset={requests.data.offset}
            onChange={setOffset}
            itemLabel="requests"
          />
        </>
      ) : (
        <EmptyState
          icon={<ClipboardList className="size-6" aria-hidden="true" />}
          title="No requests match"
          description="Adjust or clear the filters to see more requests."
          action={<Button variant="secondary" size="sm" onClick={clearFilters}>Clear filters</Button>}
        />
      )}

      <div className="flex items-start gap-2 rounded-xl border border-ink-200 bg-white px-4 py-3 text-xs leading-relaxed text-ink-500">
        <AlertTriangle className="mt-0.5 size-4 shrink-0 text-amber-500" aria-hidden="true" />
        Suspicious-pattern detection is a simple heuristic for operator awareness. It is not a
        fraud determination and must not be used as the sole basis for account action.
      </div>

      <Modal
        open={Boolean(cancelTarget)}
        onClose={() => setCancelTarget(null)}
        title="Cancel request as administrator"
        description={cancelTarget?.label}
        footer={
          <>
            <Button variant="ghost" onClick={() => setCancelTarget(null)}>Keep request</Button>
            <Button variant="danger" isLoading={cancelRequest.isPending} onClick={submitCancel}>
              Cancel request
            </Button>
          </>
        }
      >
        {dialogError ? <FormError>{dialogError}</FormError> : null}
        <Field
          label="Administrative reason"
          htmlFor="admin-cancel-reason"
          required
          hint="At least 10 characters. Shared with the requester and active donors."
          className="mt-3"
        >
          <Textarea
            id="admin-cancel-reason"
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            placeholder="e.g. Duplicate request confirmed with the requester."
          />
        </Field>
      </Modal>
    </div>
  );
}
