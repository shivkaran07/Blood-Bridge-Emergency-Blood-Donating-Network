import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  Activity,
  AlertTriangle,
  Building2,
  CheckCircle2,
  ClipboardList,
  Droplet,
  HandHeart,
  ShieldCheck,
  Users,
} from 'lucide-react';
import { useAuthToken } from '../../context/AuthContext';
import { api, errorMessage } from '../../lib/api';
import { queryKeys } from '../../lib/queryClient';
import { PageHeader } from '../../components/ui/PageHeader';
import { SectionCard } from '../../components/ui/Card';
import { Alert } from '../../components/ui/Alert';
import { Badge } from '../../components/ui/Badge';
import { StatCard } from '../../components/ui/StatCard';
import { buttonClasses } from '../../components/ui/Button';
import { ErrorState, LoadingState } from '../../components/ui/States';
import { AuditFeed } from '../../components/audit/AuditEventTable';
import { ActivityChart } from '../../components/admin/ActivityChart';
import { formatNumber } from '../../lib/format';

export function AdminDashboardPage() {
  const token = useAuthToken();
  const overview = useQuery({
    queryKey: queryKeys.adminOverview,
    queryFn: ({ signal }) => api.adminOverview(token, signal),
  });

  if (overview.isLoading) return <LoadingState label="Loading administration overview…" />;
  if (overview.isError) {
    return <ErrorState message={errorMessage(overview.error)} onRetry={() => void overview.refetch()} />;
  }

  const data = overview.data;
  if (!data) return null;
  const stats = data.stats;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Administrator"
        title="Administration overview"
        description="Authorized aggregate statistics, hospital applications, suspicious patterns and audit activity from the live database."
        actions={
          <>
            <Link to="/app/admin/hospitals" className={buttonClasses('primary', 'md')}>
              <Building2 className="size-4" aria-hidden="true" />
              Hospital applications
            </Link>
            <Link to="/app/admin/audit" className={buttonClasses('secondary', 'md')}>
              <ShieldCheck className="size-4" aria-hidden="true" />
              Audit log
            </Link>
          </>
        }
      />

      {data.pendingApplications > 0 || data.suspiciousCount > 0 ? (
        <Alert
          variant={data.suspiciousCount > 0 ? 'warning' : 'info'}
          title="Items requiring attention"
        >
          <div className="flex flex-wrap gap-x-6 gap-y-1">
            {data.pendingApplications > 0 ? (
              <Link to="/app/admin/hospitals" className="font-semibold underline">
                {data.pendingApplications} hospital{' '}
                {data.pendingApplications === 1 ? 'application' : 'applications'} pending
              </Link>
            ) : null}
            {data.suspiciousCount > 0 ? (
              <Link to="/app/admin/requests" className="font-semibold underline">
                {data.suspiciousCount} suspicious request{' '}
                {data.suspiciousCount === 1 ? 'pattern' : 'patterns'} flagged
              </Link>
            ) : null}
          </div>
        </Alert>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Total users"
          value={formatNumber(stats.total_users)}
          hint={`${stats.active_users} active · ${stats.suspended_users} suspended`}
          icon={<Users className="size-4" aria-hidden="true" />}
          tone="brand"
        />
        <StatCard
          label="Total requests"
          value={formatNumber(stats.total_requests)}
          hint={`${stats.active_requests} active · ${stats.fulfilled_requests} fulfilled`}
          icon={<ClipboardList className="size-4" aria-hidden="true" />}
          tone="neutral"
        />
        <StatCard
          label="Donor responses"
          value={formatNumber(stats.total_responses)}
          hint={`${stats.accepted_responses} accepted · ${stats.offered_responses} offered`}
          icon={<HandHeart className="size-4" aria-hidden="true" />}
          tone="success"
        />
        <StatCard
          label="Hospitals"
          value={formatNumber(stats.approved_hospitals)}
          hint={`${stats.pending_hospitals} pending applications`}
          icon={<Building2 className="size-4" aria-hidden="true" />}
          tone={stats.pending_hospitals > 0 ? 'warning' : 'neutral'}
        />
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Verified requests" value={formatNumber(stats.verified_requests)} tone="success" icon={<CheckCircle2 className="size-4" aria-hidden="true" />} />
        <StatCard label="Submitted" value={formatNumber(stats.submitted_requests)} tone="warning" icon={<Activity className="size-4" aria-hidden="true" />} />
        <StatCard label="Rejected" value={formatNumber(stats.rejected_requests)} tone="brand" icon={<AlertTriangle className="size-4" aria-hidden="true" />} />
        <StatCard label="Anchors not scheduled" value={formatNumber(stats.anchors_not_scheduled)} hint="Prepared for Part 2 — no transactions exist" tone="neutral" icon={<Droplet className="size-4" aria-hidden="true" />} />
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)]">
        <SectionCard
          title="Seven-day activity"
          description="Requests created and donor responses recorded per day."
        >
          <ActivityChart points={data.activity} />
        </SectionCard>

        <SectionCard
          title="Account and role distribution"
          description="Current authorized counts from the database."
        >
          <dl className="space-y-4">
            <MetricRow label="Donors" value={stats.donors} icon={<Droplet className="size-4" aria-hidden="true" />} />
            <MetricRow label="Hospital users" value={stats.hospital_users} icon={<Building2 className="size-4" aria-hidden="true" />} />
            <MetricRow label="Administrators" value={stats.admins} icon={<ShieldCheck className="size-4" aria-hidden="true" />} />
            <MetricRow label="Suspended accounts" value={stats.suspended_users} icon={<AlertTriangle className="size-4" aria-hidden="true" />} />
            <MetricRow label="Expired requests" value={stats.expired_requests} icon={<Activity className="size-4" aria-hidden="true" />} />
            <MetricRow label="Cancelled requests" value={stats.cancelled_requests} icon={<CheckCircle2 className="size-4" aria-hidden="true" />} />
          </dl>
        </SectionCard>
      </div>

      <SectionCard
        title="Recent audit activity"
        description="The latest application events across requests and account administration."
        actions={
          <Link to="/app/admin/audit" className={buttonClasses('ghost', 'sm')}>
            Open audit log
          </Link>
        }
      >
        <AuditFeed items={data.recentAudit} />
      </SectionCard>

      <div className="grid gap-4 sm:grid-cols-2">
        <Link to="/app/admin/users" className="flex items-start gap-3 rounded-2xl border border-ink-200/80 bg-white p-5 shadow-card transition hover:shadow-lift">
          <Users className="mt-0.5 size-5 text-ink-400" aria-hidden="true" />
          <span>
            <span className="block text-sm font-semibold text-ink-900">Manage users</span>
            <span className="mt-0.5 block text-xs leading-relaxed text-ink-500">
              Review account status and role assignments. Administrator accounts cannot be
              suspended through this panel.
            </span>
          </span>
        </Link>
        <Link to="/app/admin/requests" className="flex items-start gap-3 rounded-2xl border border-ink-200/80 bg-white p-5 shadow-card transition hover:shadow-lift">
          <ClipboardList className="mt-0.5 size-5 text-ink-400" aria-hidden="true" />
          <span>
            <span className="block text-sm font-semibold text-ink-900">Inspect requests</span>
            <span className="mt-0.5 block text-xs leading-relaxed text-ink-500">
              Search all requests, review suspicious patterns and cancel a request with a recorded
              reason.
            </span>
          </span>
        </Link>
      </div>

      <Alert variant="neutral" title="No fabricated blockchain data">
        {stats.anchors_not_scheduled} request records are not scheduled for an on-chain anchor. Part 1
        creates no smart-contract calls, wallets or transactions. The prepared fields are visible
        on the verification page.
      </Alert>
    </div>
  );
}

function MetricRow({ label, value, icon }: { label: string; value: number; icon: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <dt className="flex items-center gap-2 text-sm text-ink-600">
        <span className="text-ink-400">{icon}</span>
        {label}
      </dt>
      <dd>
        <Badge tone={value > 0 ? 'neutral' : 'outline'}>{value}</Badge>
      </dd>
    </div>
  );
}
