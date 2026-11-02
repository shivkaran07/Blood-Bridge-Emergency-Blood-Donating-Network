import type { ReactNode } from 'react';
import { AlertTriangle, CheckCircle2, Info, ShieldAlert, XCircle } from 'lucide-react';
import { cn } from '../../lib/cn';

type AlertVariant = 'info' | 'success' | 'warning' | 'danger' | 'neutral';

const styles: Record<AlertVariant, { container: string; icon: string; Icon: typeof Info }> = {
  info: {
    container: 'border-sky-200 bg-sky-50 text-sky-900',
    icon: 'text-sky-600',
    Icon: Info,
  },
  success: {
    container: 'border-accent-200 bg-accent-50 text-accent-900',
    icon: 'text-accent-600',
    Icon: CheckCircle2,
  },
  warning: {
    container: 'border-amber-200 bg-amber-50 text-amber-900',
    icon: 'text-amber-600',
    Icon: AlertTriangle,
  },
  danger: {
    container: 'border-brand-200 bg-brand-50 text-brand-accent',
    icon: 'text-brand-accent',
    Icon: XCircle,
  },
  neutral: {
    container: 'border-ink-200 bg-ink-50 text-ink-800',
    icon: 'text-ink-500',
    Icon: ShieldAlert,
  },
};

export interface AlertProps {
  variant?: AlertVariant;
  title?: ReactNode;
  children: ReactNode;
  className?: string;
  action?: ReactNode;
}

export function Alert({ variant = 'info', title, children, className, action }: AlertProps) {
  const { container, icon, Icon } = styles[variant];
  return (
    <div
      role={variant === 'danger' || variant === 'warning' ? 'alert' : 'status'}
      className={cn('flex items-start gap-3 rounded-xl border px-4 py-3.5 text-sm', container, className)}
    >
      <Icon className={cn('mt-0.5 size-5 shrink-0', icon)} aria-hidden="true" />
      <div className="min-w-0 flex-1 leading-relaxed">
        {title ? <p className="font-semibold">{title}</p> : null}
        <div className={cn(title ? 'mt-1' : undefined, 'text-[0.8125rem] leading-relaxed')}>{children}</div>
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}
