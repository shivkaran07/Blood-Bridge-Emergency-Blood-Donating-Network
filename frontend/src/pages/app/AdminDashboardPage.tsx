import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  Building2,
  CheckCircle2,
  ClipboardList,
  Droplet,
  ShieldCheck,
  Users,
} from 'lucide-react';
import { useAuthToken } from '../../context/AuthContext';
import { api, errorMessage } from '../../lib/api';
import { queryKeys } from '../../lib/queryClient';
import { PageHeader } from '../../components/ui/PageHeader';
import { SectionCard } from '../../components/ui/Card';
import { MetricStrip } from '../../components/ui/StatCard';
import { buttonClasses } from '../../components/ui/Button';
import { ErrorState, LoadingState } from '../../components/ui/States';
import { AuditFeed } from '../../components/audit/AuditEventTable';
import { ActivityChart } from '../../components/admin/ActivityChart';
import { formatNumber } from '../../lib/format';

const pipelineTones = {
  verified: 'bg-accent-500',
  submitted: 'bg-amber-400',
  underReview: 'bg-amber-600',
  fulfilled: 'bg-accent-700',
  rejected: 'bg-brand-500',
  closed: 'bg-ink-300',
} as const;

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

  const closed = stats.cancelled_requests + stats.expired_requests;
  const pipelineTotal = Math.max(
    1,
    stats.verified_requests +
      stats.submitted_requests +
      stats.under_review_requests +
      stats.fulfilled_requests +
      stats.rejected_requests +
      closed,
  );

  const pipeline = [
    { key: 'verified', label: 'Verified', count: stats.verified_requests, tone: pipelineTones.verified },
    { key: 'submitted', label: 'Submitted', count: stats.submitted_requests, tone: pipelineTones.submitted },
    { key: 'review', label: 'Under review', count: stats.under_review_requests, tone: pipelineTones.underReview },
    { key: 'fulfilled', label: 'Fulfilled', count: stats.fulfilled_requests, tone: pipelineTones.fulfilled },
    { key: 'rejected', label: 'Rejected', count: stats.rejected_requests, tone: pipelineTones.rejected },
    { key: 'closed', label: 'Cancelled / expired', count: closed, tone: pipelineTones.closed },
  ].filter((item) => item.count > 0);

  const needsAttention = data.pendingApplications > 0 || data.suspiciousCount > 0;

  return (
    <div className="space-y-7">
      <PageHeader
        eyebrow="Administration"
        title="Operational overview"
        description="Authorized aggregate statistics, hospital applications, suspicious patterns and audit activity from the live database."
        meta={
          <span className="inline-flex items-center gap-1.5 text-[0.75rem] text-ink-500">
            <span className="size-1.5 rounded-full bg-accent-500" aria-hidden="true" />
            Live database aggregates
          </span>
        }
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

      {needsAttention ? (
        <section className="grid gap-3 sm:grid-cols-2" aria-label="Items requiring attention">
          {data.pendingApplications > 0 ? (
            <Link
              to="/app/admin/hospitals"
              className="group flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50/70 p-4 transition hover:border-amber-300"
            >
              <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full bg-amber-100 text-amber-800">
                <Building2 className="size-4" aria-hidden="true" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-semibold text-ink-900">
                  {data.pendingApplications} hospital{' '}
                  {data.pendingApplications === 1 ? 'application' : 'applications'} pending
                </span>
                <span className="mt-0.5 block text-[0.75rem] text-ink-600">
                  Review institutional verification requests.
                </span>
              </span>
              <ArrowRight className="mt-1 size-4 shrink-0 text-amber-700 transition group-hover:translate-x-0.5" aria-hidden="true" />
            </Link>
          ) : null}
          {data.suspiciousCount > 0 ? (
            <Link
              to="/app/admin/requests"
              className="group flex items-start gap-3 rounded-xl border border-brand-200 bg-brand-50/60 p-4 transition hover:border-brand-300"
            >
              <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full bg-brand-100 text-brand-accent">
                <AlertTriangle className="size-4" aria-hidden="true" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-semibold text-ink-900">
                  {data.suspiciousCount} suspicious request{' '}
                  {data.suspiciousCount === 1 ? 'pattern' : 'patterns'} flagged
                </span>
                <span className="mt-0.5 block text-[0.75rem] text-ink-600">
                  Inspect the signals recorded by the backend.
                </span>
              </span>
              <ArrowRight className="mt-1 size-4 shrink-0 text-brand-accent transition group-hover:translate-x-0.5" aria-hidden="true" />
            </Link>
          ) : null}
        </section>
      ) : (
        <p className="flex items-center gap-2 rounded-lg border border-accent-200 bg-accent-50/60 px-4 py-3 text-[0.8125rem] text-ink-700">
          <CheckCircle2 className="size-4 shrink-0 text-accent-700" aria-hidden="true" />
          No pending hospital applications or suspicious request patterns right now.
        </p>
      )}

      <MetricStrip
        items={[
          {
            label: 'Active users',
            value: formatNumber(stats.active_users),
            hint: `${formatNumber(stats.total_users)} total · ${formatNumber(stats.suspended_users)} suspended`,
            icon: <Users />,
            tone: 'success',
            href: '/app/admin/users',
          },
          {
            label: 'Active requests',
            value: formatNumber(stats.active_requests),
            hint: `${formatNumber(stats.total_requests)} total requests`,
            icon: <ClipboardList />,
            tone: 'brand',
            href: '/app/admin/requests',
          },
          {
            label: 'Pending hospitals',
            value: formatNumber(stats.pending_hospitals),
            hint: `${formatNumber(stats.approved_hospitals)} approved verifiers`,
            icon: <Building2 />,
            tone: stats.pending_hospitals > 0 ? 'warning' : 'neutral',
            href: '/app/admin/hospitals',
          },
          {
            label: 'Suspicious patterns',
            value: formatNumber(data.suspiciousCount),
            hint: 'Requests flagged by backend rules',
            icon: <AlertTriangle />,
            tone: data.suspiciousCount > 0 ? 'warning' : 'neutral',
            href: '/app/admin/requests',
          },
        ]}
      />

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.35fr)_minmax(0,0.8fr)] lg:gap-8">
        <SectionCard
          title="Request pipeline"
          description="Current status distribution across every recorded request."
        >
          <div
            className="flex h-3 w-full overflow-hidden rounded-full bg-ink-100"
            role="img"
            aria-label={`Request status distribution across ${pipelineTotal} requests`}
          >
            {pipeline.map((item) => (
              <span
                key={item.key}
                className={item.tone}
                style={{ width: `${(item.count / pipelineTotal) * 100}%` }}
                title={`${item.label}: ${item.count}`}
              />
            ))}
          </div>
          <dl className="mt-5 grid grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-3">
            {pipeline.map((item) => (
              <div key={item.key} className="flex items-center justify-between gap-2">
                <dt className="flex min-w-0 items-center gap-2 text-[0.75rem] text-ink-600">
                  <span className={`size-2 shrink-0 rounded-full ${item.tone}`} aria-hidden="true" />
                  <span className="truncate">{item.label}</span>
                </dt>
                <dd className="text-[0.8125rem] font-semibold tabular-nums text-ink-900">
                  {formatNumber(item.count)}
                </dd>
              </div>
            ))}
          </dl>
          <div className="mt-5 grid grid-cols-2 gap-3 border-t border-ink-100 pt-4">
            <div>
              <p className="text-[0.6875rem] font-medium text-ink-500">Donor responses</p>
              <p className="type-metric mt-1 text-xl text-ink-900">{formatNumber(stats.total_responses)}</p>
              <p className="mt-0.5 text-[0.6875rem] text-ink-500">
                {formatNumber(stats.accepted_responses)} accepted · {formatNumber(stats.offered_responses)} offered
              </p>
            </div>
            <div>
              <p className="text-[0.6875rem] font-medium text-ink-500">Fulfilled requests</p>
              <p className="type-metric mt-1 text-xl text-ink-900">{formatNumber(stats.fulfilled_requests)}</p>
              <p className="mt-0.5 text-[0.6875rem] text-ink-500">
                {formatNumber(stats.rejected_requests)} rejected overall
              </p>
            </div>
          </div>
        </SectionCard>

        <SectionCard
          title="Account mix"
          description="Current authorized role distribution."
        >
          <dl className="divide-y divide-ink-100">
            <AccountRow label="Donors" value={stats.donors} icon={<Droplet className="size-4" />} />
            <AccountRow label="Hospital users" value={stats.hospital_users} icon={<Building2 className="size-4" />} />
            <AccountRow label="Administrators" value={stats.admins} icon={<ShieldCheck className="size-4" />} />
            <AccountRow label="Suspended accounts" value={stats.suspended_users} icon={<AlertTriangle className="size-4" />} />
            <AccountRow label="Expired requests" value={stats.expired_requests} icon={<Activity className="size-4" />} />
          </dl>
          <Link
            to="/app/admin/users"
            className="mt-4 inline-flex min-h-11 items-center gap-1.5 text-[0.75rem] font-semibold text-brand-accent hover:text-brand-accent-strong"
          >
            Manage users
            <ArrowRight className="size-3.5" aria-hidden="true" />
          </Link>
        </SectionCard>
      </div>

      <SectionCard
        title="Seven-day activity"
        description="Requests created and donor responses recorded per day."
      >
        <ActivityChart points={data.activity} />
      </SectionCard>

      <SectionCard
        title="Recent audit activity"
        description="The latest application events across requests and account administration."
        actions={
          <Link to="/app/admin/audit" className={buttonClasses('ghost', 'sm')}>
            Open audit log
            <ArrowRight className="size-3.5" aria-hidden="true" />
          </Link>
        }
      >
        <AuditFeed items={data.recentAudit} />
      </SectionCard>

      <div className="grid gap-3 sm:grid-cols-2">
        <AdminLink
          to="/app/admin/users"
          icon={<Users className="size-4" aria-hidden="true" />}
          title="Manage users"
          description="Review account status and role assignments. Administrator accounts cannot be suspended through this panel."
        />
        <AdminLink
          to="/app/admin/requests"
          icon={<ClipboardList className="size-4" aria-hidden="true" />}
          title="Inspect requests"
          description="Search all requests, review suspicious patterns and cancel a request with a recorded reason."
        />
      </div>

      <p className="flex items-start gap-2 rounded-lg border border-ink-200 bg-ink-50/60 px-4 py-3 text-[0.6875rem] leading-relaxed text-ink-500">
        <ShieldCheck className="mt-0.5 size-3.5 shrink-0 text-ink-400" aria-hidden="true" />
        {formatNumber(stats.anchors_not_scheduled)} request records have no on-chain anchor
        scheduled. The verification page shows only transactions the backend actually recorded; it
        never invents a hash, block number or confirmation.
      </p>
    </div>
  );
}

