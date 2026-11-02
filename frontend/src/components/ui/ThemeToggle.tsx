import { Moon, Sun } from 'lucide-react';
import { useTheme } from '../../context/ThemeContext';
import { cn } from '../../lib/cn';

/**
 * Compact light/dark switch for headers. It sets an explicit preference, so a
 * user on `system` gets a predictable result instead of a no-op toggle.
 */
export function ThemeToggle({ className }: { className?: string }) {
  const { theme, resolvedTheme, toggleTheme } = useTheme();
  const nextTheme = resolvedTheme === 'dark' ? 'light' : 'dark';
  const label =
    theme === 'system'
      ? `Theme: system (${resolvedTheme}). Switch to ${nextTheme} mode`
      : `Theme: ${theme}. Switch to ${nextTheme} mode`;

  return (
    <button
      type="button"
      onClick={toggleTheme}
      className={cn(
        'group relative flex size-11 shrink-0 items-center justify-center overflow-hidden rounded-lg text-ink-500 transition hover:bg-ink-100 hover:text-ink-900',
        className,
      )}
      aria-label={`Switch to ${nextTheme} mode`}
      title={label}
    >
      <Sun
        className={cn(
          'size-5 transition-all duration-300 ease-out',
          resolvedTheme === 'dark'
            ? 'rotate-0 scale-100 opacity-100'
            : 'absolute rotate-90 scale-50 opacity-0',
        )}
        aria-hidden="true"
      />
      <Moon
        className={cn(
          'size-5 transition-all duration-300 ease-out',
          resolvedTheme === 'dark'
            ? 'absolute -rotate-90 scale-50 opacity-0'
            : 'rotate-0 scale-100 opacity-100',
        )}
        aria-hidden="true"
      />
    </button>
  );
}
