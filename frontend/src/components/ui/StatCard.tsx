import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { ArrowUpRight } from 'lucide-react';
import { cn } from '../../lib/cn';

const toneAccent = {
  neutral: 'text-ink-500',
  brand: 'text-brand-accent',
  success: 'text-accent-700',
  warning: 'text-amber-700',
} as const;

const toneIconSurface = {
  neutral: 'bg-ink-100 text-ink-600 ring-ink-200/70',
  brand: 'bg-brand-50 text-brand-accent ring-brand-200/70',
  success: 'bg-accent-50 text-accent-700 ring-accent-200/70',
  warning: 'bg-amber-50 text-amber-700 ring-amber-200/70',
} as const;

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
  return (
    <div
      className={cn(
        'stat-card group relative flex min-w-0 flex-col justify-between gap-4 overflow-hidden rounded-2xl border border-ink-200/90 bg-surface-raised p-4 shadow-card transition-[border-color,box-shadow,transform] duration-200 hover:-translate-y-0.5 hover:border-ink-300 hover:shadow-lift sm:p-5',
        className,
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <p className="text-[0.75rem] font-semibold leading-snug text-ink-500">{label}</p>
        {icon ? (
          <span
            className={cn(
              'flex size-9 shrink-0 items-center justify-center rounded-xl ring-1 ring-inset [&>svg]:size-4',
              toneIconSurface[tone],
            )}
            aria-hidden="true"
          >
            {icon}
          </span>
        ) : null}
      </div>
      <div className="min-w-0">
        <p className="type-metric text-[1.875rem] text-ink-900 sm:text-[2.125rem]">{value}</p>
        {hint ? (
          <p className="mt-2 text-[0.75rem] leading-relaxed text-ink-500">{hint}</p>
        ) : null}
      </div>
    </div>
  );
}

/**
 * A single joined metric strip. Avoids four disconnected cards while keeping
 * each value scannable and labelled.
 */
export function MetricStrip({
  items,
  className,
}: {
  items: Array<{
    label: string;
    value: ReactNode;
    hint?: ReactNode;
    icon?: ReactNode;
    tone?: 'neutral' | 'brand' | 'success' | 'warning';
    href?: string;
  }>;
  className?: string;
}) {
  return (
    <dl
      className={cn(
        'grid grid-cols-2 overflow-hidden rounded-xl border border-ink-200/90 bg-surface-raised shadow-card lg:grid-cols-4',
        className,
      )}
    >
      {items.map((item, index) => {
        const content = (
          <>
            <dt className="flex items-center justify-between gap-1.5 text-[0.7rem] font-semibold leading-snug text-ink-500">
              <span className="flex min-w-0 items-center gap-1.5">
                {item.icon ? (
                  <span className={cn('[&>svg]:size-3.5 shrink-0', toneAccent[item.tone ?? 'neutral'])} aria-hidden="true">
                    {item.icon}
                  </span>
                ) : null}
                <span className="truncate">{item.label}</span>
              </span>
              {item.href ? (
                <ArrowUpRight className="size-3 text-ink-400 opacity-0 transition-opacity group-hover:opacity-100" aria-hidden="true" />
              ) : null}
            </dt>
            <dd className="mt-2.5">
              <span className="type-metric text-[1.85rem] text-ink-900 tracking-tight sm:text-[2rem]">{item.value}</span>
              {item.hint ? (
                <span className="mt-1.5 block text-[0.7rem] leading-relaxed text-ink-500">
                  {item.hint}
                </span>
              ) : null}
            </dd>
          </>
        );

        const containerClasses = cn(
          'group relative min-w-0 border-ink-200/80 p-4 transition-[background-color,box-shadow] duration-200 sm:p-5',
          item.href && 'hover:bg-brand-50/35 focus-visible:z-10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-500',
          index % 2 === 1 && 'border-l',
          index >= 2 && 'border-t lg:border-t-0',
          index === 2 && 'lg:border-l',
          index === 3 && 'lg:border-l',
        );

        return item.href ? (
          <Link key={item.label} to={item.href} className={containerClasses}>
            {content}
          </Link>
        ) : (
          <div key={item.label} className={containerClasses}>
            {content}
          </div>
        );
      })}
    </dl>
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
        'inline-flex shrink-0 items-center justify-center rounded-full bg-brand-100 font-semibold text-brand-accent ring-1 ring-brand-200/60',
        sizeClass,
        className,
      )}
      aria-hidden="true"
    >
      {initials || '?'}
    </span>
  );
}
