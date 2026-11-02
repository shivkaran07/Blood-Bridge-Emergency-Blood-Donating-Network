import { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  AlertTriangle,
  ArrowRight,
  ArrowUpRight,
  Bell,
  Building2,
  CheckCircle2,
  ClipboardList,
  Droplet,
  HandHeart,
  PlusCircle,
  Search,
  ShieldCheck,
  Sparkles,
  Users,
  X,
} from 'lucide-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth, useAuthToken } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { api, errorMessage } from '../../lib/api';
import { queryKeys } from '../../lib/queryClient';
import { invalidateWorkspace } from '../../lib/invalidate';
import { MetricStrip } from '../../components/ui/StatCard';
import { SectionBlock, SectionCard } from '../../components/ui/Card';
import { Badge, RequestStatusBadge } from '../../components/ui/Badge';
import { buttonClasses } from '../../components/ui/Button';
import { Switch } from '../../components/ui/Field';
import { ErrorState, LoadingState } from '../../components/ui/States';
import { BloodGroupMark } from '../../components/requests/RequestCard';
import { RequestRow, RequestTable } from '../../components/requests/RequestTable';
import { formatRelative } from '../../lib/format';
import { emergencyNotice } from '../../lib/constants';
import { describeVerification, useVerificationStatus } from '../../lib/verificationStatus';
import type { DonorResponse, RecentActivity, RequestStatus } from '../../types/api';
import { cn } from '../../lib/cn';

const PROFILE_NUDGE_KEY = 'bloodbridge.profile-nudge-dismissed';

