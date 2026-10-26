import { Link, useLocation } from 'react-router-dom';
import { ArrowLeft, Compass, LayoutDashboard, LifeBuoy } from 'lucide-react';
import { Card } from '../../components/ui/Card';
import { buttonClasses } from '../../components/ui/Button';
import { useAuth } from '../../context/AuthContext';

export function NotFoundPage() {
  const { status } = useAuth();
  const location = useLocation();
  const signedIn = status === 'authenticated';

  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-14 sm:px-6 lg:py-20">
      <Card className="p-6 sm:p-8">
        <span className="flex size-14 items-center justify-center rounded-2xl bg-ink-100 text-ink-500">
          <Compass className="size-7" aria-hidden="true" />
        </span>
        <p className="mt-5 text-xs font-semibold uppercase tracking-[0.16em] text-brand-700">
          404 · Not found
        </p>
        <h1 className="mt-1.5 text-2xl font-semibold tracking-tight text-ink-900">
          This page does not exist
        </h1>
        <p className="mt-2 text-sm leading-relaxed text-ink-600">
          The address <code className="break-all rounded bg-ink-100 px-1.5 py-0.5 text-xs">{location.pathname}</code>{' '}
          did not match any BloodBridge page. A link may be out of date, or the record may have been
          removed.
        </p>

        <div className="mt-6 flex flex-wrap gap-2">
          {signedIn ? (
            <Link to="/app" className={buttonClasses('primary', 'md')}>
              <LayoutDashboard className="size-4" aria-hidden="true" />
              Open dashboard
            </Link>
          ) : (
            <Link to="/login" className={buttonClasses('primary', 'md')}>
              Sign in
            </Link>
          )}
          <Link to="/" className={buttonClasses('secondary', 'md')}>
            <ArrowLeft className="size-4" aria-hidden="true" />
            Public home
          </Link>
          <Link to="/faq" className={buttonClasses('ghost', 'md')}>
            <LifeBuoy className="size-4" aria-hidden="true" />
            FAQ
          </Link>
        </div>
      </Card>
    </div>
  );
}
