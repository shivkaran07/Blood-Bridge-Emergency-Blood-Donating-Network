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
        <linearGradient id="bb-mark-shine" x1="10" y1="6" x2="28" y2="22" gradientUnits="userSpaceOnUse">
          <stop stopColor="#fff" stopOpacity="0.3" />
          <stop offset="1" stopColor="#fff" stopOpacity="0" />
        </linearGradient>
      </defs>
      <rect width="40" height="40" rx="12" fill="url(#bb-mark-face)" />
      <path
        d="M20 8.5c4.55 5.4 7.35 9.05 7.35 12.55a7.35 7.35 0 0 1-14.7 0c0-3.5 2.8-7.15 7.35-12.55Z"
        fill="#fff"
      />
      <path
        d="M12.2 25.3c2.35-2.2 5-3.3 7.8-3.3s5.45 1.1 7.8 3.3"
        stroke="url(#bb-mark-face)"
        strokeWidth="2.1"
        strokeLinecap="round"
        fill="none"
      />
      <path
        d="M14.9 22.6v4.4M25.1 22.6v4.4"
        stroke="url(#bb-mark-face)"
        strokeWidth="1.7"
        strokeLinecap="round"
      />
      <path d="M20 15.4v5.2M17.4 18h5.2" stroke="#B91C3B" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M8 12c4-4.6 9.5-7 16-6.4" stroke="url(#bb-mark-shine)" strokeWidth="2" strokeLinecap="round" fill="none" />
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
