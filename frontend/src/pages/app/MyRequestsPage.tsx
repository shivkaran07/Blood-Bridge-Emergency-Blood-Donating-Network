import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ClipboardList, PlusCircle } from 'lucide-react';
import { useAuthToken } from '../../context/AuthContext';
import { api, errorMessage } from '../../lib/api';
import { queryKeys } from '../../lib/queryClient';
import { requestStatusLabels } from '../../lib/constants';
import { PageHeader } from '../../components/ui/PageHeader';
import { Button, buttonClasses } from '../../components/ui/Button';
import { EmptyState, ErrorState, LoadingState } from '../../components/ui/States';
import { FilterChips } from '../../components/ui/Table';
import { Pagination } from '../../components/ui/Pagination';
import { RequestCard } from '../../components/requests/RequestCard';
import { Alert } from '../../components/ui/Alert';
import type { RequestStatus } from '../../types/api';

const PAGE_SIZE = 10;

type StatusFilter = 'ALL' | RequestStatus;

const statusOrder: RequestStatus[] = [
  'SUBMITTED',
  'UNDER_REVIEW',
  'VERIFIED',
  'PARTIALLY_FULFILLED',
  'FULFILLED',
  'REJECTED',
  'CANCELLED',
  'EXPIRED',
];

export function MyRequestsPage() {
  const token = useAuthToken();
  const [status, setStatus] = useState<StatusFilter>('ALL');
  const [offset, setOffset] = useState(0);

  const requests = useQuery({
    queryKey: queryKeys.myRequests({ status, offset }),
    queryFn: ({ signal }) =>
      api.myRequests(
        token,
        {
          status: status === 'ALL' ? undefined : status,
          limit: PAGE_SIZE,
          offset,
        },
        signal,
      ),
  });

  const chipOptions = [
    { value: 'ALL' as const, label: 'All' },
    ...statusOrder.map((value) => ({ value, label: requestStatusLabels[value] })),
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Requester tools"
        title="My requests"
        description="Track every request you submitted, from hospital review through donor coordination and completion."
        actions={
          <Link to="/app/requests/new" className={buttonClasses('primary', 'md')}>
            <PlusCircle className="size-4" aria-hidden="true" />
            New request
          </Link>
        }
      />

      <Alert variant="info" title="Requests need hospital review">
        A new request starts as <strong>Submitted</strong>. Donors only see it after an approved
        hospital verifier records a database-backed verification.
      </Alert>

      <FilterChips
        label="Filter requests by status"
        options={chipOptions}
        value={status}
        onChange={(value) => {
          setStatus(value);
          setOffset(0);
        }}
      />

      {requests.isLoading ? (
        <LoadingState label="Loading your requests…" />
      ) : requests.isError ? (
        <ErrorState message={errorMessage(requests.error)} onRetry={() => void requests.refetch()} />
      ) : requests.data && requests.data.items.length > 0 ? (
        <>
          <div className="space-y-4">
            {requests.data.items.map((request) => (
              <RequestCard key={request.id} request={request} />
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
          title={status === 'ALL' ? 'No requests yet' : 'No requests in this status'}
          description={
            status === 'ALL'
              ? 'When you or someone you are helping needs blood, create a request and a hospital verifier will review it.'
              : 'Try another status filter or create a new request.'
          }
          action={
            status === 'ALL' ? (
              <Link to="/app/requests/new" className={buttonClasses('primary', 'sm')}>
                Create a request
              </Link>
            ) : (
              <Button variant="secondary" size="sm" onClick={() => setStatus('ALL')}>
                Show all requests
              </Button>
            )
          }
        />
      )}
    </div>
  );
}
