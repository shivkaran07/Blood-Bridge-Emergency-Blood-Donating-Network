import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  Building2,
  CheckCircle2,
  ClipboardCheck,
  History,
  MapPin,
  ShieldCheck,
  XCircle,
} from 'lucide-react';
import { useAuthToken } from '../../context/AuthContext';
import { api, errorMessage } from '../../lib/api';
import { queryKeys } from '../../lib/queryClient';
import { PageHeader } from '../../components/ui/PageHeader';
import { Card, SectionCard } from '../../components/ui/Card';
import { Alert } from '../../components/ui/Alert';
import { Badge } from '../../components/ui/Badge';
import { StatCard } from '../../components/ui/StatCard';
import { buttonClasses } from '../../components/ui/Button';
import { EmptyState, ErrorState, LoadingState } from '../../components/ui/States';
import { RequestCard } from '../../components/requests/RequestCard';
import { AuditFeed } from '../../components/audit/AuditEventTable';
import { formatDateTime } from '../../lib/format';

export function HospitalDashboardPage() {
  const token = useAuthToken();
  const dashboard = useQuery({
    queryKey: queryKeys.hospitalDashboard,
    queryFn: ({ signal }) => api.hospitalDashboard(token, signal),
  });

  if (dashboard.isLoading) return <LoadingState label="Loading hospital overview…" />;
  if (dashboard.isError) {
    return <ErrorState message={errorMessage(dashboard.error)} onRetry={() => void dashboard.refetch()} />;
  }

  const data = dashboard.data;
  if (!data) return null;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Hospital verifier"
        title={data.hospital.hospitalName}
        description="Review submitted requests and record database-backed verification decisions. No blockchain transaction is created in Part 1."
        actions={
          <>
            <Link to="/app/hospital/queue" className={buttonClasses('primary', 'md')}>
              <ClipboardCheck className="size-4" aria-hidden="true" />
              Verification queue
            </Link>
            <Link to="/app/hospital/audit" className={buttonClasses('secondary', 'md')}>
              <History className="size-4" aria-hidden="true" />
              Review history
            </Link>
          </>
        }
      />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Pending reviews"
          value={data.pendingReviews}
          hint="Submitted and under-review requests"
          icon={<ClipboardCheck className="size-4" aria-hidden="true" />}
          tone={data.pendingReviews > 0 ? 'warning' : 'neutral'}
        />
        <StatCard
          label="Verified by you"
          value={data.verifiedByMe}
          icon={<CheckCircle2 className="size-4" aria-hidden="true" />}
          tone="success"
        />
        <StatCard
          label="Rejected by you"
          value={data.rejectedByMe}
          icon={<XCircle className="size-4" aria-hidden="true" />}
          tone="brand"
        />
        <StatCard
          label="Decisions recorded"
          value={data.recentlyReviewed}
          hint="Historical review decisions"
          icon={<History className="size-4" aria-hidden="true" />}
          tone="neutral"
        />
      </div>

      <Alert variant="info" title="Database-backed verification">
        Approving a request records that your institution reviewed it in BloodBridge. It does not
        prove that blood is available, compatible or safe. Clinical checks remain with the hospital.
      </Alert>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,0.8fr)]">
        <SectionCard
          title="Queue preview"
          description="The oldest submitted requests appear first."
          actions={
            <Link to="/app/hospital/queue" className={buttonClasses('ghost', 'sm')}>
              View queue
            </Link>
          }
          bodyClassName="space-y-3"
        >
          {data.queuePreview.length === 0 ? (
            <EmptyState
              icon={<ClipboardCheck className="size-6" aria-hidden="true" />}
              title="No requests awaiting review"
              description="New submissions will appear here automatically."
            />
          ) : (
            data.queuePreview.map((request) => (
              <RequestCard key={request.id} request={request} />
            ))
          )}
        </SectionCard>

        <div className="space-y-4">
          <Card>
            <h2 className="flex items-center gap-2 text-sm font-semibold text-ink-900">
              <Building2 className="size-4 text-ink-400" aria-hidden="true" />
              Institution
            </h2>
            <dl className="mt-3 space-y-2 text-sm">
              <div className="flex justify-between gap-3">
                <dt className="text-ink-500">Status</dt>
                <dd>
                  <Badge tone="success" dot>{data.hospital.verificationStatus}</Badge>
                </dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-ink-500">Registration</dt>
                <dd className="font-medium text-ink-800">{data.hospital.registrationNumber}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-ink-500">Contact</dt>
                <dd className="truncate font-medium text-ink-800">{data.hospital.contactPerson}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-ink-500">Verified</dt>
                <dd className="font-medium text-ink-800">{formatDateTime(data.hospital.verifiedAt)}</dd>
              </div>
            </dl>
            <p className="mt-3 flex items-start gap-1.5 text-xs text-ink-500">
              <MapPin className="mt-px size-3.5 shrink-0" aria-hidden="true" />
              {data.hospital.address}, {data.hospital.area}, {data.hospital.city}
            </p>
          </Card>

          <SectionCard
            title="Recent decisions"
            description="Your latest review actions."
            actions={
              <Link to="/app/hospital/audit" className={buttonClasses('ghost', 'sm')}>
                All
              </Link>
            }
          >
            <AuditFeed items={data.recentAudit} />
          </SectionCard>

          <Card>
            <h2 className="flex items-center gap-2 text-sm font-semibold text-ink-900">
              <ShieldCheck className="size-4 text-accent-600" aria-hidden="true" />
              Verification scope
            </h2>
            <p className="mt-1.5 text-xs leading-relaxed text-ink-500">
              Part 1 stores verification outcomes, actor identity and reasons. The prepared
              blockchain fields will support an authorized on-chain anchor in Part 2.
            </p>
            <Link to="/app/blockchain" className="mt-2 inline-flex text-xs font-semibold text-brand-700 hover:text-brand-800">
              Inspect integration status
            </Link>
          </Card>
        </div>
      </div>
    </div>
  );
}
