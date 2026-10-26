import type { ReactNode } from 'react';
import { AlertTriangle, Loader2, RefreshCw, SearchX } from 'lucide-react';
import { Button } from './Button';
import { cn } from '../../lib/cn';

export function Spinner({ className }: { className?: string }) {
  return <Loader2 className={cn('size-5 animate-spin text-brand-700', className)} aria-hidden="true" />;
}

export function LoadingState({
  label = 'Loading…',
  className,
}: {
  label?: string;
  className?: string;
}) {
  return (
    <div
      className={cn('flex flex-col items-center justify-center gap-3 px-6 py-16 text-center', className)}
      role="status"
    >
      <Spinner className="size-6" />
      <p className="text-sm font-medium text-ink-500">{label}</p>
    </div>
  );
}

export function PageLoader({ label = 'Preparing your workspace…' }: { label?: string }) {
  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <LoadingState label={label} />
    </div>
  );
}

export function ErrorState({
  title = 'We could not load this page',
  message,
  onRetry,
  className,
}: {
  title?: string;
  message: string;
  onRetry?: () => void;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center rounded-2xl border border-brand-200 bg-brand-50/60 px-6 py-12 text-center',
        className,
      )}
      role="alert"
    >
      <span className="mb-4 flex size-12 items-center justify-center rounded-full bg-white text-brand-700 shadow-sm">
        <AlertTriangle className="size-6" aria-hidden="true" />
      </span>
      <h2 className="text-base font-semibold text-ink-900">{title}</h2>
      <p className="mt-1.5 max-w-md text-sm leading-relaxed text-ink-600">{message}</p>
      {onRetry ? (
        <Button
          variant="secondary"
          size="sm"
          className="mt-5"
          onClick={onRetry}
          leftIcon={<RefreshCw className="size-4" />}
        >
          Try again
        </Button>
      ) : null}
    </div>
  );
}

export function EmptyState({
  icon,
  title,
  description,
  action,
  className,
}: {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center rounded-xl border border-dashed border-ink-300 bg-ink-50/60 px-6 py-12 text-center',
        className,
      )}
    >
      <span className="mb-4 flex size-12 items-center justify-center rounded-full bg-white text-ink-400 shadow-sm">
        {icon ?? <SearchX className="size-6" aria-hidden="true" />}
      </span>
      <h3 className="text-sm font-semibold text-ink-900">{title}</h3>
      {description ? (
        <p className="mt-1.5 max-w-sm text-sm leading-relaxed text-ink-500">{description}</p>
      ) : null}
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  );
}
