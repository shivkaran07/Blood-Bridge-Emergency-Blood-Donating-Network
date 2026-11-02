import type { ReactNode, ThHTMLAttributes, TdHTMLAttributes } from 'react';
import { cn } from '../../lib/cn';

export function Table({ children, minWidth = 720 }: { children: ReactNode; minWidth?: number }) {
  return (
    <div className="scrollbar-thin -mx-1 overflow-x-auto px-1">
      <table className="w-full border-collapse text-left text-sm" style={{ minWidth }}>
        {children}
      </table>
    </div>
  );
}

export function THead({ children }: { children: ReactNode }) {
  return (
    <thead>
      <tr className="border-b border-ink-200 bg-ink-50/60">{children}</tr>
    </thead>
  );
}

export function TBody({ children }: { children: ReactNode }) {
  return <tbody className="divide-y divide-ink-100">{children}</tbody>;
}

export function Tr({ children, className }: { children: ReactNode; className?: string }) {
  return <tr className={cn('data-row', className)}>{children}</tr>;
}

export function Th({ children, className, ...props }: ThHTMLAttributes<HTMLTableCellElement>) {
  return (
    <th
      scope="col"
      className={cn(
        'whitespace-nowrap px-3 py-2.5 text-[0.6875rem] font-semibold uppercase tracking-[0.08em] text-ink-500',
        className,
      )}
      {...props}
    >
      {children}
    </th>
  );
}

export function Td({ children, className, ...props }: TdHTMLAttributes<HTMLTableCellElement>) {
  return (
    <td className={cn('px-3 py-3.5 align-middle text-[0.8125rem] text-ink-700', className)} {...props}>
      {children}
    </td>
  );
}

export function FilterChips<T extends string>({
  options,
  value,
  onChange,
  label,
}: {
  options: Array<{ value: T; label: string; count?: number }>;
  value: T;
  onChange: (value: T) => void;
  label?: string;
}) {
  return (
    <div className="scrollbar-thin -mx-1 overflow-x-auto px-1 pb-1 sm:overflow-visible sm:pb-0">
      <div
        className="flex w-max items-center gap-1.5 sm:w-auto sm:flex-wrap"
        role="group"
        aria-label={label}
      >
        {options.map((option) => {
          const selected = option.value === value;
          return (
            <button
              key={option.value}
              type="button"
              onClick={() => onChange(option.value)}
              aria-pressed={selected}
              className={cn(
                'inline-flex min-h-11 shrink-0 items-center rounded-full border px-3.5 py-1.5 text-xs font-semibold transition',
                selected
                  ? 'border-brand-700 bg-brand-700 text-white shadow-sm'
                  : 'border-ink-200 bg-surface-raised text-ink-600 hover:border-ink-300 hover:text-ink-900',
              )}
            >
              {option.label}
              {typeof option.count === 'number' ? (
                <span
                  className={cn(
                    'ml-1.5 rounded-full px-1.5 py-px text-[0.65rem]',
                    selected ? 'bg-white/20 text-white' : 'bg-ink-100 text-ink-600',
                  )}
                >
                  {option.count}
                </span>
              ) : null}
            </button>
          );
        })}
      </div>
    </div>
  );
}
