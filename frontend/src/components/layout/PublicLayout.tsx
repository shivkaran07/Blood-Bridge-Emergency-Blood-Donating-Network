import { useEffect, useState } from 'react';
import { Link, Outlet, useLocation } from 'react-router-dom';
import { Menu, X } from 'lucide-react';
import { Logo } from './Logo';
import { useAuth } from '../../context/AuthContext';
import { buttonClasses } from '../ui/Button';
import { ThemeToggle } from '../ui/ThemeToggle';

const publicTitles: Record<string, string> = {
  '/': 'Blood donation coordination network',
  '/how-it-works': 'How it works',
  '/about': 'About the project',
  '/faq': 'Frequently asked questions',
  '/login': 'Sign in',
  '/register': 'Create account',
  '/forgot-password': 'Reset your password',
  '/reset-password': 'Set a new password',
  '/privacy': 'Privacy notice',
  '/terms': 'Terms of use',
  '/unauthorized': 'Access denied',
};

function pageTitle(pathname: string): string {
  return publicTitles[pathname] ?? 'Page not found';
}

export function PublicLayout() {
  const { status } = useAuth();
  const location = useLocation();
  const [open, setOpen] = useState(false);
  const signedIn = status === 'authenticated';

  useEffect(() => {
    setOpen(false);
    window.scrollTo(0, 0);
    document.title = `${pageTitle(location.pathname)} · BloodBridge`;
  }, [location.pathname]);

  return (
    <div className="public-shell flex min-h-dvh flex-col">
      <header className="sticky top-0 z-40 border-b border-ink-200/70 bg-surface/85 shadow-[0_1px_0_rgb(255_255_255/0.18)] backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
          <Logo />
          <nav className="hidden items-center gap-1 lg:flex" aria-label="Public navigation">
            <Link
              to="/"
              className="flex min-h-11 items-center rounded-lg px-3 py-2 text-sm font-medium text-ink-600 transition hover:bg-surface-raised hover:text-ink-900"
            >
              Home
            </Link>
            <Link
              to="/how-it-works"
              className="flex min-h-11 items-center rounded-lg px-3 py-2 text-sm font-medium text-ink-600 transition hover:bg-surface-raised hover:text-ink-900"
            >
              How it works
            </Link>
            <Link
              to="/about"
              className="flex min-h-11 items-center rounded-lg px-3 py-2 text-sm font-medium text-ink-600 transition hover:bg-surface-raised hover:text-ink-900"
            >
              About
            </Link>
            <Link
              to="/faq"
              className="flex min-h-11 items-center rounded-lg px-3 py-2 text-sm font-medium text-ink-600 transition hover:bg-surface-raised hover:text-ink-900"
            >
              FAQ
            </Link>
            <a
              href="/#trust"
              className="flex min-h-11 items-center rounded-lg px-3 py-2 text-sm font-medium text-ink-600 transition hover:bg-surface-raised hover:text-ink-900"
            >
              Trust &amp; safety
            </a>
          </nav>
          <div className="flex items-center gap-1 sm:gap-2">
            <ThemeToggle />
            <div className="hidden items-center gap-2 lg:flex">
              {signedIn ? (
                <Link to="/app" className={buttonClasses('primary', 'sm')}>
                  Open workspace
                </Link>
              ) : (
                <>
                  <Link to="/login" className={buttonClasses('ghost', 'sm')}>
                    Sign in
                  </Link>
                  <Link to="/register?type=DONOR" className={buttonClasses('secondary', 'sm')}>
                    Become a donor
                  </Link>
                  <Link to="/register?type=REQUESTER" className={buttonClasses('primary', 'sm')}>
                    Request blood
                  </Link>
                </>
              )}
            </div>
            <button
              type="button"
              onClick={() => setOpen((value) => !value)}
              className="flex size-11 items-center justify-center rounded-lg text-ink-600 hover:bg-ink-100 lg:hidden"
              aria-label={open ? 'Close menu' : 'Open menu'}
              aria-expanded={open}
            >
              {open ? <X className="size-5" /> : <Menu className="size-5" />}
            </button>
          </div>
        </div>
        {open ? (
          <div className="animate-fade-up border-t border-ink-200 bg-surface-raised/95 px-4 py-3 shadow-card backdrop-blur-xl lg:hidden">
            <nav className="flex flex-col gap-1" aria-label="Mobile public navigation">
              <Link to="/" className="flex min-h-11 items-center rounded-lg px-3 py-2.5 text-sm text-ink-700 hover:bg-ink-50">
                Home
              </Link>
              <Link to="/how-it-works" className="flex min-h-11 items-center rounded-lg px-3 py-2.5 text-sm text-ink-700 hover:bg-ink-50">
                How it works
              </Link>
              <Link to="/about" className="flex min-h-11 items-center rounded-lg px-3 py-2.5 text-sm text-ink-700 hover:bg-ink-50">
                About
              </Link>
              <Link to="/faq" className="flex min-h-11 items-center rounded-lg px-3 py-2.5 text-sm text-ink-700 hover:bg-ink-50">
                FAQ
              </Link>
              <a href="/#roles" className="flex min-h-11 items-center rounded-lg px-3 py-2.5 text-sm text-ink-700 hover:bg-ink-50">
                For every role
              </a>
              <a href="/#trust" className="flex min-h-11 items-center rounded-lg px-3 py-2.5 text-sm text-ink-700 hover:bg-ink-50">
                Trust &amp; safety
              </a>
              <div className="mt-2 flex gap-2 border-t border-ink-100 pt-3">
                {signedIn ? (
                  <Link to="/app" className={buttonClasses('primary', 'sm', 'flex-1')}>
                    Open workspace
                  </Link>
                ) : (
                  <>
                    <Link to="/login" className={buttonClasses('secondary', 'sm', 'flex-1')}>
                      Sign in
                    </Link>
                    <Link to="/register?type=REQUESTER" className={buttonClasses('primary', 'sm', 'flex-1')}>
                      Request blood
                    </Link>
                  </>
                )}
              </div>
            </nav>
          </div>
        ) : null}
      </header>

      <main key={location.pathname} className="flex-1 animate-route-enter">
        <Outlet />
      </main>

      <footer className="border-t border-ink-200 bg-surface-raised/90">
        <div className="mx-auto grid max-w-6xl gap-8 px-4 py-10 sm:px-6 md:grid-cols-[1.4fr_1fr_1fr]">
          <div>
            <Logo />
            <p className="mt-3 max-w-sm text-sm leading-relaxed text-ink-500">
              A coordination network for emergency blood requests, donor offers and
              hospital-reviewed verification. Every decision is recorded in the application audit
              trail; on-chain anchoring is optional and never a substitute for medical checks.
            </p>
            <p className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs leading-relaxed text-amber-900">
              Not an emergency service. Call your local emergency number for immediate danger.
            </p>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-ink-500">Product</p>
            <ul className="mt-3 space-y-2 text-sm text-ink-600">
              <li><Link className="hover:text-ink-900" to="/how-it-works">How it works</Link></li>
              <li><Link className="hover:text-ink-900" to="/about">About</Link></li>
              <li><Link className="hover:text-ink-900" to="/faq">FAQ</Link></li>
              <li><a className="hover:text-ink-900" href="/#trust">Trust &amp; safety</a></li>
            </ul>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-ink-500">Account &amp; legal</p>
            <ul className="mt-3 space-y-2 text-sm text-ink-600">
              <li><Link className="hover:text-ink-900" to="/login">Sign in</Link></li>
              <li><Link className="hover:text-ink-900" to="/register">Create account</Link></li>
              <li><Link className="hover:text-ink-900" to="/privacy">Privacy notice</Link></li>
              <li><Link className="hover:text-ink-900" to="/terms">Terms of use</Link></li>
            </ul>
          </div>
        </div>
        <div className="border-t border-ink-100 px-4 py-4">
          <p className="mx-auto max-w-6xl text-xs leading-relaxed text-ink-500">
            © {new Date().getFullYear()} BloodBridge. Hospital review is recorded in the
            application database. A configured on-chain anchor is an audit signal, not medical
            proof.
          </p>
        </div>
      </footer>
    </div>
  );
}
