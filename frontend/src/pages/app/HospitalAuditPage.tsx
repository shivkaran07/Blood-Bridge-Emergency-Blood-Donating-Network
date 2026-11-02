import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { CheckCircle2, History, XCircle } from 'lucide-react';
import { useAuthToken } from '../../context/AuthContext';
import { api, errorMessage } from '../../lib/api';
import { queryKeys } from '../../lib/queryClient';
import { PageHeader } from '../../components/ui/PageHeader';
import { Alert } from '../../components/ui/Alert';
import { StatCard } from '../../components/ui/StatCard';
import { buttonClasses } from '../../components/ui/Button';
import { ErrorState, LoadingState } from '../../components/ui/States';
import { Pagination } from '../../components/ui/Pagination';
import { AuditEventTable } from '../../components/audit/AuditEventTable';

const PAGE_SIZE = 15;

export function HospitalAuditPage() {
  const token = useAuthToken();
  const [offset, setOffset] = useState(0);

  const audit = useQuery({
    queryKey: queryKeys.hospitalAudit(offset),
    queryFn: ({ signal }) => api.hospitalAudit(token, { limit: PAGE_SIZE, offset }, signal),
  });

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Hospital verifier"
        title="Review history"
        description="Every verification and rejection recorded by your institution, with actor and reason."
        actions={
          <Link to="/app/hospital/queue" className={buttonClasses('secondary', 'md')}>
            Back to queue
          </Link>
        }
      />

      <Alert variant="neutral" title="Immutable application record">
        These events are stored in the application audit log. Where the deployment enables
        anchoring, a separate on-chain reference may exist, but it is never a substitute for this
        record.
      </Alert>

      {audit.isLoading ? (
        <LoadingState label="Loading review history…" />
      ) : audit.isError ? (
        <ErrorState message={errorMessage(audit.error)} onRetry={() => void audit.refetch()} />
      ) : audit.data ? (
        <>
          <div className="grid gap-3 sm:grid-cols-2">
            <StatCard
              label="Verified by you"
              value={audit.data.summary.verified}
              icon={<CheckCircle2 className="size-4" aria-hidden="true" />}
              tone="success"
            />
            <StatCard
              label="Rejected by you"
              value={audit.data.summary.rejected}
              icon={<XCircle className="size-4" aria-hidden="true" />}
              tone="brand"
            />
          </div>

          <div className="rounded-xl border border-ink-200/90 bg-surface-raised p-4 shadow-card sm:p-5">
            <AuditEventTable items={audit.data.items} />
          </div>

          <Pagination
            total={audit.data.summary.verified + audit.data.summary.rejected}
            limit={PAGE_SIZE}
            offset={offset}
            onChange={setOffset}
            itemLabel="review events"
          />
        </>
      ) : (
        <ErrorState title="No review history" message="No review decisions have been recorded yet." />
      )}

      <div className="flex items-center gap-2 text-xs text-ink-500">
        <History className="size-4" aria-hidden="true" />
        Decisions are retained even if a request later expires or is cancelled.
      </div>
    </div>
  );
}
