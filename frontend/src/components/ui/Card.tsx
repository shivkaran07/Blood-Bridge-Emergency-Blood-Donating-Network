import type { HTMLAttributes, ReactNode } from 'react';
import { cn } from '../../lib/cn';

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  padded?: boolean;
}

export function Card({ className, padded = true, children, ...props }: CardProps) {
  return (
    <div
      className={cn(
        'rounded-2xl border border-ink-200/80 bg-white shadow-card',
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
}

export function SectionCard({
  title,
  description,
  actions,
  children,
  className,
  bodyClassName,
  id,
}: SectionCardProps) {
  return (
    <section
      id={id}
      className={cn('overflow-hidden rounded-2xl border border-ink-200/80 bg-white shadow-card', className)}
    >
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-ink-100 px-5 py-4 sm:px-6">
        <div className="min-w-0">
          <h2 className="text-base font-semibold text-ink-900">{title}</h2>
          {description ? (
            <p className="mt-1 max-w-2xl text-sm leading-relaxed text-ink-500">{description}</p>
          ) : null}
        </div>
        {actions ? <div className="flex shrink-0 items-center gap-2">{actions}</div> : null}
      </div>
      <div className={cn('px-5 py-5 sm:px-6', bodyClassName)}>{children}</div>
    </section>
  );
}
