import { useEffect, useRef, useState, type ComponentType } from 'react';
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import {
  Bell,
  Building2,
  ChevronDown,
  ChevronsLeft,
  ChevronsRight,
  ClipboardCheck,
  ClipboardList,
  Database,
  Droplet,
  FileSearch,
  HandHeart,
  HeartHandshake,
  History,
  LayoutDashboard,
  LogOut,
  Menu,
  PlusCircle,
  ScrollText,
  ShieldCheck,
  UserRound,
  Users,
  WifiOff,
  X,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { RoleBadge } from '../ui/Badge';
import { Avatar } from '../ui/StatCard';
import { ThemeToggle } from '../ui/ThemeToggle';
import { Logo } from './Logo';
import { cn } from '../../lib/cn';
import {
  describeVerification,
  useVerificationStatus,
} from '../../lib/verificationStatus';
import type { BlockchainStatus } from '../../types/api';

interface NavItem {
  to: string;
  label: string;
  icon: ComponentType<{ className?: string }>;
  end?: boolean;
  badge?: number;
}

interface NavGroup {
  label: string;
  items: NavItem[];
}

const pageTitles: Array<{ match: RegExp; title: string; group: string }> = [
  { match: /^\/app\/?$/, title: 'Dashboard', group: 'Workspace' },
  { match: /^\/app\/requests\/new$/, title: 'New blood request', group: 'Requests' },
  { match: /^\/app\/requests\/[^/]+$/, title: 'Request details', group: 'Requests' },
  { match: /^\/app\/requests$/, title: 'Request feed', group: 'Requests' },
  { match: /^\/app\/my-requests$/, title: 'My requests', group: 'Requests' },
  { match: /^\/app\/my-responses$/, title: 'My responses', group: 'Requests' },
  { match: /^\/app\/notifications$/, title: 'Notifications', group: 'Workspace' },
  { match: /^\/app\/donor$/, title: 'Donor profile', group: 'Donor' },
  { match: /^\/app\/hospital\/application$/, title: 'Hospital verification', group: 'Hospital' },
  { match: /^\/app\/hospital\/queue$/, title: 'Verification queue', group: 'Hospital' },
  { match: /^\/app\/hospital\/audit$/, title: 'Review history', group: 'Hospital' },
  { match: /^\/app\/hospital$/, title: 'Hospital overview', group: 'Hospital' },
  { match: /^\/app\/admin\/users$/, title: 'User management', group: 'Administration' },
  { match: /^\/app\/admin\/requests$/, title: 'All requests', group: 'Administration' },
  { match: /^\/app\/admin\/hospitals$/, title: 'Hospital applications', group: 'Administration' },
  { match: /^\/app\/admin\/audit$/, title: 'Audit log', group: 'Administration' },
  { match: /^\/app\/admin$/, title: 'Overview', group: 'Administration' },
  { match: /^\/app\/blockchain$/, title: 'Verification & audit', group: 'Trust' },
  { match: /^\/app\/profile$/, title: 'Profile', group: 'Account' },
];

const SIDEBAR_KEY = 'bloodbridge.sidebar';

export function AppShell() {
  const { me, signOut } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(() => {
    try {
      return window.localStorage.getItem(SIDEBAR_KEY) === 'collapsed';
    } catch {
      return false;
    }
  });
  const menuRef = useRef<HTMLDivElement | null>(null);

  // Shared with the Verification & audit page so every surface reports the
  // same backend-derived mode.
  const verification = useVerificationStatus();

  useEffect(() => {
    setMobileOpen(false);
    setMenuOpen(false);
    const entry = pageTitles.find((item) => item.match.test(location.pathname));
    document.title = `${entry?.title ?? 'Workspace'} · BloodBridge`;
    window.scrollTo(0, 0);
  }, [location.pathname]);

  useEffect(() => {
    try {
      window.localStorage.setItem(SIDEBAR_KEY, collapsed ? 'collapsed' : 'expanded');
    } catch {
      /* Storage may be unavailable; the session state still applies. */
    }
  }, [collapsed]);

  useEffect(() => {
    if (!menuOpen) return;
    const onPointerDown = (event: MouseEvent) => {
      if (!menuRef.current?.contains(event.target as Node)) setMenuOpen(false);
    };
    document.addEventListener('mousedown', onPointerDown);
    return () => document.removeEventListener('mousedown', onPointerDown);
  }, [menuOpen]);

  useEffect(() => {
    if (!mobileOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setMobileOpen(false);
    };
    document.addEventListener('keydown', onKeyDown);
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = previous;
    };
  }, [mobileOpen]);

  if (!me) return null;

  const unread = me.unreadNotifications;
  const isApproved = me.permissions.isApprovedVerifier;

  const groups: NavGroup[] = [
    {
      label: 'Workspace',
      items: [
        { to: '/app', label: 'Dashboard', icon: LayoutDashboard, end: true },
        { to: '/app/requests', label: 'Request feed', icon: HeartHandshake },
        { to: '/app/my-requests', label: 'My requests', icon: ClipboardList },
        ...(me.permissions.isDonor
          ? [{ to: '/app/my-responses', label: 'My responses', icon: HandHeart }]
          : []),
        { to: '/app/notifications', label: 'Notifications', icon: Bell, badge: unread },
      ],
    },
    {
      label: 'Donor',
      items: [{ to: '/app/donor', label: me.donorProfile ? 'Donor profile' : 'Become a donor', icon: Droplet }],
    },
    {
      label: 'Hospital',
      items: isApproved
        ? [
            { to: '/app/hospital', label: 'Hospital overview', icon: Building2, end: true },
            { to: '/app/hospital/queue', label: 'Verification queue', icon: ClipboardCheck },
            { to: '/app/hospital/audit', label: 'Review history', icon: History },
          ]
        : me.permissions.isAdmin
          ? []
          : [{ to: '/app/hospital/application', label: 'Verification application', icon: Building2 }],
    },
    ...(me.permissions.isAdmin
      ? [
          {
            label: 'Administration',
            items: [
              { to: '/app/admin', label: 'Overview', icon: ShieldCheck, end: true },
              { to: '/app/admin/users', label: 'Users', icon: Users },
              { to: '/app/admin/requests', label: 'All requests', icon: FileSearch },
              { to: '/app/admin/hospitals', label: 'Hospitals', icon: Building2 },
              { to: '/app/admin/audit', label: 'Audit log', icon: ScrollText },
            ],
          },
        ]
      : []),
    {
      label: 'Trust',
      items: [{ to: '/app/blockchain', label: 'Verification & audit', icon: ShieldCheck }],
    },
  ];

  const entry = pageTitles.find((item) => item.match.test(location.pathname));
  const currentTitle = entry?.title ?? 'Workspace';
  const currentGroup = entry?.group ?? 'Workspace';

  const primaryRole = me.permissions.isAdmin
    ? 'ADMIN'
    : isApproved
      ? 'HOSPITAL'
      : me.permissions.isDonor
        ? 'DONOR'
        : 'REQUESTER';

  const navLink = (item: NavItem, isCollapsed: boolean) => {
    const Icon = item.icon;
    return (
      <NavLink
        key={item.to}
        to={item.to}
        end={item.end}
        title={isCollapsed ? item.label : undefined}
        className={({ isActive }) =>
          cn(
            'group relative flex min-h-10 items-center gap-3 rounded-xl px-2.5 py-2 text-[0.8125rem] font-medium transition-[background-color,color,box-shadow,transform] duration-200 motion-reduce:hover:translate-x-0',
            isCollapsed && 'justify-center px-0',
            isActive
              ? 'nav-active-rail bg-gradient-to-r from-brand-100/80 to-brand-50/45 text-brand-accent shadow-[inset_0_0_0_1px_rgb(217_32_63/0.1)]'
              : 'text-ink-600 hover:translate-x-0.5 hover:bg-ink-50 hover:text-ink-900',
          )
        }
      >
        {({ isActive }) => (
          <>
            <Icon
              className={cn(
                'size-[1.05rem] shrink-0 transition-colors',
                isActive ? 'text-brand-accent' : 'text-ink-400 group-hover:text-ink-600',
              )}
              aria-hidden="true"
            />
            {!isCollapsed ? (
              <>
                <span className="min-w-0 flex-1 truncate">{item.label}</span>
                {item.badge ? (
                  <span className="rounded-full bg-brand-700 px-1.5 py-0.5 text-[0.625rem] font-bold leading-none text-white">
                    {item.badge > 99 ? '99+' : item.badge}
                  </span>
                ) : null}
              </>
            ) : item.badge ? (
              <span className="absolute right-1.5 top-1.5 size-1.5 rounded-full bg-brand-600" aria-hidden="true" />
            ) : null}
          </>
        )}
      </NavLink>
    );
  };

  const sidebarNav = (isCollapsed: boolean) => (
    <nav
      className={cn('flex-1 overflow-y-auto pb-4 pt-4', isCollapsed ? 'px-2' : 'px-3')}
      aria-label="Main navigation"
    >
      <div className={cn('mb-5', isCollapsed && 'px-0')}>
        {isCollapsed ? (
          <Link
            to="/app/requests/new"
            className="flex size-10 items-center justify-center rounded-lg bg-brand-700 text-white shadow-sm transition hover:bg-brand-800"
            title="New blood request"
            aria-label="New blood request"
          >
            <PlusCircle className="size-[1.15rem]" aria-hidden="true" />
          </Link>
        ) : (
          <Link
            to="/app/requests/new"
            className="flex min-h-10 items-center justify-center gap-2 rounded-lg bg-gradient-to-r from-brand-700 via-brand-700 to-brand-800 px-3.5 text-[0.8125rem] font-semibold text-white shadow-[0_2px_8px_-2px_rgba(171,18,46,0.35)] transition-all hover:shadow-[0_4px_12px_-2px_rgba(171,18,46,0.45)] hover:from-brand-800 hover:to-brand-900 active:translate-y-px"
          >
            <PlusCircle className="size-4" aria-hidden="true" />
            New blood request
          </Link>
        )}
      </div>

      <div className="space-y-5">
        {groups.filter((group) => group.items.length > 0).map((group) => (
          <div key={group.label}>
            {isCollapsed ? (
              <div className="mx-2 mb-2 h-px bg-ink-100" aria-hidden="true" />
            ) : (
              <p className="mb-1.5 px-2.5 text-[0.625rem] font-semibold uppercase tracking-[0.15em] text-ink-400">
                {group.label}
              </p>
            )}
            <ul className="space-y-0.5">
              {group.items.map((item) => (
                <li key={item.to}>{navLink(item, isCollapsed)}</li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </nav>
  );

  const sidebarFooter = (isCollapsed: boolean) => (
    <div className={cn('border-t border-ink-100', isCollapsed ? 'p-2' : 'p-3')}>
      {isCollapsed ? (
        <Link
          to="/app/profile"
          className="flex justify-center rounded-lg p-1.5 transition hover:bg-ink-50"
          title={me.profile.fullName}
        >
          <Avatar name={me.profile.fullName} size="sm" />
        </Link>
      ) : (
        <Link
          to="/app/profile"
          className="flex min-h-11 items-center gap-2.5 rounded-lg p-1.5 transition hover:bg-ink-50"
        >
          <Avatar name={me.profile.fullName} size="sm" />
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[0.8125rem] font-semibold text-ink-900">
              {me.profile.fullName || 'Your profile'}
            </span>
            <span className="block truncate text-[0.6875rem] text-ink-500">{me.user.email}</span>
          </span>
          <ChevronDown className="size-3.5 shrink-0 -rotate-90 text-ink-400" aria-hidden="true" />
        </Link>
      )}
      {!isCollapsed ? (
        <div className="mt-2 flex items-center justify-between gap-2 px-1.5">
          <RoleBadge role={primaryRole} />
          <span className="text-[0.625rem] font-medium uppercase tracking-[0.1em] text-ink-400">
            Verified workflow
          </span>
        </div>
      ) : null}
    </div>
  );

  const mobileItems: NavItem[] = [
    { to: '/app', label: 'Home', icon: LayoutDashboard, end: true },
    { to: '/app/requests', label: 'Feed', icon: HeartHandshake },
    { to: '/app/requests/new', label: 'Request', icon: PlusCircle },
    { to: '/app/notifications', label: 'Alerts', icon: Bell, badge: unread },
    { to: '/app/profile', label: 'Profile', icon: UserRound },
  ];

  return (
    <div className="workspace-shell min-h-dvh">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:left-3 focus:top-3 focus:z-[70] focus:rounded-lg focus:bg-surface-raised focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-ink-900 focus:shadow"
      >
        Skip to content
      </a>

      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-40 hidden flex-col border-r border-ink-200/90 bg-surface-raised/95 shadow-[8px_0_32px_-28px_rgb(29_26_23/0.3)] backdrop-blur-xl transition-[width] duration-200 lg:flex',
          collapsed ? 'w-[4.75rem]' : 'w-[16.5rem]',
        )}
      >
        <div
          className={cn(
            'flex h-16 shrink-0 items-center border-b border-ink-100',
            collapsed ? 'justify-center px-2' : 'justify-between px-4',
          )}
        >
          <Logo to="/app" compact={collapsed} />
          {!collapsed ? (
            <button
              type="button"
              onClick={() => setCollapsed(true)}
              className="flex size-8 items-center justify-center rounded-md text-ink-400 transition hover:bg-ink-100 hover:text-ink-700"
              aria-label="Collapse navigation"
              title="Collapse navigation"
            >
              <ChevronsLeft className="size-4" aria-hidden="true" />
            </button>
          ) : null}
        </div>
        {sidebarNav(collapsed)}
        {sidebarFooter(collapsed)}
      </aside>

      {mobileOpen ? (
        <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true" aria-label="Navigation menu">
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-[2px]"
            onClick={() => setMobileOpen(false)}
            aria-hidden="true"
          />
          <div className="relative flex h-full w-[19rem] max-w-[86vw] flex-col border-r border-ink-200 bg-surface-raised shadow-lift">
            <div className="flex h-16 shrink-0 items-center justify-between border-b border-ink-100 px-4">
              <Logo to="/app" />
              <button
                type="button"
                onClick={() => setMobileOpen(false)}
                className="flex size-11 items-center justify-center rounded-lg text-ink-500 hover:bg-ink-100"
                aria-label="Close menu"
              >
                <X className="size-5" aria-hidden="true" />
              </button>
            </div>
            {sidebarNav(false)}
            {sidebarFooter(false)}
          </div>
        </div>
      ) : null}

      <div className={cn('transition-[padding] duration-200', collapsed ? 'lg:pl-[4.75rem]' : 'lg:pl-[16.5rem]')}>
        <header className="sticky top-0 z-30 border-b border-ink-200/80 bg-surface/80 shadow-[0_8px_24px_-24px_rgb(29_26_23/0.4)] backdrop-blur-xl">
          <div className="mx-auto flex h-16 w-full max-w-[86rem] items-center gap-2 px-4 sm:gap-3 sm:px-6 lg:px-8">
            <button
              type="button"
              onClick={() => setMobileOpen(true)}
              className="flex size-11 items-center justify-center rounded-lg text-ink-600 hover:bg-ink-100 lg:hidden"
              aria-label="Open menu"
            >
              <Menu className="size-5" aria-hidden="true" />
            </button>

            {collapsed ? (
              <button
                type="button"
                onClick={() => setCollapsed(false)}
                className="hidden size-9 items-center justify-center rounded-md text-ink-400 transition hover:bg-ink-100 hover:text-ink-700 lg:flex"
                aria-label="Expand navigation"
                title="Expand navigation"
              >
                <ChevronsRight className="size-4" aria-hidden="true" />
              </button>
            ) : null}

            <div className="min-w-0 flex-1">
              <p className="hidden truncate text-[0.625rem] font-semibold uppercase tracking-[0.14em] text-ink-400 sm:block">
                {currentGroup}
              </p>
              <h1 className="truncate text-[0.9375rem] font-semibold tracking-[-0.01em] text-ink-900">
                {currentTitle}
              </h1>
            </div>

            <div className="flex shrink-0 items-center gap-1 sm:gap-2">
              <NetworkStatusPill
                isLoading={verification.isLoading}
                data={verification.data}
                hasError={verification.isError}
              />
              <Link
                to="/app/blockchain"
                className="hidden items-center gap-1.5 rounded-full border border-ink-200 bg-surface-raised px-2.5 py-1 text-[0.6875rem] font-semibold text-ink-600 transition hover:border-ink-300 hover:text-ink-900 xl:inline-flex"
              >
                <ShieldCheck className="size-3.5 text-accent-600" aria-hidden="true" />
                Audit trail
              </Link>
              <ThemeToggle />
              <Link
                to="/app/notifications"
                className="relative flex size-11 items-center justify-center rounded-lg text-ink-500 transition hover:bg-ink-100 hover:text-ink-800"
                aria-label={unread > 0 ? `Notifications, ${unread} unread` : 'Notifications'}
              >
                <Bell className="size-[1.15rem]" aria-hidden="true" />
                {unread > 0 ? (
                  <span className="absolute right-1.5 top-1.5 flex min-w-4 items-center justify-center rounded-full bg-brand-700 px-1 text-[0.6rem] font-bold leading-4 text-white ring-2 ring-surface">
                    {unread > 9 ? '9+' : unread}
                  </span>
                ) : null}
              </Link>

              <span className="mx-0.5 hidden h-6 w-px bg-ink-200 sm:block" aria-hidden="true" />

              <div className="relative" ref={menuRef}>
                <button
                  type="button"
                  onClick={() => setMenuOpen((open) => !open)}
                  className="flex min-h-11 items-center gap-2 rounded-lg p-1 transition hover:bg-ink-100 sm:pl-1.5 sm:pr-2"
                  aria-haspopup="menu"
                  aria-expanded={menuOpen}
                >
                  <Avatar name={me.profile.fullName} size="sm" />
                  <span className="hidden max-w-36 truncate text-[0.8125rem] font-semibold text-ink-800 sm:block">
                    {me.profile.fullName}
                  </span>
                  <ChevronDown className="hidden size-3.5 text-ink-400 sm:block" aria-hidden="true" />
                  <span className="sr-only">Account menu</span>
                </button>
                {menuOpen ? (
                  <div
                    role="menu"
                    className="absolute right-0 mt-2 w-64 overflow-hidden rounded-xl border border-ink-200 bg-surface-raised shadow-lift"
                  >
                    <div className="border-b border-ink-100 px-4 py-3">
                      <p className="truncate text-sm font-semibold text-ink-900">
                        {me.profile.fullName}
                      </p>
                      <p className="truncate text-xs text-ink-500">{me.user.email}</p>
                      <div className="mt-2 flex flex-wrap gap-1">
                        {me.roles.map((role) => (
                          <RoleBadge key={role} role={role} />
                        ))}
                      </div>
                    </div>
                    <div className="p-1.5">
                      <Link
                        to="/app/profile"
                        role="menuitem"
                        className="flex min-h-10 items-center gap-2.5 rounded-lg px-3 text-sm text-ink-700 hover:bg-ink-50"
                      >
                        <UserRound className="size-4 text-ink-400" aria-hidden="true" />
                        Profile settings
                      </Link>
                      <Link
                        to="/app/notifications"
                        role="menuitem"
                        className="flex min-h-10 items-center gap-2.5 rounded-lg px-3 text-sm text-ink-700 hover:bg-ink-50"
                      >
                        <Bell className="size-4 text-ink-400" aria-hidden="true" />
                        Notifications
                        {unread > 0 ? (
                          <span className="ml-auto text-[0.6875rem] font-semibold text-brand-accent">
                            {unread} unread
                          </span>
                        ) : null}
                      </Link>
                      <button
                        type="button"
                        role="menuitem"
                        onClick={() => {
                          void signOut().then(() => navigate('/', { replace: true }));
                        }}
                        className="flex min-h-10 w-full items-center gap-2.5 rounded-lg px-3 text-left text-sm text-brand-accent hover:bg-brand-50"
                      >
                        <LogOut className="size-4" aria-hidden="true" />
                        Sign out
                      </button>
                    </div>
                  </div>
                ) : null}
              </div>
            </div>
          </div>
        </header>

        <main
          key={location.pathname}
          id="main-content"
          className="mx-auto w-full max-w-[86rem] animate-route-enter px-4 pb-28 pt-7 sm:px-6 lg:px-8 lg:pb-10 lg:pt-9"
        >
          <Outlet />
        </main>

        <footer className="mx-auto hidden w-full max-w-[86rem] px-4 pb-8 text-[0.6875rem] leading-relaxed text-ink-400 sm:px-6 lg:block lg:px-8">
          BloodBridge coordinates requests, offers and hospital review. Decisions are recorded in
          the application database; where configured, an authorized wallet may add an on-chain audit
          anchor. This is not an emergency service.
        </footer>
      </div>

      <nav
        className="safe-bottom fixed inset-x-0 bottom-0 z-40 border-t border-ink-200/90 bg-surface-raised/90 shadow-[0_-8px_24px_-24px_rgb(29_26_23/0.45)] backdrop-blur-xl lg:hidden"
        aria-label="Primary mobile navigation"
      >
        <ul className="mx-auto grid max-w-md grid-cols-5">
          {mobileItems.map((item) => {
            const Icon = item.icon;
            return (
              <li key={item.to}>
                <NavLink
                  to={item.to}
                  end={item.end}
                  className={({ isActive }) =>
                    cn(
                      'relative flex min-h-[3.5rem] flex-col items-center justify-center gap-1 px-1 py-1.5 text-[0.65rem] font-semibold transition',
                      isActive ? 'text-brand-accent' : 'text-ink-500 hover:text-ink-800',
                    )
                  }
                >
                  {({ isActive }) => (
                    <>
                      <span
                        className={cn(
                          'absolute inset-x-3 top-0 h-0.5 rounded-full transition-opacity',
                          isActive ? 'bg-brand-600 opacity-100' : 'opacity-0',
                        )}
                        aria-hidden="true"
                      />
                      <span className="relative flex size-7 items-center justify-center">
                        <Icon className="size-[1.15rem]" aria-hidden="true" />
                        {item.badge ? (
                          <span className="absolute -right-2 -top-1 flex min-w-4 items-center justify-center rounded-full bg-brand-700 px-1 text-[0.55rem] font-bold leading-4 text-white">
                            {item.badge > 9 ? '9+' : item.badge}
                          </span>
                        ) : null}
                      </span>
                      <span>{item.label}</span>
                    </>
                  )}
                </NavLink>
              </li>
            );
          })}\n        </ul>
      </nav>
    </div>
  );
}

// ---------------------------------------------------------------------------
// NetworkStatusPill — reflects the actual backend verification mode
// ---------------------------------------------------------------------------
function NetworkStatusPill({
  isLoading,
  data,
  hasError,
}: {
  isLoading: boolean;
  data: BlockchainStatus | undefined;
  hasError: boolean;
}) {
  // Render nothing while the initial fetch is in-flight so the header does not
  // flicker between placeholder states.
  if (isLoading) return null;

  const presentation = describeVerification(data, hasError);
  const toneClass = {
    neutral: 'border-ink-200 bg-surface-raised text-ink-600 hover:border-ink-300 hover:text-ink-900',
    success:
      'border-accent-200/80 bg-accent-50/70 text-accent-800 hover:bg-accent-100/60 dark:border-accent-800/50 dark:bg-accent-950/40 dark:text-accent-300',
    warning: 'border-amber-200 bg-amber-50 text-amber-800 hover:bg-amber-100 dark:border-amber-800/60 dark:bg-amber-950/40 dark:text-amber-300',
    danger: 'border-brand-200 bg-brand-50 text-brand-accent hover:bg-brand-100',
  }[presentation.tone];

  return (
    <Link
      to="/app/blockchain"
      className={cn(
        'inline-flex min-h-8 items-center gap-1.5 rounded-full border px-2 py-1 text-[0.6875rem] font-semibold transition',
        toneClass,
      )}
      title={`${presentation.title} — ${presentation.detail}`}
      aria-label={`Verification status: ${presentation.label}. ${presentation.detail}`}
    >
      {presentation.tone === 'success' ? (
        <span className="relative flex size-2" aria-hidden="true">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-accent-400 opacity-75 motion-reduce:animate-none" />
          <span className="relative inline-flex size-2 rounded-full bg-accent-500" />
        </span>
      ) : presentation.tone === 'warning' ? (
        <WifiOff className="size-3.5" aria-hidden="true" />
      ) : (
        <Database className="size-3.5" aria-hidden="true" />
      )}
      <span className="hidden sm:inline">{presentation.label}</span>
    </Link>
  );
}
