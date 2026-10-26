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

  return (
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
                <span className="font-medium text-ink-900">
                  {auditEventLabels[event.eventType] ?? humanize(event.eventType)}
                </span>
                <Badge tone="outline">{event.eventType}</Badge>
              </div>
              {Object.keys(event.metadata ?? {}).length > 0 ? (
                <p className="mt-0.5 max-w-md truncate text-xs text-ink-400">
                  {Object.entries(event.metadata)
                    .slice(0, 3)
                    .map(([key, value]) => `${humanize(key)}: ${String(value)}`)
                    .join(' · ')}
                </p>
              ) : null}
            </Td>
            {showActor ? (
              <Td className="whitespace-nowrap">
                {event.actorName ?? <span className="text-ink-400">System</span>}
              </Td>
            ) : null}
            {showRequest ? (
              <Td>
                {event.requestId ? (
                  <Link
                    to={`/app/requests/${event.requestId}`}
                    className="inline-flex items-center gap-1 font-medium text-brand-700 hover:text-brand-800"
                  >
                    {event.requestHospitalName ?? 'View request'}
                    <ArrowUpRight className="size-3.5" aria-hidden="true" />
                  </Link>
                ) : (
                  <span className="text-ink-400">Account-level</span>
                )}
              </Td>
            ) : null}
            <Td className="whitespace-nowrap text-xs text-ink-500">{formatDateTime(event.createdAt)}</Td>
          </Tr>
        ))}
      </TBody>
    </Table>
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
                    className="text-brand-700 hover:text-brand-800"
                  >
                    {event.requestHospitalName ?? 'request'}
                  </Link>
                </>
              ) : null}
            </p>
          </div>
          <time className="shrink-0 text-xs text-ink-400">{formatDateTime(event.createdAt)}</time>
        </li>
      ))}
    </ul>
  );
}
