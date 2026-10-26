import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import {
  AlertTriangle,
  ArrowRight,
  Bell,
  Building2,
  CheckCircle2,
  ClipboardCheck,
  ClipboardList,
  Droplet,
  Droplets,
  HandHeart,
  PlusCircle,
  Search,
  ShieldCheck,
  UserRound,
  Users,
} from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { useAuthToken, useAuth } from '../../context/AuthContext';
import { api, errorMessage } from '../../lib/api';
import { queryKeys } from '../../lib/queryClient';
import { PageHeader } from '../../components/ui/PageHeader';
import { StatCard } from '../../components/ui/StatCard';
import { SectionCard } from '../../components/ui/Card';
import { Alert } from '../../components/ui/Alert';
import { Badge, RequestStatusBadge } from '../../components/ui/Badge';
import { buttonClasses } from '../../components/ui/Button';
import { ErrorState, LoadingState, EmptyState } from '../../components/ui/States';
import { RequestCard } from '../../components/requests/RequestCard';
import { ResponseCard } from '../../components/responses/ResponseCard';
import { formatDateTime, pluralize } from '../../lib/format';
import { emergencyNotice } from '../../lib/constants';

export function DashboardPage() {
  const token = useAuthToken();
  const { me } = useAuth();
  const dashboard = useQuery({
    queryKey: queryKeys.dashboard,
    queryFn: ({ signal }) => api.dashboard(token, signal),
  });

  if (!me) return null;

  if (dashboard.isLoading) {
    return <LoadingState label="Loading your dashboard…" />;
  }

  if (dashboard.isError) {
    return (
      <ErrorState
        message={errorMessage(dashboard.error)}
        onRetry={() => void dashboard.refetch()}
      />
    );
  }

  const data = dashboard.data;
  if (!data) return null;

  const firstName = me.profile.fullName.trim().split(/\s+/)[0] || 'there';
  const requester = data.requester.summary;
  const donor = data.donor;
  const hospital = data.hospital;
  const admin = data.admin;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Your workspace"
        title={`Good to see you, ${firstName}`}
        description="Coordinate requests, offers and hospital review from one place. Every decision is recorded in the application audit trail."
        actions={
          <>
            <Link to="/app/requests/new" className={buttonClasses('primary', 'md')}>
              <PlusCircle className="size-4" aria-hidden="true" />
              New request
            </Link>
            <Link to="/app/requests" className={buttonClasses('secondary', 'md')}>
              <Search className="size-4" aria-hidden="true" />
              Browse requests
            </Link>
          </>
        }
      />

      {!me.profileComplete ? (
        <Alert variant="warning" title="Complete your profile">
          Add your phone number, city and area so requesters and hospitals can coordinate with
          you. <Link to="/app/profile" className="font-semibold underline">Open profile settings</Link>.
        </Alert>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Your requests"
          value={requester.total}
          hint={`${requester.active} active · ${requester.verified} verified`}
          icon={<ClipboardList className="size-4" aria-hidden="true" />}
          tone="brand"
        />
        <StatCard
          label="Responses received"
          value={requester.responses_received}
          hint="Donor offers across your requests"
          icon={<Users className="size-4" aria-hidden="true" />}
          tone="neutral"
        />
        {donor ? (
          <StatCard
            label="Your donor offers"
            value={donor.summary.total}
            hint={`${donor.summary.accepted} accepted · ${donor.summary.completed} completed`}
            icon={<HandHeart className="size-4" aria-hidden="true" />}
            tone="success"
          />
        ) : (
          <StatCard
            label="Donor profile"
            value="Not set"
            hint="Add your blood group to receive relevant requests"
            icon={<Droplet className="size-4" aria-hidden="true" />}
            tone="warning"
          />
        )}
        <StatCard
          label="Unread notifications"
          value={data.unreadNotifications}
          hint={data.unreadNotifications === 0 ? 'All caught up' : 'Open notifications to review'}
          icon={<Bell className="size-4" aria-hidden="true" />}
          tone={data.unreadNotifications > 0 ? 'warning' : 'neutral'}
        />
      </div>

      {donor ? (
        <div className="grid gap-4 lg:grid-cols-[1.25fr_0.75fr]">
          <SectionCard
            title="Open needs matching your blood group"
            description={`${donor.availableRequests} verified ${pluralize(donor.availableRequests, 'request')} currently match ${donor.profile.bloodGroup}. Exact recorded blood-group matching only.`}
            actions={
              <Link to="/app/requests" className={buttonClasses('secondary', 'sm')}>
                View feed
              </Link>
            }
            bodyClassName="space-y-3"
          >
            {donor.recentResponses.length === 0 ? (
              <EmptyState
                icon={<Droplets className="size-6" aria-hidden="true" />}
                title="No donor offers yet"
                description="Browse verified requests when you are available. Your contact details stay hidden until an offer is accepted."
                action={
                  <Link to="/app/requests" className={buttonClasses('primary', 'sm')}>
                    Find a request
                  </Link>
                }
              />
            ) : (
              donor.recentResponses.map((response) => (
                <ResponseCard
                  key={response.id}
                  response={response}
                  showRequest
                  canCoordinate
                  busy={false}
                />
              ))
            )}
          </SectionCard>

          <SectionCard
            title="Donor availability"
            description="Update your availability before browsing or offering to donate."
            bodyClassName="space-y-4"
          >
            <div className="rounded-xl border border-ink-200 bg-ink-50 p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-ink-900">
                    {donor.profile.isAvailable ? 'Available to donate' : 'Currently unavailable'}
                  </p>
                  <p className="mt-0.5 text-xs text-ink-500">
                    Blood group {donor.profile.bloodGroup}
                  </p>
                </div>
                <Badge tone={donor.profile.isAvailable ? 'success' : 'neutral'} dot>
                  {donor.profile.isAvailable ? 'Available' : 'Paused'}
                </Badge>
              </div>
              <Link
                to="/app/donor"
                className={buttonClasses('secondary', 'sm', 'mt-3 w-full')}
              >
                Manage donor profile
              </Link>
            </div>
            <p className="text-xs leading-relaxed text-ink-500">
              A donor offer is a request to coordinate, not a guarantee of eligibility or a
              completed donation. Hospital screening still applies.
            </p>
          </SectionCard>
        </div>
      ) : (
        <SectionCard
          title="Become a donor"
          description="Create a donor profile with your blood group, availability and contact consent. You can pause or withdraw at any time."
        >
          <div className="flex flex-col items-start gap-4 rounded-xl border border-brand-200 bg-brand-50/60 p-5 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-3">
              <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-white text-brand-700">
                <Droplet className="size-5" aria-hidden="true" />
              </span>
              <div>
                <p className="text-sm font-semibold text-ink-900">Help when your group is needed</p>
                <p className="mt-0.5 text-sm leading-relaxed text-ink-600">
                  Only verified hospital-reviewed requests for your exact blood group appear in
                  your feed. Coordinates are optional and never shared.
                </p>
              </div>
            </div>
            <Link to="/app/donor" className={buttonClasses('primary', 'sm', 'shrink-0')}>
              Create donor profile
            </Link>
          </div>
        </SectionCard>
      )}

      {hospital ? (
        <SectionCard
          title={`${hospital.hospital.hospitalName} review overview`}
          description="Database-backed hospital verification. No on-chain anchor is created in Part 1."
          actions={
            <Link to="/app/hospital/queue" className={buttonClasses('secondary', 'sm')}>
              Review queue
            </Link>
          }
        >
          <div className="grid gap-3 sm:grid-cols-3">
            <StatCard
              label="Pending reviews"
              value={hospital.pendingReviews}
              icon={<ClipboardCheck className="size-4" aria-hidden="true" />}
              tone="warning"
            />
            <StatCard
              label="Verified by you"
              value={hospital.verifiedByMe}
              icon={<CheckCircle2 className="size-4" aria-hidden="true" />}
              tone="success"
            />
            <StatCard
              label="Rejected by you"
              value={hospital.rejectedByMe}
              icon={<AlertTriangle className="size-4" aria-hidden="true" />}
              tone="brand"
            />
          </div>
          {hospital.queuePreview.length > 0 ? (
            <div className="mt-4 space-y-3">
              {hospital.queuePreview.slice(0, 2).map((request) => (
                <RequestCard key={request.id} request={request} />
              ))}
            </div>
          ) : (
            <p className="mt-4 text-sm text-ink-500">The verification queue is clear.</p>
          )}
        </SectionCard>
      ) : null}

      {admin ? (
        <SectionCard
          title="Administration snapshot"
          description="Operational health across users, requests and hospital applications."
          actions={
            <Link to="/app/admin" className={buttonClasses('secondary', 'sm')}>
              Admin overview
            </Link>
          }
        >
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard label="Active users" value={admin.stats.active_users} tone="success" />
            <StatCard label="Active requests" value={admin.stats.active_requests} tone="brand" />
            <StatCard
              label="Pending hospitals"
              value={admin.stats.pending_hospitals}
              tone={admin.stats.pending_hospitals > 0 ? 'warning' : 'neutral'}
            />
            <StatCard
              label="Suspicious patterns"
              value={admin.suspiciousCount}
              tone={admin.suspiciousCount > 0 ? 'warning' : 'neutral'}
            />
          </div>
        </SectionCard>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-[1.25fr_0.75fr]">
        <SectionCard
          title="Recent requests"
          description="Your five most recent blood requests."
          actions={
            <Link to="/app/my-requests" className={buttonClasses('ghost', 'sm')}>
              View all
            </Link>
          }
          bodyClassName="space-y-3"
        >
          {data.requester.recentRequests.length === 0 ? (
            <EmptyState
              icon={<ClipboardList className="size-6" aria-hidden="true" />}
              title="You have not created a request"
              description="Create a request when blood is needed. A hospital verifier must review it before donors can see it."
              action={
                <Link to="/app/requests/new" className={buttonClasses('primary', 'sm')}>
                  Create a request
                </Link>
              }
            />
          ) : (
            data.requester.recentRequests.map((request) => (
              <RequestCard key={request.id} request={request} />
            ))
          )}
        </SectionCard>

        <SectionCard
          title="Recent activity"
          description="Status changes on your requests."
          bodyClassName="pt-1"
        >
          {data.requester.recentActivity.length === 0 ? (
            <p className="py-4 text-sm text-ink-500">No status changes yet.</p>
          ) : (
            <ol className="relative space-y-4 border-l border-ink-200 pl-5 pt-2">
              {data.requester.recentActivity.map((activity) => (
                <li key={activity.id} className="relative">
                  <span className="absolute -left-[1.4rem] top-1.5 size-2.5 rounded-full border-2 border-white bg-brand-500" />
                  <div className="flex flex-wrap items-center gap-2">
                    <RequestStatusBadge status={activity.toStatus} />
                    <Link
                      to={`/app/requests/${activity.requestId}`}
                      className="text-sm font-medium text-ink-800 hover:text-brand-700"
                    >
                      {activity.hospitalName}
                    </Link>
                  </div>
                  <p className="mt-1 text-xs leading-relaxed text-ink-500">
                    {activity.reason ?? `${activity.bloodGroup} request status updated.`}
                  </p>
                  <p className="mt-0.5 text-[0.7rem] text-ink-400">
                    {formatDateTime(activity.createdAt)}
                  </p>
                </li>
              ))}
            </ol>
          )}
        </SectionCard>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <QuickLink
          to="/app/profile"
          icon={<UserRound className="size-5" aria-hidden="true" />}
          title="Profile details"
          description="Keep your name, phone number and general location current."
        />
        <QuickLink
          to="/app/blockchain"
          icon={<ShieldCheck className="size-5" aria-hidden="true" />}
          title="Verification & audit"
          description="See exactly what Part 1 verifies and what is prepared for Part 2."
        />
        <QuickLink
          to="/app/notifications"
          icon={<Bell className="size-5" aria-hidden="true" />}
          title="Notifications"
          description="Review decisions, offer updates and account notices."
        />
        <QuickLink
          to="/app/hospital/application"
          icon={<Building2 className="size-5" aria-hidden="true" />}
          title="Hospital verification"
          description="Apply as an institutional verifier or check an application status."
        />
      </div>

      <Alert variant="neutral" title="Not an emergency service">
        {emergencyNotice}
      </Alert>
    </div>
  );
}

function QuickLink({
  to,
  icon,
  title,
  description,
}: {
  to: string;
  icon: ReactNode;
  title: string;
  description: string;
}) {
  return (
    <Link
      to={to}
      className="group flex items-start gap-3 rounded-2xl border border-ink-200/80 bg-white p-4 shadow-card transition hover:border-ink-300 hover:shadow-lift"
    >
      <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-ink-100 text-ink-600 transition group-hover:bg-brand-50 group-hover:text-brand-700">
        {icon}
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-1.5 text-sm font-semibold text-ink-900">
          {title}
          <ArrowRight className="size-3.5 text-ink-300 transition group-hover:translate-x-0.5 group-hover:text-brand-600" aria-hidden="true" />
        </span>
        <span className="mt-0.5 block text-xs leading-relaxed text-ink-500">{description}</span>
      </span>
    </Link>
  );
}
