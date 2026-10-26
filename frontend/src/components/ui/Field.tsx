import {
  useId,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from 'react';
import { AlertCircle, Check } from 'lucide-react';
import { cn } from '../../lib/cn';

const controlBase =
  'w-full rounded-lg border bg-white px-3.5 py-2.5 text-sm text-ink-900 shadow-sm transition placeholder:text-ink-400 focus:outline-none focus:ring-2 disabled:cursor-not-allowed disabled:bg-ink-50 disabled:text-ink-500';

function controlClasses(hasError?: boolean): string {
  return cn(
    controlBase,
    hasError
      ? 'border-brand-400 focus:border-brand-500 focus:ring-brand-100'
      : 'border-ink-200 focus:border-brand-400 focus:ring-brand-100',
  );
}

export interface FieldProps {
  label: string;
  htmlFor?: string;
  hint?: ReactNode;
  error?: string;
  required?: boolean;
  optional?: boolean;
  className?: string;
  children: ReactNode;
}

export function Field({
  label,
  htmlFor,
  hint,
  error,
  required,
  optional,
  className,
  children,
}: FieldProps) {
  return (
    <div className={cn('space-y-1.5', className)}>
      <label htmlFor={htmlFor} className="flex items-center gap-1 text-sm font-medium text-ink-800">
        {label}
        {required ? (
          <span className="text-brand-600" aria-hidden="true">
            *
          </span>
        ) : null}
        {optional ? <span className="font-normal text-ink-400">(optional)</span> : null}
      </label>
      {children}
      {error ? (
        <p className="flex items-start gap-1.5 text-xs font-medium text-brand-700" role="alert">
          <AlertCircle className="mt-px size-3.5 shrink-0" aria-hidden="true" />
          {error}
        </p>
      ) : hint ? (
        <p className="text-xs leading-relaxed text-ink-500">{hint}</p>
      ) : null}
    </div>
  );
}

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  invalid?: boolean;
}

export function Input({ className, invalid, ...props }: InputProps) {
  return <input className={cn(controlClasses(invalid), className)} {...props} />;
}

export interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  invalid?: boolean;
}

export function Textarea({ className, invalid, rows = 4, ...props }: TextareaProps) {
  return (
    <textarea
      rows={rows}
      className={cn(controlClasses(invalid), 'resize-y leading-relaxed', className)}
      {...props}
    />
  );
}

export interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  invalid?: boolean;
}

export function Select({ className, invalid, children, ...props }: SelectProps) {
  return (
    <select
      className={cn(controlClasses(invalid), 'appearance-none pr-9', className)}
      {...props}
    >
      {children}
    </select>
  );
}

export interface CheckboxProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> {
  label: ReactNode;
  description?: ReactNode;
}

export function Checkbox({ label, description, className, id, ...props }: CheckboxProps) {
  const generatedId = useId();
  const checkboxId = id ?? generatedId;
  return (
    <div className={cn('flex items-start gap-3', className)}>
      <span className="relative mt-0.5 flex size-5 shrink-0 items-center justify-center">
        <input
          id={checkboxId}
          type="checkbox"
          className="peer size-5 cursor-pointer appearance-none rounded border border-ink-300 bg-white transition checked:border-brand-700 checked:bg-brand-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-200 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:bg-ink-100"
          {...props}
        />
        <Check
          className="pointer-events-none absolute size-3.5 text-white opacity-0 peer-checked:opacity-100"
          strokeWidth={3}
          aria-hidden="true"
        />
      </span>
      <label htmlFor={checkboxId} className="cursor-pointer text-sm leading-relaxed text-ink-700">
        {label}
        {description ? (
          <span className="mt-1 block text-xs leading-relaxed text-ink-500">{description}</span>
        ) : null}
      </label>
    </div>
  );
}

export function FormError({ children }: { children: ReactNode }) {
  return (
    <div
      role="alert"
      className="flex items-start gap-2 rounded-lg border border-brand-200 bg-brand-50 px-3.5 py-3 text-sm text-brand-800"
    >
      <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
      <span>{children}</span>
    </div>
  );
}
