import { Link } from 'react-router-dom';
import { cn } from '../../lib/cn';

/**
 * BloodBridge mark: a droplet carrying a bridge span. The two ideas are the
 * product: a blood network and the connection between people around it.
 */
export function BrandMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 40 40"
      className={cn('size-full', className)}
      aria-hidden="true"
      focusable="false"
    >
      <defs>
        <linearGradient id="bb-mark-face" x1="6" y1="4" x2="34" y2="36" gradientUnits="userSpaceOnUse">
          <stop stopColor="#DC2650" />
          <stop offset="0.52" stopColor="#B91C3B" />
          <stop offset="1" stopColor="#831B32" />
        </linearGradient>
      </defs>
      <rect width="40" height="40" rx="12" fill="url(#bb-mark-face)" />
      <path
        d="M20 7.5c4.2 5.2 9 10.8 9 15.8a9 9 0 1 1-18 0c0-5 4.8-10.6 9-15.8Z"
        fill="#fff"
      />
      <path
        d="M12.8 22h14.4"
        stroke="url(#bb-mark-face)"
        strokeWidth="2.3"
        strokeLinecap="round"
      />
      <path
        d="M15.2 22.2v3.3M24.8 22.2v3.3"
        stroke="url(#bb-mark-face)"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
      <path
        d="M15.2 25.5c1.3 2.9 2.9 4.4 4.8 4.4s3.5-1.5 4.8-4.4"
        stroke="url(#bb-mark-face)"
        strokeWidth="2"
        strokeLinecap="round"
        fill="none"
      />
    </svg>
  );
}

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
      className={cn(
        'group inline-flex min-h-11 items-center gap-2.5 rounded-xl outline-none transition-opacity hover:opacity-95',
        className,
      )}
      aria-label={compact ? 'BloodBridge home' : undefined}
    >
      <span
        className={cn(
          'relative flex size-11 shrink-0 items-center justify-center overflow-hidden rounded-[0.9rem] shadow-[0_8px_20px_-10px_rgb(135_29_61/0.8)] ring-1 transition-transform duration-300 group-hover:-translate-y-0.5 group-hover:rotate-[-3deg]',
          invert ? 'bg-surface-raised ring-white/30' : 'bg-surface-raised ring-brand-200/80',
        )}
      >
        <BrandMark />
      </span>
      {!compact ? (
        <span className="flex min-w-[7.5rem] flex-col leading-none">
          <span
            className={cn(
              'truncate text-[1.0625rem] font-bold tracking-[-0.025em]',
              invert ? 'text-white' : 'text-ink-900',
            )}
          >
            BloodBridge
          </span>
          <span
            className={cn(
              'mt-1 flex min-w-0 flex-col gap-0.5 text-[0.5rem] font-bold uppercase leading-[1.05] tracking-[0.09em]',
              invert ? 'text-white/75' : 'text-ink-500',
            )}
          >
            <span className={cn(invert ? 'text-brand-200' : 'text-brand-accent')}>
              Blood donation
            </span>
            <span className="whitespace-nowrap">coordination network</span>
          </span>
        </span>
      ) : null}
    </Link>
  );
}
