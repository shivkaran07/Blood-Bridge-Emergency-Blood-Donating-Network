import type { ReactNode } from 'react';
import { cn } from '../../lib/cn';

export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
  meta,
  className,
}: {
  eyebrow?: string;
  title: string;
  description?: ReactNode;
  actions?: ReactNode;
  meta?: ReactNode;
  className?: string;
}) {
  return (
    <header
      className={cn(
        'relative flex flex-col gap-5 border-b border-ink-200/80 pb-6 sm:flex-row sm:items-end sm:justify-between sm:gap-8',
        className,
      )}
    >
      <div className="min-w-0 max-w-2xl">
        {eyebrow ? (
          <p className="mb-3 flex items-center gap-2.5 type-eyebrow">
            <span className="h-1 w-7 rounded-full bg-gradient-to-r from-brand-500 to-brand-800" aria-hidden="true" />
            {eyebrow}
          </p>
        ) : null}
        <h1 className="type-title text-[1.85rem] text-ink-950 sm:text-[2.25rem]">{title}</h1>
        {description ? (
          <p className="mt-2.5 text-sm leading-relaxed text-ink-500 sm:text-[0.9375rem]">
            {description}
          </p>
        ) : null}
        {meta ? <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2">{meta}</div> : null}
      </div>
      {actions ? (
        <div className="flex flex-wrap items-center gap-2 sm:shrink-0 sm:justify-end">{actions}</div>
      ) : null}
    </header>
  );
}
