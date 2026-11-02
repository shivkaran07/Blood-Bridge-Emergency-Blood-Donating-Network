import { Link } from 'react-router-dom';
import { ArrowLeft, Settings2, TerminalSquare } from 'lucide-react';
import { Card } from '../ui/Card';
import { Alert } from '../ui/Alert';
import { configProblems, env } from '../../lib/env';
import { Logo } from './Logo';

export function ConfigNotice() {
  return (
    <div className="flex min-h-dvh flex-col bg-surface">
      <header className="border-b border-ink-200 bg-surface-raised">
        <div className="mx-auto flex h-16 max-w-5xl items-center justify-between px-4 sm:px-6">
          <Logo />
          <Link
            to="/"
            className="inline-flex items-center gap-1.5 text-sm font-medium text-ink-600 hover:text-ink-900"
          >
            <ArrowLeft className="size-4" aria-hidden="true" />
            Back to home
          </Link>
        </div>
      </header>
      <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-12 sm:px-6">
        <Card className="p-6 sm:p-8">
          <span className="flex size-12 items-center justify-center rounded-xl bg-brand-50 text-brand-accent">
            <Settings2 className="size-6" aria-hidden="true" />
          </span>
          <h1 className="mt-5 text-xl font-semibold text-ink-900">Connect the frontend to Supabase</h1>
          <p className="mt-2 text-sm leading-relaxed text-ink-600">
            Sign-in and the authenticated workspace need a Supabase project URL and a public
            (publishable or anon) key. These values are safe to expose in the browser; the
            service-role key must stay on the backend.
          </p>

          <Alert variant="warning" className="mt-5" title="Configuration is incomplete">
            {configProblems.length > 0
              ? configProblems.join(' ')
              : 'Supabase environment values were not found at build time.'}
          </Alert>

          <div className="mt-6 rounded-xl border border-white/10 bg-inverse p-4 text-xs text-white/80">
            <div className="mb-2 flex items-center gap-2 text-ink-500">
              <TerminalSquare className="size-4" aria-hidden="true" />
              <span className="font-medium">frontend/.env</span>
            </div>
            <pre className="overflow-x-auto leading-relaxed">
              <code>{`VITE_SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-or-publishable-key
VITE_API_BASE_URL=${env.apiBaseUrl}`}</code>
            </pre>
          </div>

          <ol className="mt-6 space-y-2 text-sm leading-relaxed text-ink-600">
            <li>1. Copy <code className="rounded bg-ink-100 px-1.5 py-0.5 text-xs">frontend/.env.example</code> to <code className="rounded bg-ink-100 px-1.5 py-0.5 text-xs">frontend/.env</code>.</li>
            <li>2. Fill in the values from Supabase Dashboard → Project Settings → API.</li>
            <li>3. Restart the Vite dev server so the new environment values are loaded.</li>
          </ol>

          <p className="mt-6 text-xs leading-relaxed text-ink-500">
            Setup details and the complete checklist are in the repository README and
            <code className="mx-1 rounded bg-ink-100 px-1 py-0.5">docs/setup.md</code>.
          </p>
        </Card>
      </main>
    </div>
  );
}
