import type { HTMLAttributes, ReactNode } from 'react';
import { cn } from '../../lib/cn';

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  padded?: boolean;
}

export function Card({ className, padded = true, children, ...props }: CardProps) {
  return (
    <div
      className={cn(
        'rounded-2xl border border-ink-200/90 bg-surface-raised shadow-card',
        padded && 'p-5 sm:p-6',
        className,
      )}
      {...props}
    >
      {children}
    </div>
  );
}

export interface SectionCardProps {
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
  bodyClassName?: string;
  id?: string;
  /** Removes the dividing header rule for open, editorial sections. */
  flushHeader?: boolean;
}

export function SectionCard({
  title,
  description,
  actions,
  children,
  className,
  bodyClassName,
  id,
  flushHeader = false,
}: SectionCardProps) {
  return (
    <section
      id={id}
      className={cn(
        'overflow-hidden rounded-2xl border border-ink-200/90 bg-surface-raised shadow-card',
        className,
      )}
    >
      <div
        className={cn(
          'flex flex-wrap items-start justify-between gap-3 bg-gradient-to-r from-surface-raised via-surface-raised to-brand-50/35 px-5 pt-5 sm:px-6',
          flushHeader ? 'pb-3' : 'border-b border-ink-100 pb-4',
        )}
      >
        <div className="min-w-0 flex-1">
          <h2 className="type-title text-[1.0625rem] text-ink-900">{title}</h2>
          {description ? (
            <p className="mt-1.5 max-w-2xl text-[0.8125rem] leading-relaxed text-ink-500">
              {description}
            </p>
          ) : null}
        </div>
        {actions ? <div className="flex shrink-0 items-center gap-2">{actions}</div> : null}
      </div>
      <div className={cn('px-5 py-5 sm:px-6', bodyClassName)}>{children}</div>
    </section>
  );
}

/**
 * Open section: a heading and content separated by a rule rather than a card.
 * Used to avoid stacking every dashboard block inside its own container.
 */
export function SectionBlock({
  title,
  description,
  actions,
  children,
  className,
  id,
}: Omit<SectionCardProps, 'bodyClassName' | 'flushHeader'>) {
  return (
    <section id={id} className={cn('min-w-0', className)}>
      <div className="flex flex-wrap items-end justify-between gap-3 border-b border-ink-200 pb-3">
        <div className="min-w-0 flex-1">
          <h2 className="type-title text-[1.0625rem] text-ink-900">{title}</h2>
          {description ? (
            <p className="mt-1 max-w-2xl text-[0.8125rem] leading-relaxed text-ink-500">
              {description}
            </p>
          ) : null}
        </div>
        {actions ? <div className="flex shrink-0 items-center gap-2">{actions}</div> : null}
      </div>
      <div className="pt-4">{children}</div>
    </section>
  );
}
