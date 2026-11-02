import { Link, Navigate, Outlet, useLocation } from 'react-router-dom';
import { LogOut, RefreshCw, ShieldX } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { Button, buttonClasses } from '../ui/Button';
import { Card } from '../ui/Card';
import { PageLoader } from '../ui/States';
import { ConfigNotice } from './ConfigNotice';

export function ProtectedRoute() {
  const auth = useAuth();
  const location = useLocation();

  if (auth.status === 'unconfigured') return <ConfigNotice />;
  if (auth.status === 'loading') return <PageLoader />;

  if (auth.status === 'error') {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-surface px-4 py-12">
        <Card className="w-full max-w-lg p-6 sm:p-8">
          <span className="flex size-12 items-center justify-center rounded-xl bg-brand-50 text-brand-accent">
            <ShieldX className="size-6" aria-hidden="true" />
          </span>
          <h1 className="mt-5 text-xl font-semibold text-ink-900">We could not open your workspace</h1>
          <p className="mt-2 text-sm leading-relaxed text-ink-600">{auth.error}</p>
          <p className="mt-2 text-xs leading-relaxed text-ink-500">
            If the API is unreachable, confirm the backend is running and that
            <code className="mx-1 rounded bg-ink-100 px-1 py-0.5">VITE_API_BASE_URL</code>
            points to it. An administrator may also have suspended the account.
          </p>
          <div className="mt-6 flex flex-wrap gap-2">
            <Button
              leftIcon={<RefreshCw className="size-4" />}
              onClick={() => {
                void auth.refreshMe().catch(() => undefined);
              }}
            >
              Try again
            </Button>
            <Button
              variant="secondary"
              leftIcon={<LogOut className="size-4" />}
              onClick={() => {
                void auth.signOut();
              }}
            >
              Sign out
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  if (auth.status === 'unauthenticated' || !auth.me) {
    const redirect = encodeURIComponent(`${location.pathname}${location.search}`);
    return <Navigate to={`/login?redirect=${redirect}`} replace />;
  }

  return <Outlet />;
}

export function RequireAdmin() {
  const { me } = useAuth();
  if (!me?.permissions.isAdmin) {
    return (
      <AccessDenied
        title="Administrator access required"
        description="This area is limited to BloodBridge administrators. If you believe you should have access, contact the platform operator."
      />
    );
  }
  return <Outlet />;
}

export function RequireApprovedHospital() {
  const { me } = useAuth();
  if (!me?.permissions.isApprovedVerifier) {
    return (
      <AccessDenied
        title="Approved hospital verifier access required"
        description={
          me?.hospitalProfile?.verificationStatus === 'PENDING'
            ? 'Your hospital application is pending administrator review. You will be able to review requests once it is approved.'
            : 'Only accounts with an approved hospital application can review and verify blood requests.'
        }
        showApplicationLink
      />
    );
  }
  return <Outlet />;
}

export function AccessDenied({
  title,
  description,
  showApplicationLink = false,
}: {
  title: string;
  description: string;
  showApplicationLink?: boolean;
}) {
  return (
    <div className="mx-auto flex max-w-2xl flex-col items-center py-16 text-center">
      <span className="flex size-14 items-center justify-center rounded-xl bg-brand-50 text-brand-accent">
        <ShieldX className="size-7" aria-hidden="true" />
      </span>
      <h1 className="mt-5 text-xl font-semibold text-ink-900">{title}</h1>
      <p className="mt-2 max-w-md text-sm leading-relaxed text-ink-500">{description}</p>
      <div className="mt-6 flex flex-wrap justify-center gap-2">
        <Link to="/app" className={buttonClasses('primary', 'md')}>
          Back to dashboard
        </Link>
        {showApplicationLink ? (
          <Link to="/app/hospital/application" className={buttonClasses('secondary', 'md')}>
            Hospital verification
          </Link>
        ) : null}
      </div>
    </div>
  );
}
