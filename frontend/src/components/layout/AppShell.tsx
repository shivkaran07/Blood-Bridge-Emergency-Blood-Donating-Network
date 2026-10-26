import { useEffect, useRef, useState, type ComponentType } from 'react';
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import {
  Bell,
  Building2,
  ChevronDown,
  ClipboardCheck,
  ClipboardList,
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
  X,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { Badge, RoleBadge } from '../ui/Badge';
import { Avatar } from '../ui/StatCard';
import { Logo } from './Logo';
import { cn } from '../../lib/cn';
import { pluralize } from '../../lib/format';

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

const pageTitles: Array<{ match: RegExp; title: string }> = [
  { match: /^\/app\/?$/, title: 'Dashboard' },
  { match: /^\/app\/requests\/new$/, title: 'New blood request' },
  { match: /^\/app\/requests\/[^/]+$/, title: 'Request details' },
  { match: /^\/app\/requests$/, title: 'Request feed' },
  { match: /^\/app\/my-requests$/, title: 'My requests' },
  { match: /^\/app\/my-responses$/, title: 'My responses' },
  { match: /^\/app\/notifications$/, title: 'Notifications' },
  { match: /^\/app\/donor$/, title: 'Donor profile' },
  { match: /^\/app\/hospital\/application$/, title: 'Hospital verification' },
  { match: /^\/app\/hospital\/queue$/, title: 'Verification queue' },
  { match: /^\/app\/hospital\/audit$/, title: 'Review history' },
  { match: /^\/app\/hospital$/, title: 'Hospital overview' },
  { match: /^\/app\/admin\/users$/, title: 'User management' },
  { match: /^\/app\/admin\/requests$/, title: 'All requests' },
  { match: /^\/app\/admin\/hospitals$/, title: 'Hospital applications' },
  { match: /^\/app\/admin\/audit$/, title: 'Audit log' },
  { match: /^\/app\/admin$/, title: 'Administration' },
  { match: /^\/app\/blockchain$/, title: 'Verification & audit' },
  { match: /^\/app\/profile$/, title: 'Profile' },
];

export function AppShell() {
  const { me, signOut } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    setMobileOpen(false);
    setMenuOpen(false);
    const entry = pageTitles.find((item) => item.match.test(location.pathname));
    document.title = `${entry?.title ?? 'Workspace'} · BloodBridge`;
    window.scrollTo(0, 0);
  }, [location.pathname]);

  useEffect(() => {
    if (!menuOpen) return;
    const onPointerDown = (event: MouseEvent) => {
      if (!menuRef.current?.contains(event.target as Node)) setMenuOpen(false);
    };
    document.addEventListener('mousedown', onPointerDown);
    return () => document.removeEventListener('mousedown', onPointerDown);
  }, [menuOpen]);

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

  const currentTitle =
    pageTitles.find((item) => item.match.test(location.pathname))?.title ?? 'Workspace';

  const primaryRole = me.permissions.isAdmin
    ? 'ADMIN'
    : isApproved
      ? 'HOSPITAL'
      : me.permissions.isDonor
        ? 'DONOR'
        : 'REQUESTER';

  const renderNav = () => (
    <nav className="flex-1 space-y-5 overflow-y-auto px-3 pb-4 pt-2" aria-label="Main navigation">
      <Link
        to="/app/requests/new"
        className="flex items-center justify-center gap-2 rounded-xl bg-brand-700 px-3 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-800"
      >
        <PlusCircle className="size-4" aria-hidden="true" />
        New blood request
      </Link>
      {groups.map((group) => (
        <div key={group.label}>
          <p className="px-3 pb-1.5 text-[0.65rem] font-semibold uppercase tracking-[0.14em] text-ink-400">
            {group.label}
          </p>
          <ul className="space-y-0.5">
            {group.items.map((item) => {
              const Icon = item.icon;
              return (
                <li key={item.to}>
                  <NavLink
                    to={item.to}
                    end={item.end}
                    className={({ isActive }) =>
                      cn(
                        'group flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition',
                        isActive
                          ? 'bg-brand-50 text-brand-800'
                          : 'text-ink-600 hover:bg-ink-50 hover:text-ink-900',
                      )
                    }
                  >
                    {({ isActive }) => (
                      <>
                        <Icon
                          className={cn(
                            'size-[1.05rem] shrink-0',
                            isActive ? 'text-brand-700' : 'text-ink-400 group-hover:text-ink-600',
                          )}
                        />
                        <span className="min-w-0 flex-1 truncate">{item.label}</span>
                        {item.badge ? (
                          <span className="rounded-full bg-brand-700 px-1.5 py-0.5 text-[0.65rem] font-bold text-white">
                            {item.badge > 99 ? '99+' : item.badge}
                          </span>
                        ) : null}
                      </>
                    )}
                  </NavLink>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );

  const renderFooter = () => (
    <div className="space-y-3 border-t border-ink-100 p-3">
      <Link
        to="/app/profile"
        className="flex items-center gap-3 rounded-lg p-2 transition hover:bg-ink-50"
      >
        <Avatar name={me.profile.fullName} size="sm" />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-semibold text-ink-900">
            {me.profile.fullName || 'Your profile'}
          </span>
          <span className="block truncate text-xs text-ink-500">{me.user.email}</span>
        </span>
      </Link>
      <div className="flex items-center justify-between gap-2 px-2">
        <RoleBadge role={primaryRole} />
        <span className="text-[0.65rem] font-medium uppercase tracking-wider text-ink-400">
          Part 1
        </span>
      </div>
      <p className="px-2 text-[0.68rem] leading-relaxed text-ink-400">
        Database-backed verification. No blockchain anchor is created in Part 1.
      </p>
    </div>
  );

  return (
    <div className="min-h-dvh bg-surface">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:left-3 focus:top-3 focus:z-[70] focus:rounded-lg focus:bg-white focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:shadow"
      >
        Skip to content
      </a>

      <aside className="fixed inset-y-0 left-0 z-40 hidden w-64 flex-col border-r border-ink-200 bg-white lg:flex">
        <div className="flex h-16 items-center border-b border-ink-100 px-5">
          <Logo to="/app" />
        </div>
        {renderNav()}
        {renderFooter()}
      </aside>

      {mobileOpen ? (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div
            className="absolute inset-0 bg-ink-950/40 backdrop-blur-[2px]"
            onClick={() => setMobileOpen(false)}
            aria-hidden="true"
          />
          <div className="relative flex h-full w-[18rem] max-w-[85vw] flex-col border-r border-ink-200 bg-white shadow-lift">
            <div className="flex h-16 items-center justify-between border-b border-ink-100 px-4">
              <Logo to="/app" />
              <button
                type="button"
                onClick={() => setMobileOpen(false)}
                className="rounded-lg p-2 text-ink-500 hover:bg-ink-100"
                aria-label="Close menu"
              >
                <X className="size-5" />
              </button>
            </div>
            {renderNav()}
            {renderFooter()}
          </div>
        </div>
      ) : null}

      <div className="lg:pl-64">
        <header className="sticky top-0 z-30 border-b border-ink-200/80 bg-white/85 backdrop-blur">
          <div className="flex h-16 items-center gap-3 px-4 sm:px-6 lg:px-8">
            <button
              type="button"
              onClick={() => setMobileOpen(true)}
              className="rounded-lg p-2 text-ink-600 hover:bg-ink-100 lg:hidden"
              aria-label="Open menu"
            >
              <Menu className="size-5" />
            </button>
            <div className="flex min-w-0 items-center gap-2 lg:hidden">
              <Logo to="/app" compact />
            </div>
            <div className="hidden min-w-0 lg:block">
              <p className="truncate text-sm font-semibold text-ink-900">{currentTitle}</p>
              <p className="truncate text-xs text-ink-400">
                {unread > 0
                  ? `${unread} unread ${pluralize(unread, 'notification')}`
                  : 'All caught up'}
              </p>
            </div>

            <div className="ml-auto flex items-center gap-1.5 sm:gap-2">
              <Badge tone="outline" className="hidden sm:inline-flex">
                <ShieldCheck className="size-3.5" aria-hidden="true" />
                Part 1
              </Badge>
              <Link
                to="/app/notifications"
                className="relative rounded-lg p-2.5 text-ink-500 transition hover:bg-ink-100 hover:text-ink-800"
                aria-label={unread > 0 ? `Notifications, ${unread} unread` : 'Notifications'}
              >
                <Bell className="size-5" />
                {unread > 0 ? (
                  <span className="absolute right-1.5 top-1.5 flex min-w-4 items-center justify-center rounded-full bg-brand-700 px-1 text-[0.6rem] font-bold leading-4 text-white">
                    {unread > 9 ? '9+' : unread}
                  </span>
                ) : null}
              </Link>

              <div className="relative" ref={menuRef}>
                <button
                  type="button"
                  onClick={() => setMenuOpen((open) => !open)}
                  className="flex items-center gap-2 rounded-lg p-1.5 transition hover:bg-ink-100"
                  aria-haspopup="menu"
                  aria-expanded={menuOpen}
                >
                  <Avatar name={me.profile.fullName} size="sm" />
                  <span className="hidden max-w-32 truncate text-sm font-semibold text-ink-800 sm:block">
                    {me.profile.fullName.split(' ')[0]}
                  </span>
                  <ChevronDown className="hidden size-4 text-ink-400 sm:block" aria-hidden="true" />
                </button>
                {menuOpen ? (
                  <div
                    role="menu"
                    className="absolute right-0 mt-2 w-60 overflow-hidden rounded-xl border border-ink-200 bg-white shadow-lift"
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
                        className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-ink-700 hover:bg-ink-50"
                      >
                        <UserRound className="size-4 text-ink-400" aria-hidden="true" />
                        Profile settings
                      </Link>
                      <Link
                        to="/app/notifications"
                        role="menuitem"
                        className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-ink-700 hover:bg-ink-50"
                      >
                        <Bell className="size-4 text-ink-400" aria-hidden="true" />
                        Notifications
                      </Link>
                      <button
                        type="button"
                        role="menuitem"
                        onClick={() => {
                          void signOut().then(() => navigate('/', { replace: true }));
                        }}
                        className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm text-brand-700 hover:bg-brand-50"
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

        <main id="main-content" className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
          <Outlet />
        </main>

        <footer className="mx-auto w-full max-w-6xl px-4 pb-8 text-xs text-ink-400 sm:px-6 lg:px-8">
          BloodBridge Part 1 · Database-backed hospital verification. Not an emergency service.
        </footer>
      </div>
    </div>
  );
}
