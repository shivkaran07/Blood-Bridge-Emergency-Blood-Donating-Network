import { Link } from 'react-router-dom';
import { ArrowUpRight, ScrollText } from 'lucide-react';
import { Table, TBody, Td, Th, THead, Tr } from '../ui/Table';
import { Badge } from '../ui/Badge';
import { EmptyState } from '../ui/States';
import { auditEventLabels } from '../../lib/constants';
import { formatDateTime, humanize } from '../../lib/format';
import type { AuditEvent } from '../../types/api';

export function AuditEventTable({
  items,
  showActor = true,
  showRequest = true,
}: {
  items: AuditEvent[];
  showActor?: boolean;
  showRequest?: boolean;
}) {
  if (items.length === 0) {
    return (
      <EmptyState
        icon={<ScrollText className="size-6" aria-hidden="true" />}
        title="No audit events yet"
        description="Status changes, review decisions and account actions appear here with an immutable record."
      />
    );
  }

  const labelFor = (event: AuditEvent) =>
    auditEventLabels[event.eventType] ?? humanize(event.eventType);

  return (
    <>
      <ul className="divide-y divide-ink-100 md:hidden">
        {items.map((event) => (
          <li key={event.id} className="py-3.5 first:pt-0 last:pb-0">
            <div className="flex items-start justify-between gap-3">
              <p className="min-w-0 text-sm font-medium text-ink-900">{labelFor(event)}</p>
              <time className="shrink-0 text-[0.6875rem] text-ink-500">
                {formatDateTime(event.createdAt)}
              </time>
            </div>
            {Object.keys(event.metadata ?? {}).length > 0 ? (
              <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-ink-500">
                {Object.entries(event.metadata)
                  .slice(0, 3)
                  .map(([key, value]) => `${humanize(key)}: ${String(value)}`)
                  .join(' · ')}
              </p>
            ) : null}
            <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[0.6875rem] text-ink-500">
              {showActor ? <span>{event.actorName ?? 'System'}</span> : null}
              {showRequest ? (
                event.requestId ? (
                  <Link
                    to={`/app/requests/${event.requestId}`}
                    className="inline-flex items-center gap-1 font-medium text-brand-accent hover:text-brand-accent-strong"
                  >
                    {event.requestHospitalName ?? 'View request'}
                    <ArrowUpRight className="size-3.5" aria-hidden="true" />
                  </Link>
                ) : (
                  <span>Account-level</span>
                )
              ) : null}
            </div>
          </li>
        ))}
      </ul>

      <div className="hidden md:block">
        <Table minWidth={680}>
          <THead>
            <Th>Event</Th>
            {showActor ? <Th>Actor</Th> : null}
            {showRequest ? <Th>Request</Th> : null}
            <Th>When</Th>
          </THead>
          <TBody>
            {items.map((event) => (
              <Tr key={event.id}>
                <Td>
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-ink-900">{labelFor(event)}</span>
                    <Badge tone="outline">{event.eventType}</Badge>
                  </div>
                  {Object.keys(event.metadata ?? {}).length > 0 ? (
                    <p className="mt-0.5 max-w-md truncate text-xs text-ink-500">
                      {Object.entries(event.metadata)
                        .slice(0, 3)
                        .map(([key, value]) => `${humanize(key)}: ${String(value)}`)
                        .join(' · ')}
                    </p>
                  ) : null}
                </Td>
                {showActor ? (
                  <Td className="whitespace-nowrap">
                    {event.actorName ?? <span className="text-ink-500">System</span>}
                  </Td>
                ) : null}
                {showRequest ? (
                  <Td>
                    {event.requestId ? (
                      <Link
                        to={`/app/requests/${event.requestId}`}
                        className="inline-flex items-center gap-1 font-medium text-brand-accent hover:text-brand-accent-strong"
                      >
                        {event.requestHospitalName ?? 'View request'}
                        <ArrowUpRight className="size-3.5" aria-hidden="true" />
                      </Link>
                    ) : (
                      <span className="text-ink-500">Account-level</span>
                    )}
                  </Td>
                ) : null}
                <Td className="whitespace-nowrap text-xs text-ink-500">
                  {formatDateTime(event.createdAt)}
                </Td>
              </Tr>
            ))}
          </TBody>
        </Table>
      </div>
    </>
  );
}

export function AuditFeed({ items }: { items: AuditEvent[] }) {
  if (items.length === 0) {
    return <p className="text-sm text-ink-500">No recent review decisions.</p>;
  }
  return (
    <ul className="divide-y divide-ink-100">
      {items.map((event) => (
        <li key={event.id} className="flex items-start gap-3 py-3 first:pt-0 last:pb-0">
          <span className="mt-1 size-2 shrink-0 rounded-full bg-brand-500" aria-hidden="true" />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-ink-800">
              {auditEventLabels[event.eventType] ?? humanize(event.eventType)}
            </p>
            <p className="mt-0.5 text-xs text-ink-500">
              {event.actorName ?? 'System'}
              {event.requestId ? (
                <>
                  {' · '}
                  <Link
                    to={`/app/requests/${event.requestId}`}
                    className="text-brand-accent hover:text-brand-accent-strong"
                  >
                    {event.requestHospitalName ?? 'request'}
                  </Link>
                </>
              ) : null}
            </p>
          </div>
          <time className="shrink-0 text-xs text-ink-500">{formatDateTime(event.createdAt)}</time>
        </li>
      ))}
    </ul>
  );
}
