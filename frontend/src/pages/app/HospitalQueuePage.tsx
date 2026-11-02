import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ClipboardCheck } from 'lucide-react';
import { useAuthToken } from '../../context/AuthContext';
import { api, errorMessage } from '../../lib/api';
import { queryKeys } from '../../lib/queryClient';
import { PageHeader } from '../../components/ui/PageHeader';
import { Alert } from '../../components/ui/Alert';
import { Badge } from '../../components/ui/Badge';
import { buttonClasses } from '../../components/ui/Button';
import { EmptyState, ErrorState, LoadingState } from '../../components/ui/States';
import { Pagination } from '../../components/ui/Pagination';
import { RequestCard } from '../../components/requests/RequestCard';

const PAGE_SIZE = 10;

export function HospitalQueuePage() {
  const token = useAuthToken();
  const [offset, setOffset] = useState(0);

  const queue = useQuery({
    queryKey: queryKeys.hospitalQueue(offset),
    queryFn: ({ signal }) =>
      api.hospitalQueue(token, { limit: PAGE_SIZE, offset }, signal),
  });

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Hospital verifier"
        title="Verification queue"
        description="Review submitted requests, check institutional details and record a database-backed decision with a reason."
        actions={
          <Link to="/app/hospital/audit" className={buttonClasses('secondary', 'md')}>
            Review history
          </Link>
        }
      />

      <Alert variant="info" title="Review before verifying">
        Confirm the hospital, blood group, units and required-by time. You cannot review your own
        request. Every decision is recorded against your account in the audit trail.
      </Alert>

      {queue.isLoading ? (
        <LoadingState label="Loading verification queue…" />
      ) : queue.isError ? (
        <ErrorState message={errorMessage(queue.error)} onRetry={() => void queue.refetch()} />
      ) : queue.data && queue.data.items.length > 0 ? (
        <>
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone="warning" dot>
              {queue.data.total} awaiting review
            </Badge>
            <Badge tone="outline">Oldest first</Badge>
          </div>
          <div className="space-y-4">
            {queue.data.items.map((request) => (
              <RequestCard
                key={request.id}
                request={request}
                footer={
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <Link
                      to={`/app/requests/${request.id}`}
                      className={buttonClasses('primary', 'sm')}
                    >
                      Review request
                    </Link>
                    <span className="text-xs text-ink-500">
                      Submitted {new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(request.createdAt))}
                    </span>
                  </div>
                }
              />
            ))}
          </div>
          <Pagination
            total={queue.data.total}
            limit={queue.data.limit}
            offset={queue.data.offset}
            onChange={setOffset}
            itemLabel="requests"
          />
        </>
      ) : (
        <EmptyState
          icon={<ClipboardCheck className="size-6" aria-hidden="true" />}
          title="Queue is clear"
          description="No submitted requests are awaiting review. New requests will appear automatically."
        />
      )}
    </div>
  );
}
