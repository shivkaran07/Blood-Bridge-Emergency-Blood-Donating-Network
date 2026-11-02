import { useEffect, useRef, useState } from 'react';
import { Check, Copy } from 'lucide-react';
import { cn } from '../../lib/cn';

export interface CopyButtonProps {
  value: string;
  label?: string;
  copiedLabel?: string;
  /** Show the label next to the icon. Icon-only by default for dense tables. */
  showLabel?: boolean;
  className?: string;
}

/**
 * Copies a value to the clipboard and confirms the result in place. It never
 * claims success when the Clipboard API is unavailable or rejects.
 */
export function CopyButton({
  value,
  label = 'Copy',
  copiedLabel = 'Copied',
  showLabel = false,
  className,
}: CopyButtonProps) {
  const [copied, setCopied] = useState(false);
  const [failed, setFailed] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  const copy = async () => {
    if (timer.current) clearTimeout(timer.current);
    try {
      if (!navigator.clipboard?.writeText) throw new Error('Clipboard unavailable');
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setFailed(false);
    } catch {
      setCopied(false);
      setFailed(true);
    }
    timer.current = setTimeout(() => {
      setCopied(false);
      setFailed(false);
    }, 1800);
  };

  return (
    <button
      type="button"
      onClick={() => void copy()}
      className={cn(
        'inline-flex h-11 min-h-11 min-w-11 items-center justify-center gap-1.5 rounded-lg px-2 text-xs font-semibold text-ink-500 transition hover:bg-ink-100 hover:text-ink-900',
        showLabel && 'px-3',
        className,
      )}
      aria-label={copied ? copiedLabel : failed ? 'Copy failed' : label}
      title={copied ? copiedLabel : failed ? 'Copy failed' : label}
    >
      {copied ? (
        <Check className="size-4 text-accent-600" aria-hidden="true" />
      ) : (
        <Copy className={cn('size-4', failed && 'text-brand-accent')} aria-hidden="true" />
      )}
      {showLabel ? <span>{copied ? copiedLabel : failed ? 'Copy failed' : label}</span> : null}
      <span className="sr-only" aria-live="polite">
        {copied ? copiedLabel : ''}
      </span>
    </button>
  );
}
