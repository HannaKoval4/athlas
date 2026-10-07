import { type ComponentProps, type ReactNode, useId } from 'react';
import { useTranslation } from 'react-i18next';
import type { ValidationKey } from '../i18n/index.ts';

const controlClass =
  'w-full rounded-md border border-stone-300 bg-white px-3 py-2 text-stone-900 ' +
  'focus:outline-2 focus:outline-offset-1 focus:outline-amber-700 ' +
  'aria-invalid:border-red-700';

interface FieldProps {
  label: string;
  /** Validation message key from the zod schema, or an already translated server error. */
  error?: string;
  hint?: string;
  children: (control: { id: string; describedBy?: string; invalid: boolean }) => ReactNode;
}

/** Label + control + hint + error, wired with aria-describedby / aria-invalid for screen readers. */
export function Field({ label, error, hint, children }: FieldProps) {
  const { t, i18n } = useTranslation();
  const id = useId();
  const hintId = `${id}-hint`;
  const errorId = `${id}-error`;
  const describedBy = [hint && hintId, error && errorId].filter(Boolean).join(' ') || undefined;
  const validationKey = `validation.${error}`;
  const message =
    error && i18n.exists(validationKey) ? t(`validation.${error as ValidationKey}`) : error;

  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="font-medium text-stone-800">
        {label}
      </label>
      {children({ id, describedBy, invalid: Boolean(error) })}
      {hint && (
        <p id={hintId} className="text-sm text-stone-600">
          {hint}
        </p>
      )}
      {message && (
        <p id={errorId} className="text-sm text-red-700">
          {message}
        </p>
      )}
    </div>
  );
}

export function TextInput(props: ComponentProps<'input'>) {
  return <input {...props} className={controlClass} />;
}

export function Select(props: ComponentProps<'select'>) {
  return <select {...props} className={controlClass} />;
}

export function SubmitButton({ children, ...props }: ComponentProps<'button'>) {
  return (
    <button
      type="submit"
      {...props}
      className="rounded-md bg-amber-800 px-4 py-2 font-medium text-white hover:bg-amber-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-700 disabled:opacity-60"
    >
      {children}
    </button>
  );
}

/** Form-level error (role="alert" is announced immediately). */
export function FormError({ children, testId }: { children?: ReactNode; testId?: string }) {
  if (!children) return null;
  return (
    <p role="alert" data-testid={testId} className="rounded-md bg-red-50 px-3 py-2 text-red-800">
      {children}
    </p>
  );
}

/** Success message (role="status" is announced politely). */
export function FormSuccess({ children, testId }: { children?: ReactNode; testId?: string }) {
  if (!children) return null;
  return (
    <p
      role="status"
      data-testid={testId}
      className="rounded-md bg-green-50 px-3 py-2 text-green-800"
    >
      {children}
    </p>
  );
}
