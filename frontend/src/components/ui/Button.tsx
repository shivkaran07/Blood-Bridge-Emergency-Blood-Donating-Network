import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react';
import { Loader2 } from 'lucide-react';
import { cn } from '../../lib/cn';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'soft' | 'inverse';
export type ButtonSize = 'sm' | 'md' | 'lg' | 'icon';

const variantClasses: Record<ButtonVariant, string> = {
  primary:
    'border border-brand-800 bg-brand-700 text-white shadow-[inset_0_1px_0_rgb(255_255_255/0.12),0_1px_2px_rgb(64_4_15/0.24)] hover:border-brand-900 hover:bg-brand-800 active:bg-brand-900 disabled:border-brand-300 disabled:bg-brand-300 disabled:text-brand-950 dark:disabled:border-brand-900 dark:disabled:bg-brand-950 dark:disabled:text-brand-300',
  secondary:
    'border border-ink-200 bg-surface-raised text-ink-800 shadow-[0_1px_1px_rgb(29_26_23/0.03)] hover:border-ink-300 hover:bg-ink-50 active:bg-ink-100 disabled:text-ink-500',
  ghost:
    'border border-transparent text-ink-600 hover:bg-ink-100 hover:text-ink-900 active:bg-ink-200 disabled:text-ink-400',
  danger:
    'border border-brand-200 bg-brand-50 text-brand-accent hover:border-brand-300 hover:bg-brand-100 active:bg-brand-200 disabled:text-ink-400',
  soft:
    'border border-transparent bg-brand-50 text-brand-accent hover:bg-brand-100 active:bg-brand-200 disabled:text-ink-400',
  inverse:
    'border border-transparent bg-white text-brand-900 shadow-[0_1px_2px_rgb(0_0_0/0.16)] hover:bg-white/90 active:bg-white/80 disabled:text-brand-400',
};

const sizeClasses: Record<ButtonSize, string> = {
  sm: 'h-11 min-h-11 rounded-xl px-3.5 text-[0.8125rem]',
  md: 'h-11 min-h-11 rounded-xl px-4 text-sm',
  lg: 'h-12 min-h-12 rounded-xl px-6 text-[0.9375rem]',
  icon: 'size-11 min-h-11 min-w-11 rounded-xl',
};

export function buttonClasses(
  variant: ButtonVariant = 'primary',
  size: ButtonSize = 'md',
  className?: string,
): string {
  return cn(
    'inline-flex select-none items-center justify-center gap-2 whitespace-nowrap font-semibold tracking-[-0.01em] transition-[background-color,border-color,color,box-shadow,transform] duration-200 hover:-translate-y-0.5 active:translate-y-px focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring focus-visible:ring-offset-2 focus-visible:ring-offset-surface motion-reduce:hover:translate-y-0 motion-reduce:active:translate-y-0 disabled:pointer-events-none',
    variantClasses[variant],
    sizeClasses[size],
    className,
  );
}

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  isLoading?: boolean;
  leftIcon?: ReactNode;
  rightIcon?: ReactNode;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  {
    variant = 'primary',
    size = 'md',
    isLoading = false,
    leftIcon,
    rightIcon,
    className,
    children,
    disabled,
    type = 'button',
    ...props
  },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      disabled={disabled || isLoading}
      className={buttonClasses(variant, size, className)}
      aria-busy={isLoading || undefined}
      {...props}
    >
      {isLoading ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : leftIcon}
      {children}
      {!isLoading && rightIcon}
    </button>
  );
});
