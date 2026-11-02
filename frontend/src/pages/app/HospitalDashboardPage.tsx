import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  ArrowRight,
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
import { SectionCard } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { MetricStrip } from '../../components/ui/StatCard';
import { buttonClasses } from '../../components/ui/Button';
import { ErrorState, LoadingState } from '../../components/ui/States';
import { RequestTable } from '../../components/requests/RequestTable';
import { AuditFeed } from '../../components/audit/AuditEventTable';
import { formatDateTime, humanize } from '../../lib/format';

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

  const pending = data.pendingReviews;

  return (
    <div className="space-y-7">
      <PageHeader
        eyebrow="Hospital verifier"
        title={data.hospital.hospitalName}
        description="Review submitted requests and record verification decisions. The application database is the source of truth; any configured on-chain anchor is an audit signal."
        meta={
          <>
            <Badge tone="success" dot>
              {humanize(data.hospital.verificationStatus)}
            </Badge>
            <span className="inline-flex items-center gap-1.5 text-[0.75rem] text-ink-500">
              <Building2 className="size-3.5" aria-hidden="true" />
              Reg. {data.hospital.registrationNumber}
            </span>
            <span className="inline-flex items-center gap-1.5 text-[0.75rem] text-ink-500">
              <MapPin className="size-3.5" aria-hidden="true" />
              {data.hospital.area}, {data.hospital.city}
            </span>
          </>
        }
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

      <section
        className={
          pending > 0
            ? 'flex flex-col gap-4 rounded-xl border border-amber-200 bg-amber-50/70 p-5 sm:flex-row sm:items-center sm:justify-between'
            : 'flex flex-col gap-4 rounded-xl border border-accent-200 bg-accent-50/60 p-5 sm:flex-row sm:items-center sm:justify-between'
        }
      >
        <div className="flex min-w-0 items-start gap-3">
          <span
            className={
              pending > 0
                ? 'flex size-9 shrink-0 items-center justify-center rounded-full bg-amber-100 text-amber-800'
                : 'flex size-9 shrink-0 items-center justify-center rounded-full bg-accent-100 text-accent-700'
            }
          >
            {pending > 0 ? (
              <ClipboardCheck className="size-4" aria-hidden="true" />
            ) : (
              <CheckCircle2 className="size-4" aria-hidden="true" />
            )}
          </span>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-ink-900">
              {pending > 0
                ? `${pending} ${pending === 1 ? 'request is' : 'requests are'} waiting for review`
                : 'The verification queue is clear'}
            </p>
            <p className="mt-0.5 text-[0.8125rem] leading-relaxed text-ink-600">
              {pending > 0
                ? 'Oldest submissions appear first. A decision records the reviewing institution, reason and timestamp.'
                : 'New submissions appear here automatically. Review decisions remain in the audit history.'}
            </p>
          </div>
        </div>
        {pending > 0 ? (
          <Link to="/app/hospital/queue" className={buttonClasses('secondary', 'sm', 'shrink-0 bg-surface-raised')}>
            Open queue
            <ArrowRight className="size-3.5" aria-hidden="true" />
          </Link>
        ) : null}
      </section>

      <MetricStrip
        items={[
          {
            label: 'Pending reviews',
            value: data.pendingReviews,
            hint: 'Submitted and under-review requests',
            icon: <ClipboardCheck />,
            tone: pending > 0 ? 'warning' : 'neutral',
            href: '/app/hospital/queue',
          },
          {
            label: 'Verified by you',
            value: data.verifiedByMe,
            hint: 'Recorded approval decisions',
            icon: <CheckCircle2 />,
            tone: 'success',
            href: '/app/hospital/audit',
          },
          {
            label: 'Rejected by you',
            value: data.rejectedByMe,
            hint: 'Recorded rejection decisions',
            icon: <XCircle />,
            tone: 'brand',
            href: '/app/hospital/audit',
          },
          {
            label: 'Decisions recorded',
            value: data.recentlyReviewed,
            hint: 'Historical review decisions',
            icon: <History />,
            href: '/app/hospital/audit',
          },
        ]}
      />

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,0.85fr)] lg:gap-8">
        <section aria-labelledby="queue-preview">
          <div className="flex flex-wrap items-end justify-between gap-3 border-b border-ink-200 pb-3">
            <div>
              <h2 id="queue-preview" className="type-title text-[1.0625rem] text-ink-900">
                Queue preview
              </h2>
              <p className="mt-1 text-[0.8125rem] text-ink-500">
                The oldest submitted requests appear first.
              </p>
            </div>
            <Link to="/app/hospital/queue" className={buttonClasses('ghost', 'sm')}>
              View queue
              <ArrowRight className="size-3.5" aria-hidden="true" />
            </Link>
          </div>
          <div className="pt-4">
            <RequestTable
              requests={data.queuePreview}
              empty={
                <div className="rounded-xl border border-dashed border-ink-300 bg-ink-50/40 px-6 py-12 text-center">
                  <span className="mx-auto flex size-11 items-center justify-center rounded-full border border-ink-200 bg-surface-raised text-accent-700">
                    <CheckCircle2 className="size-5" aria-hidden="true" />
                  </span>
                  <p className="mt-3 text-sm font-semibold text-ink-900">No requests awaiting review</p>
                  <p className="mx-auto mt-1 max-w-sm text-[0.8125rem] leading-relaxed text-ink-500">
                    New submissions will appear here automatically. Nothing needs your attention
                    right now.
                  </p>
                </div>
              }
            />
          </div>
        </section>

        <div className="space-y-5">
          <SectionCard
            title="Institution"
            description="Recorded details for this verifier account."
          >
            <dl className="space-y-3 text-[0.8125rem]">
              <Row label="Status">
                <Badge tone="success" dot>
                  {humanize(data.hospital.verificationStatus)}
                </Badge>
              </Row>
              <Row label="Registration">
                <span className="font-medium text-ink-800">{data.hospital.registrationNumber}</span>
              </Row>
              <Row label="Contact person">
                <span className="truncate font-medium text-ink-800">{data.hospital.contactPerson}</span>
              </Row>
              <Row label="Verified">
                <span className="font-medium text-ink-800">{formatDateTime(data.hospital.verifiedAt)}</span>
              </Row>
            </dl>
            <p className="mt-4 flex items-start gap-1.5 border-t border-ink-100 pt-3 text-[0.6875rem] leading-relaxed text-ink-500">
              <MapPin className="mt-px size-3.5 shrink-0" aria-hidden="true" />
              {data.hospital.address}, {data.hospital.area}, {data.hospital.city}
            </p>
          </SectionCard>

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

          <div className="rounded-xl border border-ink-200/90 bg-ink-50/50 p-4">
            <h2 className="flex items-center gap-2 text-[0.8125rem] font-semibold text-ink-900">
              <ShieldCheck className="size-4 text-accent-600" aria-hidden="true" />
              Verification scope
            </h2>
            <p className="mt-1.5 text-[0.6875rem] leading-relaxed text-ink-500">
              Verification outcomes, actor identity and reasons are stored by the backend. Where the
              deployment enables anchoring, an authorized wallet may add an opaque on-chain audit
              reference.
            </p>
            <Link
              to="/app/blockchain"
              className="mt-2 inline-flex min-h-11 items-center text-[0.6875rem] font-semibold text-brand-accent hover:text-brand-accent-strong"
            >
              Inspect integration status
            </Link>
          </div>
        </div>
      </div>

      <p className="rounded-lg border border-ink-200 bg-ink-50/60 px-4 py-3 text-[0.6875rem] leading-relaxed text-ink-500">
        Approving a request records that your institution reviewed it in BloodBridge. It does not
        prove that blood is available, compatible or safe. Clinical checks remain with the hospital.
      </p>
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <dt className="text-ink-500">{label}</dt>
      <dd className="min-w-0 text-right">{children}</dd>
    </div>
  );
}