export function DashboardPage() {
  const token = useAuthToken();
  const { me, refreshMe } = useAuth();
  const toast = useToast();
  const queryClient = useQueryClient();
  const [nudgeDismissed, setNudgeDismissed] = useState(() => {
    try {
      return window.sessionStorage.getItem(PROFILE_NUDGE_KEY) === '1';
    } catch {
      return false;
    }
  });

  const dashboard = useQuery({
    queryKey: queryKeys.dashboard,
    queryFn: ({ signal }) => api.dashboard(token, signal),
  });

  const verificationQuery = useVerificationStatus();

  const availability = useMutation({
    mutationFn: (next: boolean) => api.setAvailability(token, next),
    onSuccess: async (profile) => {
      toast.success(
        profile.isAvailable ? 'You are available' : 'Availability paused',
        profile.isAvailable
          ? 'Verified requests for your blood group can receive your offer.'
          : 'You will not be able to offer blood until you resume.',
      );
      await refreshMe();
      await invalidateWorkspace(queryClient);
    },
    onError: (error) => toast.error('Could not update availability', errorMessage(error)),
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
  const verification = describeVerification(verificationQuery.data, verificationQuery.isError);

  const missingFields = [
    !me.profile.fullName.trim() ? 'full name' : null,
    !me.profile.phoneNumber ? 'phone number' : null,
    !me.profile.city ? 'city' : null,
    !me.profile.area ? 'area' : null,
  ].filter(Boolean) as string[];

  const showProfileNudge = !me.profileComplete && !nudgeDismissed && missingFields.length > 0;

  const dismissNudge = () => {
    setNudgeDismissed(true);
    try {
      window.sessionStorage.setItem(PROFILE_NUDGE_KEY, '1');
    } catch {
      /* Dismissal still applies for this session. */
    }
  };

  const roleLine = me.permissions.isAdmin
    ? 'Administrator workspace'
    : me.permissions.isApprovedVerifier
      ? 'Hospital verification workspace'
      : donor
        ? 'Donor and requester workspace'
        : 'Requester workspace';

  const workspaceDescription = admin
    ? 'Review hospital access, monitor request activity and inspect operational signals across the platform.'
    : hospital
      ? 'Review requests awaiting your decision, check your history and keep verification records accurate.'
      : donor
        ? 'Browse verified needs for your recorded blood group, manage availability and follow your offers.'
        : 'Create and track blood requests, follow hospital review and coordinate donor offers from one workspace.';

  const heroActions = admin
    ? [
        { to: '/app/admin', label: 'Open admin overview', primary: true },
        { to: '/app/admin/hospitals', label: 'Review hospitals', primary: false },
      ]
    : hospital
      ? [
          { to: '/app/hospital/queue', label: 'Open review queue', primary: true },
          { to: '/app/hospital/audit', label: 'Review history', primary: false },
        ]
      : donor
        ? [
            { to: '/app/requests', label: 'Browse verified requests', primary: true },
            { to: '/app/donor', label: 'Manage donor settings', primary: false },
          ]
        : [
            { to: '/app/requests/new', label: 'New blood request', primary: true },
            { to: '/app/requests', label: 'Browse requests', primary: false },
          ];

  const recentRequestPriority: Record<RequestStatus, number> = {
    SUBMITTED: 0,
    UNDER_REVIEW: 1,
    VERIFIED: 2,
    PARTIALLY_FULFILLED: 3,
    FULFILLED: 4,
    REJECTED: 5,
    CANCELLED: 6,
    EXPIRED: 7,
  };
  const recentRequests = [...data.requester.recentRequests]
    .filter((request) => request.status !== 'EXPIRED')
    .sort((a, b) => recentRequestPriority[a.status] - recentRequestPriority[b.status]);
  const expiredRequests = data.requester.recentRequests.filter((request) => request.status === 'EXPIRED');

  const metricItems = admin
    ? [
        { label: 'Active users', value: admin.stats.active_users, hint: 'Currently active accounts', icon: <Users />, href: '/app/admin/users' },
        { label: 'All requests', value: admin.stats.total_requests, hint: 'Platform-wide requests', icon: <ClipboardList />, href: '/app/admin/requests' },
        { label: 'Pending hospitals', value: admin.pendingApplications, hint: 'Applications awaiting review', icon: <Building2 />, href: '/app/admin/hospitals' },
        { label: 'Review signals', value: admin.suspiciousCount, hint: 'Heuristic flags; inspect before action', icon: <AlertTriangle />, href: '/app/admin/requests' },
      ]
    : hospital
      ? [
          { label: 'Pending reviews', value: hospital.pendingReviews, hint: 'Requests awaiting your review', icon: <ClipboardList />, href: '/app/hospital/queue' },
          { label: 'Verified by you', value: hospital.verifiedByMe, hint: 'Recorded approvals', icon: <ShieldCheck />, href: '/app/hospital/audit' },
          { label: 'Rejected by you', value: hospital.rejectedByMe, hint: 'Recorded rejections', icon: <X />, href: '/app/hospital/audit' },
          { label: 'Reviewed recently', value: hospital.recentlyReviewed, hint: 'Decisions in the recent period', icon: <CheckCircle2 />, href: '/app/hospital/audit' },
        ]
      : [
          {
            label: 'Your requests',
            value: requester.total,
            hint: `${requester.active} active · ${requester.verified} verified`,
            icon: <ClipboardList />,
            tone: 'brand' as const,
            href: '/app/my-requests',
          },
          {
            label: 'Responses received',
            value: requester.responses_received,
            hint: 'Donor offers across your requests',
            icon: <Users />,
            href: '/app/my-requests',
          },
          donor
            ? {
                label: 'Matching requests',
                value: donor.availableRequests,
                hint: `${donor.summary.total} offers · ${donor.summary.accepted} accepted`,
                icon: <Droplet />,
                tone: 'success' as const,
                href: '/app/requests',
              }
            : {
                label: 'Donor network',
                value: 'Not set',
                hint: 'Add your blood group to receive matches',
                icon: <Droplet />,
                tone: 'warning' as const,
                href: '/app/donor',
              },
          {
            label: 'Unread notices',
            value: data.unreadNotifications,
            hint: data.unreadNotifications === 0 ? 'All caught up' : 'Review hospital decisions & offers',
            icon: <Bell />,
            tone: data.unreadNotifications > 0 ? ('warning' as const) : ('neutral' as const),
            href: '/app/notifications',
          },
        ];

  type AttentionItem = {
    id: string;
    title: string;
    description: string;
    to: string;
    cta: string;
    icon: React.ReactNode;
    tone: 'info' | 'warning' | 'success';
    onDismiss?: () => void;
  };

  const attention: AttentionItem[] = [];

  if (admin && admin.pendingApplications > 0) {
    attention.push({
      id: 'admin-applications',
      title: `${admin.pendingApplications} hospital ${admin.pendingApplications === 1 ? 'application needs' : 'applications need'} review`,
      description: 'Only an administrator can approve institutional verifier access.',
      to: '/app/admin/hospitals',
      cta: 'Review applications',
      icon: <Building2 className="size-4" aria-hidden="true" />,
      tone: 'warning',
    });
  }

  if (admin && admin.suspiciousCount > 0) {
    attention.push({
      id: 'admin-suspicious',
      title: `${admin.suspiciousCount} request ${admin.suspiciousCount === 1 ? 'pattern needs' : 'patterns need'} inspection`,
      description: 'Heuristic flags are signals for review, not proof of fraud.',
      to: '/app/admin',
      cta: 'Inspect requests',
      icon: <AlertTriangle className="size-4" aria-hidden="true" />,
      tone: 'warning',
    });
  }

  if (hospital && hospital.pendingReviews > 0) {
    attention.push({
      id: 'hospital-queue',
      title: `${hospital.pendingReviews} ${hospital.pendingReviews === 1 ? 'request is' : 'requests are'} waiting for review`,
      description: 'Donors cannot see a request until an approved verifier records a decision.',
      to: '/app/hospital/queue',
      cta: 'Open review queue',
      icon: <ClipboardList className="size-4" aria-hidden="true" />,
      tone: 'warning',
    });
  }

  if (donor && !donor.profile.isAvailable) {
    attention.push({
      id: 'donor-paused',
      title: 'Your donor availability is paused',
      description: 'You can browse requests, but offers stay disabled until you resume.',
      to: '/app/donor',
      cta: 'Manage availability',
      icon: <Droplet className="size-4" aria-hidden="true" />,
      tone: 'info',
    });
  } else if (donor && !donor.profile.consentToContact) {
    attention.push({
      id: 'donor-contact',
      title: 'Contact sharing is private',
      description: 'Your phone number will not be shared after an accepted offer unless you allow it.',
      to: '/app/donor',
      cta: 'Review consent',
      icon: <ShieldCheck className="size-4" aria-hidden="true" />,
      tone: 'info',
    });
  }

  if (donor && donor.availableRequests > 0) {
    attention.push({
      id: 'donor-matches',
      title: `${donor.availableRequests} verified ${donor.availableRequests === 1 ? 'request matches' : 'requests match'} your blood group`,
      description: 'Review the need before offering. An offer is not a guarantee of eligibility.',
      to: '/app/requests',
      cta: 'View matching requests',
      icon: <Search className="size-4" aria-hidden="true" />,
      tone: 'success',
    });
  }

  if (showProfileNudge) {
    attention.push({
      id: 'profile',
      title: 'Complete your coordination details',
      description: `Add your ${missingFields.join(', ')} so requesters and hospitals can reach you. This is optional.`,
      to: '/app/profile',
      cta: 'Update profile',
      icon: <Sparkles className="size-4" aria-hidden="true" />,
      tone: 'info',
      onDismiss: dismissNudge,
    });
  }

  if (data.unreadNotifications > 0) {
    attention.push({
      id: 'notifications',
      title: `${data.unreadNotifications} unread ${data.unreadNotifications === 1 ? 'notice' : 'notices'}`,
      description: 'Review hospital decisions, offer updates and account notices.',
      to: '/app/notifications',
      cta: 'Read notices',
      icon: <Bell className="size-4" aria-hidden="true" />,
      tone: 'info',
    });
  }

  const roleNextSteps = admin
    ? [
        { to: '/app/admin', icon: <Users className="size-4" aria-hidden="true" />, title: 'Open the admin overview', description: 'Platform activity, suspicious patterns and operational health.' },
        { to: '/app/admin/hospitals', icon: <Building2 className="size-4" aria-hidden="true" />, title: 'Review hospital applications', description: 'Approve or reject institutional verifier access with a reason.' },
        { to: '/app/admin/audit', icon: <ShieldCheck className="size-4" aria-hidden="true" />, title: 'Inspect the audit trail', description: 'Account, request and verification events in one record.' },
      ]
    : hospital
      ? [
          { to: '/app/hospital/queue', icon: <ClipboardList className="size-4" aria-hidden="true" />, title: 'Work the review queue', description: 'Record a decision so requesters and donors see an accurate status.' },
          { to: '/app/hospital/application', icon: <Building2 className="size-4" aria-hidden="true" />, title: 'Check verifier status', description: 'Review your institutional application and any administrator note.' },
          { to: '/app/blockchain', icon: <ShieldCheck className="size-4" aria-hidden="true" />, title: 'Inspect verification', description: 'See whether database review or optional anchoring is active.' },
        ]
      : donor
        ? [
            { to: '/app/requests', icon: <Search className="size-4" aria-hidden="true" />, title: 'Find a matching request', description: `Browse verified needs for ${donor.profile.bloodGroup} when you are ready.` },
            { to: '/app/donor', icon: <Droplet className="size-4" aria-hidden="true" />, title: 'Manage donor settings', description: 'Availability, contact consent and optional location are separate choices.' },
            { to: '/app/my-responses', icon: <HandHeart className="size-4" aria-hidden="true" />, title: 'Follow your offers', description: 'Track acceptances, declines and completed coordination.' },
          ]
        : [
            { to: '/app/requests/new', icon: <PlusCircle className="size-4" aria-hidden="true" />, title: 'Create a blood request', description: 'A hospital verifier reviews it before donors can see it.' },
            { to: '/app/my-requests', icon: <ClipboardList className="size-4" aria-hidden="true" />, title: 'Track your requests', description: 'Follow review decisions, offers, expiry and completion.' },
            { to: '/app/profile', icon: <CheckCircle2 className="size-4" aria-hidden="true" />, title: 'Keep your profile current', description: 'Accurate phone and general location help coordination.' },
          ];

  return (
    <div className="space-y-7">
      {/* Hero ------------------------------------------------------------ */}
      <section className="brand-surface relative isolate overflow-hidden rounded-2xl shadow-hero">
        <div className="blueprint-grid pointer-events-none absolute inset-0 opacity-60" aria-hidden="true" />

        <div className="relative grid gap-6 p-6 sm:p-8 lg:grid-cols-[minmax(0,1.35fr)_minmax(17rem,0.65fr)] lg:items-center lg:gap-8">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2.5">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-white/20 bg-white/10 px-2.5 py-0.5 text-[0.6875rem] font-semibold uppercase tracking-[0.12em] text-white/90 backdrop-blur-sm">
                <span className="size-1.5 rounded-full bg-emerald-400" aria-hidden="true" />
                {roleLine}
              </span>
              <span className="text-[0.6875rem] text-white/60">Role-specific workspace</span>
            </div>
            <h1 className="type-display mt-3.5 text-[1.875rem] text-white text-shadow-hero sm:text-[2.5rem]">
              Good to see you,
              <br className="hidden sm:block" /> {firstName}.
            </h1>
            <p className="mt-2.5 max-w-xl text-sm leading-relaxed text-white/80 sm:text-[0.9375rem]">
              {workspaceDescription}
            </p>
            <div className="mt-5 flex flex-wrap items-center gap-2.5">
              {heroActions.map((action) => (
                <Link
                  key={action.to}
                  to={action.to}
                  className={
                    action.primary
                      ? buttonClasses('inverse', 'md', 'font-bold shadow-[0_2px_8px_-1px_rgba(0,0,0,0.3)] hover:shadow-lg')
                      : 'inline-flex h-11 min-h-11 items-center justify-center gap-2 rounded-lg border border-white/20 bg-white/[0.08] px-4 text-sm font-semibold text-white backdrop-blur-sm transition hover:border-white/40 hover:bg-white/[0.16]'
                  }
                >
                  {action.label}
                  <ArrowRight className="size-4" aria-hidden="true" />
                </Link>
              ))}
            </div>
          </div>

          <div className="rounded-xl border border-white/15 bg-white/[0.07] p-4.5 backdrop-blur-md">
            <div className="flex items-center justify-between gap-3">
              <p className="text-[0.625rem] font-semibold uppercase tracking-[0.15em] text-white/60">
                Verification status
              </p>
              <span
                className={cn(
                  'inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[0.625rem] font-semibold',
                  verification.tone === 'success'
                    ? 'border-emerald-300/30 bg-emerald-400/10 text-emerald-200'
                    : verification.tone === 'warning'
                      ? 'border-amber-300/30 bg-amber-300/10 text-amber-200'
                      : 'border-white/20 bg-white/5 text-white/70',
                )}
              >
                <span className="size-1.5 rounded-full bg-current" aria-hidden="true" />
                {verification.label}
              </span>
            </div>
            <p className="mt-2.5 text-sm font-semibold text-white">{verification.title}</p>
            <p className="mt-1 text-[0.75rem] leading-relaxed text-white/65">{verification.detail}</p>
            <dl className="mt-3.5 space-y-2 border-t border-white/10 pt-3 text-[0.75rem]">
              <div className="flex items-start justify-between gap-3">
                <dt className="text-white/50">Account role</dt>
                <dd className="text-right font-medium text-white/90">{roleLine}</dd>
              </div>
              <div className="flex items-start justify-between gap-3">
                <dt className="text-white/50">Donor profile</dt>
                <dd className="text-right font-medium text-white/90">
                  {donor ? `${donor.profile.bloodGroup} · ${donor.profile.isAvailable ? 'available' : 'paused'}` : 'Not created'}
                </dd>
              </div>
              <div className="flex items-start justify-between gap-3">
                <dt className="text-white/50">Contact sharing</dt>
                <dd className="text-right font-medium text-white/90">
                  {donor ? (donor.profile.consentToContact ? 'After an accepted offer' : 'Private') : 'Not applicable'}
                </dd>
              </div>
            </dl>
            <Link
              to="/app/blockchain"
              className="mt-3 inline-flex min-h-8 items-center gap-1.5 text-[0.75rem] font-semibold text-white/85 transition hover:text-white"
            >
              Inspect the verification layer
              <ArrowUpRight className="size-3" aria-hidden="true" />
            </Link>
          </div>
        </div>
      </section>

      {/* Attention ------------------------------------------------------- */}
      <section aria-labelledby="attention-heading" className="space-y-3">
        <div className="flex items-baseline justify-between gap-3 border-b border-ink-200 pb-2.5">
          <h2 id="attention-heading" className="type-title text-[1.0625rem] text-ink-900">
            Needs your attention
          </h2>
          <span className="text-[0.6875rem] text-ink-500">
            {attention.length === 0 ? 'Nothing urgent' : `${attention.length} ${attention.length === 1 ? 'item' : 'items'}`}
          </span>
        </div>
        {attention.length === 0 ? (
          <p className="flex items-center gap-2 rounded-xl border border-ink-200 bg-surface-raised px-4 py-3 text-[0.8125rem] text-ink-600 shadow-card">
            <CheckCircle2 className="size-4 shrink-0 text-accent-600" aria-hidden="true" />
            No outstanding actions. Your workspace is up to date.
          </p>
        ) : (
          <ul className="grid gap-2.5 md:grid-cols-2 xl:grid-cols-3">
            {attention.map((item) => (
              <li key={item.id}>
                <div className="flex h-full items-start gap-3 rounded-xl border border-ink-200/90 bg-surface-raised p-3.5 shadow-card">
                  <span
                    className={cn(
                      'mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg',
                      item.tone === 'warning'
                        ? 'bg-amber-50 text-amber-700'
                        : item.tone === 'success'
                          ? 'bg-accent-50 text-accent-700'
                          : 'bg-brand-50 text-brand-accent',
                    )}
                  >
                    {item.icon}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-[0.8125rem] font-semibold leading-snug text-ink-900">{item.title}</p>
                    <p className="mt-0.5 text-[0.6875rem] leading-relaxed text-ink-500">{item.description}</p>
                    <Link
                      to={item.to}
                      className="mt-1.5 inline-flex min-h-8 items-center gap-1 text-[0.6875rem] font-semibold text-brand-accent hover:text-brand-accent-strong"
                    >
                      {item.cta}
                      <ArrowRight className="size-3" aria-hidden="true" />
                    </Link>
                  </div>
                  {item.onDismiss ? (
                    <button
                      type="button"
                      onClick={item.onDismiss}
                      className="flex size-8 shrink-0 items-center justify-center rounded-md text-ink-400 transition hover:bg-ink-100 hover:text-ink-700"
                      aria-label={`Dismiss ${item.title}`}
                    >
                      <X className="size-3.5" aria-hidden="true" />
                    </button>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Metrics -------------------------------------------------------- */}
      <MetricStrip items={metricItems} />

      {/* Requester context is not presented as hospital/admin workload. */}
      {!admin && !hospital ? (
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,0.85fr)] lg:gap-8">
          <SectionBlock
            title="Your requests"
            description="Requests requiring action appear before recently closed items."
            actions={
              <Link to="/app/my-requests" className={buttonClasses('ghost', 'sm')}>
                View all
                <ArrowUpRight className="size-3.5" aria-hidden="true" />
              </Link>
            }
          >
            {recentRequests.length === 0 ? (
              donor ? (
                <p className="rounded-xl border border-dashed border-ink-300 bg-ink-50/40 px-4 py-8 text-center text-sm text-ink-500">
                  No recent non-expired requests to show.
                </p>
              ) : (
                <FirstRequestPanel />
              )
            ) : (
              <RequestTable requests={recentRequests} />
            )}
          </SectionBlock>

          <SectionBlock
            title="Activity"
            description="Status changes on your requests."
            actions={
              <Link to="/app/notifications" className={buttonClasses('ghost', 'sm')}>
                Notifications
              </Link>
            }
          >
            {data.requester.recentActivity.length === 0 ? (
              <p className="rounded-xl border border-dashed border-ink-300 bg-ink-50/40 px-4 py-8 text-center text-sm text-ink-500">
                No status changes yet. Activity appears here after a hospital reviews a request.
              </p>
            ) : (
              <ActivityTimeline items={data.requester.recentActivity} />
            )}
          </SectionBlock>
        </div>
      ) : null}

      {!admin && !hospital && expiredRequests.length > 0 ? (
        <SectionBlock
          title="Expired requests"
          description="These deadlines have passed. They are closed and are not active emergencies."
          actions={
            <Link to="/app/my-requests" className={buttonClasses('ghost', 'sm')}>
              View all requests
              <ArrowUpRight className="size-3.5" aria-hidden="true" />
            </Link>
          }
        >
          <RequestTable requests={expiredRequests} />
        </SectionBlock>
      ) : null}

      {/* Donor experience ---------------------------------------------- */}
      {donor ? (
        <div className="grid gap-6 lg:grid-cols-2 lg:gap-8">
          <SectionCard
            title="Donor availability"
            description="Control whether your profile can receive and answer verified requests."
            actions={
              <Link to="/app/donor" className={buttonClasses('ghost', 'sm')}>
                Manage
              </Link>
            }
          >
            <div className="flex items-start gap-4">
              <BloodGroupMark group={donor.profile.bloodGroup} size="lg" />
              <div className="min-w-0 flex-1">
                <Switch
                  id="dashboard-availability"
                  checked={donor.profile.isAvailable}
                  onChange={(next) => availability.mutate(next)}
                  disabled={availability.isPending}
                  label={donor.profile.isAvailable ? 'Available to donate' : 'Currently paused'}
                  description={
                    donor.profile.isAvailable
                      ? 'Verified requests for your exact blood group can receive your offer.'
                      : 'Resume when you are ready to consider requests. Past offers are kept.'
                  }
                />
              </div>
            </div>
            <div className="mt-5 grid grid-cols-3 divide-x divide-ink-100 rounded-lg border border-ink-200 bg-ink-50/40 py-3 text-center">
              <MiniStat label="Offers" value={donor.summary.total} />
              <MiniStat label="Accepted" value={donor.summary.accepted} />
              <MiniStat label="Completed" value={donor.summary.completed} />
            </div>
            <p className="mt-3 text-[0.6875rem] leading-relaxed text-ink-500">
              An offer is a request to coordinate, not a guarantee of eligibility or a completed
              donation. Hospital screening still applies.
            </p>
          </SectionCard>

          <SectionCard
            title="Your recent offers"
            description="Offers you have made on verified requests."
            actions={
              <Link to="/app/my-responses" className={buttonClasses('ghost', 'sm')}>
                All offers
              </Link>
            }
          >
            {donor.recentResponses.length === 0 ? (
              <div className="rounded-lg border border-dashed border-ink-300 bg-ink-50/40 px-4 py-8 text-center">
                <p className="text-sm font-medium text-ink-800">No offers yet</p>
                <p className="mx-auto mt-1 max-w-xs text-[0.8125rem] leading-relaxed text-ink-500">
                  Browse verified requests for {donor.profile.bloodGroup} when you are available.
                </p>
                <Link to="/app/requests" className={buttonClasses('primary', 'sm', 'mt-4')}>
                  Find a request
                </Link>
              </div>
            ) : (
              <ul className="divide-y divide-ink-100">
                {donor.recentResponses.slice(0, 4).map((response) => (
                  <li key={response.id}>
                    <ResponseRow response={response} />
                  </li>
                ))}
              </ul>
            )}
          </SectionCard>
        </div>
      ) : !admin && !hospital ? (
        <DonorOnboarding />
      ) : null}

      {/* Role-specific operational context ----------------------------- */}
      {hospital ? (
        <SectionCard
          title={`${hospital.hospital.hospitalName} · review overview`}
          description="Hospital review decisions are recorded in the application database. On-chain anchoring is optional and never medical proof."
          actions={
            <Link to="/app/hospital/queue" className={buttonClasses('secondary', 'sm')}>
              Review queue
              <ArrowRight className="size-3.5" aria-hidden="true" />
            </Link>
          }
        >
          <div className="grid gap-3 sm:grid-cols-3">
            <StatLine label="Pending reviews" value={hospital.pendingReviews} tone="warning" />
            <StatLine label="Verified by you" value={hospital.verifiedByMe} tone="success" />
            <StatLine label="Rejected by you" value={hospital.rejectedByMe} tone="neutral" />
          </div>
          {hospital.queuePreview.length > 0 ? (
            <ul className="mt-4 divide-y divide-ink-100 border-t border-ink-100">
              {hospital.queuePreview.slice(0, 3).map((request) => (
                <li key={request.id}>
                  <RequestRow request={request} />
                </li>
              ))}
            </ul>
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
              <ArrowRight className="size-3.5" aria-hidden="true" />
            </Link>
          }
        >
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <StatLine label="Active users" value={admin.stats.active_users} tone="success" />
            <StatLine label="Active requests" value={admin.stats.active_requests} tone="brand" />
            <StatLine
              label="Pending hospitals"
              value={admin.stats.pending_hospitals}
              tone={admin.stats.pending_hospitals > 0 ? 'warning' : 'neutral'}
            />
            <StatLine
              label="Suspicious patterns"
              value={admin.suspiciousCount}
              tone={admin.suspiciousCount > 0 ? 'warning' : 'neutral'}
            />
          </div>
        </SectionCard>
      ) : null}

      {/* Next steps ----------------------------------------------------- */}
      <section aria-labelledby="next-steps">
        <div className="flex items-baseline justify-between gap-3 border-b border-ink-200 pb-3">
          <h2 id="next-steps" className="type-title text-[1.0625rem] text-ink-900">
            Next steps
          </h2>
          <span className="text-[0.6875rem] text-ink-500">Useful actions for your workspace</span>
        </div>
        <div className="grid gap-3 pt-4 sm:grid-cols-3">
          {roleNextSteps.map((step) => (
            <NextStep
              key={step.to + step.title}
              to={step.to}
              icon={step.icon}
              title={step.title}
              description={step.description}
            />
          ))}
        </div>
      </section>

      <p className="flex items-start gap-2 rounded-lg border border-ink-200 bg-ink-50/60 px-4 py-3 text-[0.6875rem] leading-relaxed text-ink-500">
        <AlertTriangle className="mt-0.5 size-3.5 shrink-0 text-amber-600" aria-hidden="true" />
        {emergencyNotice}
      </p>
    </div>
  );
}

/* -------------------------------------------------------------------------- */

function ResponseRow({ response }: { response: DonorResponse }) {
  return (
    <Link
      to={`/app/requests/${response.requestId}`}
      className="group flex items-center gap-3 py-3 transition first:pt-0 last:pb-0"
    >
      <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-ink-100 text-ink-500">
        <HandHeart className="size-4" aria-hidden="true" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-[0.8125rem] font-semibold text-ink-900">
          {response.request?.hospitalName ?? 'Request'}
        </p>
        <p className="mt-0.5 text-[0.6875rem] text-ink-500">
          {response.request?.bloodGroup ?? response.donorBloodGroup ?? '—'} · Offered{' '}
          {formatRelative(response.createdAt)}
        </p>
      </div>
      <Badge
        tone={
          response.responseStatus === 'ACCEPTED' || response.responseStatus === 'COMPLETED'
            ? 'success'
            : response.responseStatus === 'DECLINED' || response.responseStatus === 'WITHDRAWN'
              ? 'neutral'
              : 'info'
        }
        dot
      >
        {response.responseStatus.charAt(0) + response.responseStatus.slice(1).toLowerCase()}
      </Badge>
      <ArrowRight
        className="size-3.5 shrink-0 text-ink-300 transition group-hover:translate-x-0.5 group-hover:text-brand-accent"
        aria-hidden="true"
      />
    </Link>
  );
}

function ActivityTimeline({ items }: { items: RecentActivity[] }) {
  return (
    <ol className="relative ml-1.5 space-y-5 border-l border-ink-200 pl-5">
      {items.slice(0, 5).map((activity) => (
        <li key={activity.id} className="relative">
          <span
            className="absolute -left-[1.4rem] top-1.5 size-2.5 rounded-full border-2 border-surface-raised bg-brand-500"
            aria-hidden="true"
          />
          <div className="flex flex-wrap items-center gap-2">
            <RequestStatusBadge status={activity.toStatus} />
            <Link
              to={`/app/requests/${activity.requestId}`}
              className="text-[0.8125rem] font-semibold text-ink-800 transition hover:text-brand-accent"
            >
              {activity.hospitalName}
            </Link>
          </div>
          <p className="mt-1 text-[0.75rem] leading-relaxed text-ink-500">
            {activity.reason ?? `${activity.bloodGroup} request status updated.`}
          </p>
          <time className="mt-1 block text-[0.6875rem] text-ink-400">
            {formatRelative(activity.createdAt)}
          </time>
        </li>
      ))}
    </ol>
  );
}

function FirstRequestPanel() {
  return (
    <div className="overflow-hidden rounded-xl border border-ink-200/90 bg-surface-raised shadow-card">
      <div className="grid gap-5 p-5 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center sm:p-6">
        <div className="min-w-0">
          <p className="type-eyebrow">Start here</p>
          <h3 className="type-title mt-2 text-lg text-ink-900">
            Create your first blood request
          </h3>
          <p className="mt-1.5 max-w-md text-[0.8125rem] leading-relaxed text-ink-500">
            A hospital verifier reviews every request before donors can see it. You can track the
            review decision and donor offers here.
          </p>
        </div>
        <Link to="/app/requests/new" className={buttonClasses('primary', 'md', 'shrink-0')}>
          <PlusCircle className="size-4" aria-hidden="true" />
          Create a request
        </Link>
      </div>
      <ol className="grid gap-px border-t border-ink-100 bg-ink-100 sm:grid-cols-3">
        {[
          ['Describe the need', 'Blood group, units, hospital and deadline.'],
          ['Hospital review', 'A verified hospital records a decision.'],
          ['Coordinate offers', 'Donor offers appear with contact protection.'],
        ].map(([title, copy], index) => (
          <li key={title} className="bg-surface-raised px-5 py-4">
            <p className="flex items-center gap-2 text-[0.75rem] font-semibold text-ink-900">
              <span className="flex size-5 items-center justify-center rounded-full bg-ink-100 text-[0.625rem] font-bold text-ink-500">
                {index + 1}
              </span>
              {title}
            </p>
            <p className="mt-1 text-[0.6875rem] leading-relaxed text-ink-500">{copy}</p>
          </li>
        ))}
      </ol>
    </div>
  );
}

function DonorOnboarding() {
  return (
    <section className="overflow-hidden rounded-xl border border-ink-200/90 bg-surface-raised p-5 shadow-card sm:p-6">
      <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
        <div className="max-w-2xl min-w-0">
          <div className="flex items-center gap-2">
            <span className="flex size-6 items-center justify-center rounded-full bg-brand-50 text-brand-accent">
              <Droplet className="size-3.5" aria-hidden="true" />
            </span>
            <p className="type-eyebrow">Blood donation coordination network</p>
          </div>
          <h2 className="type-title mt-2 text-[1.25rem] text-ink-900 sm:text-[1.375rem]">
            Be reachable when your blood group is needed
          </h2>
          <p className="mt-1.5 text-sm leading-relaxed text-ink-600">
            A donor profile enables notifications for verified hospital requests matching your exact blood group. Your phone number and precise location stay private until you voluntarily consent to an accepted offer.
          </p>
        </div>

        <div className="flex shrink-0 flex-wrap items-center gap-2.5">
          <Link to="/app/donor" className={buttonClasses('primary', 'md')}>
            <Droplet className="size-4" aria-hidden="true" />
            Create donor profile
          </Link>
          <Link to="/how-it-works" className={buttonClasses('secondary', 'md')}>
            How matching works
          </Link>
        </div>
      </div>

      <div className="mt-5 grid gap-3 border-t border-ink-100 pt-4 sm:grid-cols-3">
        <div className="flex items-start gap-2.5">
          <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-accent-600" aria-hidden="true" />
          <div>
            <p className="text-[0.8125rem] font-semibold text-ink-900">Exact match only</p>
            <p className="mt-0.5 text-[0.6875rem] leading-relaxed text-ink-500">
              Only hospital-reviewed requests for your exact recorded blood group are shown.
            </p>
          </div>
        </div>
        <div className="flex items-start gap-2.5">
          <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-accent-600" aria-hidden="true" />
          <div>
            <p className="text-[0.8125rem] font-semibold text-ink-900">Protected contact</p>
            <p className="mt-0.5 text-[0.6875rem] leading-relaxed text-ink-500">
              Your contact details are withheld until an offer is accepted and consent is given.
            </p>
          </div>
        </div>
        <div className="flex items-start gap-2.5">
          <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-accent-600" aria-hidden="true" />
          <div>
            <p className="text-[0.8125rem] font-semibold text-ink-900">Pause anytime</p>
            <p className="mt-0.5 text-[0.6875rem] leading-relaxed text-ink-500">
              Toggle availability off with a single tap. Existing coordination records are preserved.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}

function MiniStat({ label, value }: { label: string; value: number }) {
  return (
    <div className="px-2">
      <p className="type-metric text-xl text-ink-900">{value}</p>
      <p className="mt-0.5 text-[0.625rem] font-medium uppercase tracking-[0.08em] text-ink-500">
        {label}
      </p>
    </div>
  );
}

function StatLine({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: 'neutral' | 'brand' | 'success' | 'warning';
}) {
  const accent = {
    neutral: 'text-ink-900',
    brand: 'text-brand-accent',
    success: 'text-accent-700',
    warning: 'text-amber-700',
  }[tone];

  return (
    <div className="rounded-lg border border-ink-200/80 bg-ink-50/40 px-4 py-3">
      <p className="text-[0.6875rem] font-medium text-ink-500">{label}</p>
      <p className={cn('type-metric mt-1.5 text-2xl', accent)}>{value}</p>
    </div>
  );
}

function NextStep({
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
          <ArrowRight
            className="size-3 text-ink-300 transition group-hover:translate-x-0.5 group-hover:text-brand-accent"
            aria-hidden="true"
          />
        </span>
        <span className="mt-0.5 block text-[0.6875rem] leading-relaxed text-ink-500">
          {description}
        </span>
      </span>
    </Link>
  );
}
