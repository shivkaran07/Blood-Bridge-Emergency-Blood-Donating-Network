import type { ReactNode } from 'react';
import { cn } from '../../lib/cn';

export function StatCard({
  label,
  value,
  hint,
  icon,
  tone = 'neutral',
  className,
}: {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  icon?: ReactNode;
  tone?: 'neutral' | 'brand' | 'success' | 'warning';
  className?: string;
}) {
  const iconTone = {
    neutral: 'bg-ink-100 text-ink-600',
    brand: 'bg-brand-50 text-brand-700',
    success: 'bg-accent-50 text-accent-700',
    warning: 'bg-amber-50 text-amber-700',
  }[tone];

  return (
    <div
      className={cn(
        'rounded-2xl border border-ink-200/80 bg-white p-5 shadow-card',
        className,
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <p className="text-sm font-medium text-ink-500">{label}</p>
        {icon ? (
          <span className={cn('flex size-9 shrink-0 items-center justify-center rounded-lg', iconTone)}>
            {icon}
          </span>
        ) : null}
      </div>
      <p className="mt-2 text-3xl font-semibold tracking-tight text-ink-900">{value}</p>
      {hint ? <p className="mt-1 text-xs leading-relaxed text-ink-500">{hint}</p> : null}
    </div>
  );
}

export function Avatar({
  name,
  size = 'md',
  className,
}: {
  name: string;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}) {
  const initials = name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('');
  const sizeClass = {
    sm: 'size-8 text-xs',
    md: 'size-10 text-sm',
    lg: 'size-12 text-base',
  }[size];

  return (
    <span
      className={cn(
        'inline-flex shrink-0 items-center justify-center rounded-full bg-brand-100 font-semibold text-brand-800',
        sizeClass,
        className,
      )}
      aria-hidden="true"
    >
      {initials || '?'}
    </span>
  );
}
