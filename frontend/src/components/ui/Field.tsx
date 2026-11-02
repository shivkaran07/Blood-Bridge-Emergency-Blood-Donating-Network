import {
  useState,
  useId,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from 'react';
import { AlertCircle, Check, Eye, EyeOff } from 'lucide-react';
import { cn } from '../../lib/cn';

const controlBase =
  'w-full rounded-xl border bg-surface-raised px-3.5 py-2.5 text-sm text-ink-900 shadow-[0_1px_2px_rgb(29_26_23/0.04)] transition-[border-color,box-shadow,background-color] duration-200 placeholder:text-ink-500 hover:border-ink-300 focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-offset-surface disabled:cursor-not-allowed disabled:bg-ink-50 disabled:text-ink-500';

function controlClasses(hasError?: boolean): string {
  return cn(
    controlBase,
    hasError
      ? 'border-brand-400 focus:border-brand-500 focus:ring-focus-ring/50'
      : 'border-ink-200 focus:border-brand-400 focus:ring-focus-ring/50',
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
      <label htmlFor={htmlFor}       className="flex items-center gap-1 text-[0.8125rem] font-semibold tracking-[-0.005em] text-ink-800">
        {label}
        {required ? (
          <span className="text-brand-accent" aria-hidden="true">
            *
          </span>
        ) : null}
        {optional ? <span className="font-normal text-ink-500">(optional)</span> : null}
      </label>
      {children}
      {error ? (
        <p className="flex items-start gap-1.5 text-xs font-medium text-brand-accent" role="alert">
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
      className={cn(
        controlClasses(invalid),
        "appearance-none bg-[url('data:image/svg+xml;charset=utf-8,%3Csvg xmlns=%27http://www.w3.org/2000/svg%27 viewBox=%270 0 20 20%27 fill=%27none%27 stroke=%27%2364748b%27 stroke-width=%271.6%27 stroke-linecap=%27round%27 stroke-linejoin=%27round%27%3E%3Cpath d=%27m6 8 4 4 4-4%27/%3E%3C/svg%3E')] bg-[length:1.1rem] bg-[right_0.7rem_center] bg-no-repeat pr-10",
        className,
      )}
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
          className="peer size-5 cursor-pointer appearance-none rounded border border-ink-300 bg-surface-raised transition checked:border-brand-700 checked:bg-brand-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring focus-visible:ring-offset-2 focus-visible:ring-offset-surface disabled:cursor-not-allowed disabled:bg-ink-100"
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

export interface PasswordInputProps extends Omit<InputProps, 'type'> {
  /** Optional leading icon rendered inside the control. */
  leadingIcon?: ReactNode;
}

/** Password field with an accessible show/hide control and a 44px target. */
export function PasswordInput({ className, invalid, leadingIcon, ...props }: PasswordInputProps) {
  const [visible, setVisible] = useState(false);
  return (
    <div className="relative">
      {leadingIcon ? (
        <span
          className="pointer-events-none absolute left-3 top-1/2 flex -translate-y-1/2 text-ink-500"
          aria-hidden="true"
        >
          {leadingIcon}
        </span>
      ) : null}
      <Input
        {...props}
        type={visible ? 'text' : 'password'}
        invalid={invalid}
        className={cn(Boolean(leadingIcon) && 'pl-9', 'pr-12', className)}
      />
      <button
        type="button"
        onClick={() => setVisible((value) => !value)}
        className="absolute right-0 top-0 flex h-full min-w-11 items-center justify-center rounded-r-lg px-3 text-ink-500 transition hover:text-ink-700"
        aria-label={visible ? 'Hide password' : 'Show password'}
        aria-pressed={visible}
        tabIndex={0}
      >
        {visible ? <EyeOff className="size-4" aria-hidden="true" /> : <Eye className="size-4" aria-hidden="true" />}
      </button>
    </div>
  );
}

export interface SwitchProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: ReactNode;
  description?: ReactNode;
  disabled?: boolean;
  id?: string;
  className?: string;
}

/** A large, keyboard-operable toggle used for availability and preferences. */
export function Switch({
  checked,
  onChange,
  label,
  description,
  disabled,
  id,
  className,
}: SwitchProps) {
  const generatedId = useId();
  const labelId = `${id ?? generatedId}-label`;
  const descriptionId = `${id ?? generatedId}-description`;

  return (
    <div className={cn('flex items-start justify-between gap-4', className)}>
      <div className="min-w-0">
        <p id={labelId} className="text-sm font-medium text-ink-800">
          {label}
        </p>
        {description ? (
          <p id={descriptionId} className="mt-0.5 text-xs leading-relaxed text-ink-500">
            {description}
          </p>
        ) : null}
      </div>
      <button
        type="button"
        role="switch"
        id={id}
        aria-checked={checked}
        aria-labelledby={labelId}
        aria-describedby={description ? descriptionId : undefined}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={cn(
          'relative flex h-11 min-h-11 w-14 shrink-0 items-center rounded-full border px-1 transition-colors duration-200',
          checked
            ? 'border-brand-800 bg-brand-700'
            : 'border-ink-300 bg-ink-200',
          disabled && 'cursor-not-allowed opacity-60',
        )}
      >
        <span
          className={cn(
            'pointer-events-none block size-8 rounded-full bg-white shadow-[0_1px_2px_rgb(0_0_0/0.25)] transition-transform duration-200',
            checked ? 'translate-x-4' : 'translate-x-0',
          )}
          aria-hidden="true"
        />
      </button>
    </div>
  );
}

export function FormError({ children }: { children: ReactNode }) {
  return (
    <div
      role="alert"
      className="flex items-start gap-2 rounded-lg border border-brand-200 bg-brand-50 px-3.5 py-3 text-sm text-brand-accent"
    >
      <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
      <span>{children}</span>
    </div>
  );
}
