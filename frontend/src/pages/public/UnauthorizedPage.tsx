import { Link } from 'react-router-dom';
import { ArrowLeft, LockKeyhole, ShieldAlert } from 'lucide-react';
import { Card } from '../../components/ui/Card';
import { Alert } from '../../components/ui/Alert';
import { buttonClasses } from '../../components/ui/Button';
import { useAuth } from '../../context/AuthContext';

export function UnauthorizedPage() {
  const { status, me } = useAuth();
  const signedIn = status === 'authenticated' && Boolean(me);

  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-14 sm:px-6 lg:py-20">
      <Card className="p-6 sm:p-8">
        <span className="flex size-14 items-center justify-center rounded-xl bg-brand-50 text-brand-accent">
          <LockKeyhole className="size-7" aria-hidden="true" />
        </span>
        <p className="mt-5 text-xs font-semibold uppercase tracking-[0.16em] text-brand-accent">
          Access denied
        </p>
        <h1 className="mt-1.5 text-2xl font-semibold tracking-tight text-ink-900">
          You do not have permission for that area
        </h1>
        <p className="mt-2 text-sm leading-relaxed text-ink-600">
          This page requires a role or approval that your account does not currently have. Hiding a
          navigation item is not the security boundary — the API also rejects unauthorized actions.
        </p>

        {signedIn ? (
          <Alert variant="neutral" title="Signed in as" className="mt-5">
            {me?.user.email}
            {me?.hospitalProfile?.verificationStatus === 'PENDING'
              ? ' — your hospital application is pending administrator review.'
              : null}
          </Alert>
        ) : (
          <Alert variant="info" title="Sign in required" className="mt-5">
            Sign in with an account that has the required permissions. Public registration cannot
            grant administrator or approved-hospital access.
          </Alert>
        )}

        <div className="mt-6 flex flex-wrap gap-2">
          <Link to={signedIn ? '/app' : '/login'} className={buttonClasses('primary', 'md')}>
            {signedIn ? 'Back to dashboard' : 'Sign in'}
          </Link>
          <Link to="/" className={buttonClasses('secondary', 'md')}>
            <ArrowLeft className="size-4" aria-hidden="true" />
            Public home
          </Link>
          {signedIn && !me?.permissions.isApprovedVerifier ? (
            <Link to="/app/hospital/application" className={buttonClasses('ghost', 'md')}>
              <ShieldAlert className="size-4" aria-hidden="true" />
              Hospital verification
            </Link>
          ) : null}
        </div>

        <p className="mt-6 text-xs leading-relaxed text-ink-500">
          If you believe this is a mistake, contact the platform operator. Administrator access is
          provisioned through a documented script, and hospital access is granted only after
          administrator approval of an institutional application.
        </p>
      </Card>
    </div>
  );
}
