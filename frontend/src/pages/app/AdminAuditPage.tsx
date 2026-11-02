import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Filter, ScrollText, Search } from 'lucide-react';
import { useAuthToken } from '../../context/AuthContext';
import { api, errorMessage } from '../../lib/api';
import { queryKeys } from '../../lib/queryClient';
import { auditEventLabels } from '../../lib/constants';
import { PageHeader } from '../../components/ui/PageHeader';
import { Alert } from '../../components/ui/Alert';
import { Button } from '../../components/ui/Button';
import { Field, Input, Select } from '../../components/ui/Field';
import { EmptyState, ErrorState, LoadingState } from '../../components/ui/States';
import { Pagination } from '../../components/ui/Pagination';
import { AuditEventTable } from '../../components/audit/AuditEventTable';

const PAGE_SIZE = 20;

export function AdminAuditPage() {
  const token = useAuthToken();
  const [eventTypeDraft, setEventTypeDraft] = useState('');
  const [eventType, setEventType] = useState('');
  const [requestIdDraft, setRequestIdDraft] = useState('');
  const [requestId, setRequestId] = useState('');
  const [actorIdDraft, setActorIdDraft] = useState('');
  const [actorId, setActorId] = useState('');
  const [offset, setOffset] = useState(0);

  const audit = useQuery({
    queryKey: queryKeys.adminAudit({ eventType, requestId, actorId, offset }),
    queryFn: ({ signal }) =>
      api.adminAudit(
        token,
        {
          eventType: eventType || undefined,
          requestId: requestId || undefined,
          actorUserId: actorId || undefined,
          limit: PAGE_SIZE,
          offset,
        },
        signal,
      ),
  });

  const clearFilters = () => {
    setEventType('');
    setEventTypeDraft('');
    setRequestId('');
    setRequestIdDraft('');
    setActorId('');
    setActorIdDraft('');
    setOffset(0);
  };

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Administrator"
        title="Application audit log"
        description="Request lifecycle events, verification decisions, donor responses and account actions recorded by the backend."
      />

      <Alert variant="neutral" title="Application audit, not clinical proof">
        These rows are stored in PostgreSQL and protected by backend authorization plus RLS.
        On-chain anchoring, where enabled, records an opaque audit reference — it never replaces
        this application audit log or a clinical check.
      </Alert>

      <form
        className="rounded-xl border border-ink-200/90 bg-surface-raised p-4 shadow-card sm:p-5"
        onSubmit={(event) => {
          event.preventDefault();
          setEventType(eventTypeDraft);
          setRequestId(requestIdDraft.trim());
          setActorId(actorIdDraft.trim());
          setOffset(0);
        }}
      >
        <div className="grid gap-3 lg:grid-cols-4">
          <Field label="Event type" htmlFor="audit-event-type">
            <Select
              id="audit-event-type"
              value={eventTypeDraft}
              onChange={(event) => setEventTypeDraft(event.target.value)}
            >
              <option value="">All events</option>
              {Object.entries(auditEventLabels).map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </Select>
          </Field>
          <Field label="Request ID" htmlFor="audit-request-id" hint="Exact UUID.">
            <Input
              id="audit-request-id"
              value={requestIdDraft}
              onChange={(event) => setRequestIdDraft(event.target.value)}
              placeholder="00000000-0000-…"
            />
          </Field>
          <Field label="Actor user ID" htmlFor="audit-actor-id" hint="Exact UUID.">
            <Input
              id="audit-actor-id"
              value={actorIdDraft}
              onChange={(event) => setActorIdDraft(event.target.value)}
              placeholder="00000000-0000-…"
            />
          </Field>
          <div className="flex items-end gap-2">
            <Button
              type="submit"
              leftIcon={<Filter className="size-4" aria-hidden="true" />}
            >
              Apply
            </Button>
            <Button type="button" variant="ghost" onClick={clearFilters}>Clear</Button>
          </div>
        </div>
      </form>

      {audit.isLoading ? (
        <LoadingState label="Loading audit events…" />
      ) : audit.isError ? (
        <ErrorState message={errorMessage(audit.error)} onRetry={() => void audit.refetch()} />
      ) : audit.data && audit.data.items.length > 0 ? (
        <>
          <div className="rounded-xl border border-ink-200/90 bg-surface-raised p-4 shadow-card sm:p-5">
            <AuditEventTable items={audit.data.items} />
          </div>
          <Pagination
            total={audit.data.total}
            limit={PAGE_SIZE}
            offset={offset}
            onChange={setOffset}
            itemLabel="events"
          />
        </>
      ) : (
        <EmptyState
          icon={<ScrollText className="size-6" aria-hidden="true" />}
          title="No audit events match"
          description="Clear the filters or wait for new application activity."
          action={
            eventType || requestId || actorId ? (
              <Button variant="secondary" size="sm" onClick={clearFilters}>
                Clear filters
              </Button>
            ) : undefined
          }
        />
      )}

      <div className="flex items-start gap-2 text-xs leading-relaxed text-ink-500">
        <Search className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
        Audit metadata is deliberately non-sensitive. Authentication tokens, passwords and full
        contact details are not written to this log.
      </div>
    </div>
  );
}
