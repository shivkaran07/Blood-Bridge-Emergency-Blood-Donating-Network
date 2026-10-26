import { useEffect, useState } from 'react';
import { Link, Outlet, useLocation } from 'react-router-dom';
import { Menu, X } from 'lucide-react';
import { Logo } from './Logo';
import { useAuth } from '../../context/AuthContext';
import { buttonClasses } from '../ui/Button';
import { part1Notice } from '../../lib/constants';

const publicTitles: Record<string, string> = {
  '/': 'Emergency blood donation network',
  '/how-it-works': 'How it works',
  '/about': 'About the project',
  '/faq': 'Frequently asked questions',
  '/login': 'Sign in',
  '/register': 'Create account',
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
    <div className="flex min-h-dvh flex-col bg-surface">
      <div className="bg-ink-950 px-4 py-1.5 text-center text-[0.7rem] font-medium text-ink-200 sm:text-xs">
        <span className="mr-2 inline-block rounded bg-white/10 px-1.5 py-0.5 text-[0.65rem] font-semibold uppercase tracking-wide text-white">
          Part 1
        </span>
        {part1Notice}
      </div>

      <header className="sticky top-0 z-40 border-b border-ink-200/70 bg-surface/90 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
          <Logo />
          <nav className="hidden items-center gap-1 md:flex" aria-label="Public navigation">
            <Link
              to="/how-it-works"
              className="rounded-lg px-3 py-2 text-sm font-medium text-ink-600 transition hover:bg-white hover:text-ink-900"
            >
              How it works
            </Link>
            <Link
              to="/about"
              className="rounded-lg px-3 py-2 text-sm font-medium text-ink-600 transition hover:bg-white hover:text-ink-900"
            >
              About
            </Link>
            <Link
              to="/faq"
              className="rounded-lg px-3 py-2 text-sm font-medium text-ink-600 transition hover:bg-white hover:text-ink-900"
            >
              FAQ
            </Link>
            <a
              href="/#trust"
              className="rounded-lg px-3 py-2 text-sm font-medium text-ink-600 transition hover:bg-white hover:text-ink-900"
            >
              Trust &amp; safety
            </a>
          </nav>
          <div className="hidden items-center gap-2 md:flex">
            {signedIn ? (
              <Link to="/app" className={buttonClasses('primary', 'sm')}>
                Open workspace
              </Link>
            ) : (
              <>
                <Link to="/login" className={buttonClasses('ghost', 'sm')}>
                  Sign in
                </Link>
                <Link to="/register" className={buttonClasses('primary', 'sm')}>
                  Create account
                </Link>
              </>
            )}
          </div>
          <button
            type="button"
            onClick={() => setOpen((value) => !value)}
            className="rounded-lg p-2 text-ink-600 hover:bg-white md:hidden"
            aria-label={open ? 'Close menu' : 'Open menu'}
            aria-expanded={open}
          >
            {open ? <X className="size-5" /> : <Menu className="size-5" />}
          </button>
        </div>
        {open ? (
          <div className="border-t border-ink-200 bg-white px-4 py-3 md:hidden">
            <nav className="flex flex-col gap-1" aria-label="Mobile public navigation">
              <Link to="/how-it-works" className="rounded-lg px-3 py-2 text-sm text-ink-700 hover:bg-ink-50">
                How it works
              </Link>
              <Link to="/about" className="rounded-lg px-3 py-2 text-sm text-ink-700 hover:bg-ink-50">
                About
              </Link>
              <Link to="/faq" className="rounded-lg px-3 py-2 text-sm text-ink-700 hover:bg-ink-50">
                FAQ
              </Link>
              <a href="/#roles" className="rounded-lg px-3 py-2 text-sm text-ink-700 hover:bg-ink-50">
                For every role
              </a>
              <a href="/#trust" className="rounded-lg px-3 py-2 text-sm text-ink-700 hover:bg-ink-50">
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
                    <Link to="/register" className={buttonClasses('primary', 'sm', 'flex-1')}>
                      Create account
                    </Link>
                  </>
                )}
              </div>
            </nav>
          </div>
        ) : null}
      </header>

      <main className="flex-1">
        <Outlet />
      </main>

      <footer className="border-t border-ink-200 bg-white">
        <div className="mx-auto grid max-w-6xl gap-8 px-4 py-10 sm:px-6 md:grid-cols-[1.4fr_1fr_1fr]">
          <div>
            <Logo />
            <p className="mt-3 max-w-sm text-sm leading-relaxed text-ink-500">
              A coordination network for emergency blood requests, donor offers and
              database-backed hospital verification. Built as Part 1 of a blockchain
              verification roadmap.
            </p>
            <p className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs leading-relaxed text-amber-900">
              Not an emergency service. Call your local emergency number for immediate danger.
            </p>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-ink-400">Product</p>
            <ul className="mt-3 space-y-2 text-sm text-ink-600">
              <li><Link className="hover:text-ink-900" to="/how-it-works">How it works</Link></li>
              <li><Link className="hover:text-ink-900" to="/about">About</Link></li>
              <li><Link className="hover:text-ink-900" to="/faq">FAQ</Link></li>
              <li><a className="hover:text-ink-900" href="/#trust">Trust &amp; safety</a></li>
            </ul>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-ink-400">Account &amp; legal</p>
            <ul className="mt-3 space-y-2 text-sm text-ink-600">
              <li><Link className="hover:text-ink-900" to="/login">Sign in</Link></li>
              <li><Link className="hover:text-ink-900" to="/register">Create account</Link></li>
              <li><Link className="hover:text-ink-900" to="/privacy">Privacy notice</Link></li>
              <li><Link className="hover:text-ink-900" to="/terms">Terms of use</Link></li>
            </ul>
          </div>
        </div>
        <div className="border-t border-ink-100 px-4 py-4">
          <p className="mx-auto max-w-6xl text-xs text-ink-400">
            © {new Date().getFullYear()} BloodBridge. Part 1: database verification only — no
            smart contract is deployed and no on-chain transaction is created.
          </p>
        </div>
      </footer>
    </div>
  );
}