function AccountRow({
  label,
  value,
  icon,
}: {
  label: string;
  value: number;
  icon: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-3 py-2.5 first:pt-0 last:pb-0">
      <dt className="flex items-center gap-2 text-[0.8125rem] text-ink-600">
        <span className="text-ink-400 [&>svg]:size-4">{icon}</span>
        {label}
      </dt>
      <dd className="text-[0.8125rem] font-semibold tabular-nums text-ink-900">
        {formatNumber(value)}
      </dd>
    </div>
  );
}

function AdminLink({
  to,
  icon,
  title,
  description,
}: {
  to: string;
  icon: React.ReactNode;
  title: string;
  description: string;
}) {
  return (
    <Link
      to={to}
      className="group flex items-start gap-3 rounded-xl border border-ink-200/90 bg-surface-raised p-4 transition hover:border-ink-300 hover:shadow-card"
    >
      <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg bg-ink-100 text-ink-500 transition group-hover:bg-brand-50 group-hover:text-brand-accent">
        {icon}
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-1.5 text-[0.8125rem] font-semibold text-ink-900">
          {title}
          <ArrowRight className="size-3 text-ink-300 transition group-hover:translate-x-0.5 group-hover:text-brand-accent" aria-hidden="true" />
        </span>
        <span className="mt-0.5 block text-[0.6875rem] leading-relaxed text-ink-500">
          {description}
        </span>
      </span>
    </Link>
  );
}
