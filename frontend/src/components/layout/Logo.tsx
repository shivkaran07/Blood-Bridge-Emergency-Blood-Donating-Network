import { Link } from 'react-router-dom';
import { Droplet } from 'lucide-react';
import { cn } from '../../lib/cn';

export function Logo({
  to = '/',
  compact = false,
  invert = false,
  className,
}: {
  to?: string;
  compact?: boolean;
  invert?: boolean;
  className?: string;
}) {
  return (
    <Link
      to={to}
      className={cn('group inline-flex items-center gap-2.5 rounded-lg', className)}
      aria-label="BloodBridge home"
    >
      <span
        className={cn(
          'relative flex size-9 items-center justify-center rounded-xl shadow-sm transition group-hover:scale-[1.03]',
          invert ? 'bg-white text-brand-700' : 'bg-brand-700 text-white',
        )}
      >
        <Droplet className="size-5" fill="currentColor" aria-hidden="true" />
      </span>
      {!compact ? (
        <span className="flex flex-col leading-none">
          <span
            className={cn(
              'text-[1.05rem] font-bold tracking-tight',
              invert ? 'text-white' : 'text-ink-900',
            )}
          >
            BloodBridge
          </span>
          <span
            className={cn(
              'mt-1 text-[0.6rem] font-semibold uppercase tracking-[0.16em]',
              invert ? 'text-white/60' : 'text-ink-400',
            )}
          >
            Donor network
          </span>
        </span>
      ) : null}
    </Link>
  );
}
