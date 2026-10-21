import type { ComponentProps, ReactNode } from 'react';
import type { FieldError, UseFormRegisterReturn } from 'react-hook-form';
import { Field, Select, TextArea, TextInput } from '../components/form.tsx';

/**
 * Form controls of the admin editors: a labelled control registered in react-hook-form,
 * with the zod message under it. `name` doubles as the data-testid (admin-field-<name>).
 */

interface BaseProps {
  label: string;
  hint?: string;
  error?: Pick<FieldError, 'message'>;
  registration: UseFormRegisterReturn;
}

export function InputField({
  label,
  hint,
  error,
  registration,
  ...input
}: BaseProps & Omit<ComponentProps<'input'>, 'name'>) {
  return (
    <Field label={label} hint={hint} error={error?.message}>
      {({ id, describedBy, invalid }) => (
        <TextInput
          id={id}
          aria-describedby={describedBy}
          aria-invalid={invalid}
          data-testid={`admin-field-${registration.name}`}
          {...input}
          {...registration}
        />
      )}
    </Field>
  );
}

export function AreaField({
  label,
  hint,
  error,
  registration,
  rows = 4,
}: BaseProps & { rows?: number }) {
  return (
    <Field label={label} hint={hint} error={error?.message}>
      {({ id, describedBy, invalid }) => (
        <TextArea
          id={id}
          rows={rows}
          aria-describedby={describedBy}
          aria-invalid={invalid}
          data-testid={`admin-field-${registration.name}`}
          {...registration}
        />
      )}
    </Field>
  );
}

export function SelectField({
  label,
  hint,
  error,
  registration,
  children,
}: BaseProps & { children: ReactNode }) {
  return (
    <Field label={label} hint={hint} error={error?.message}>
      {({ id, describedBy, invalid }) => (
        <Select
          id={id}
          aria-describedby={describedBy}
          aria-invalid={invalid}
          data-testid={`admin-field-${registration.name}`}
          {...registration}
        >
          {children}
        </Select>
      )}
    </Field>
  );
}

/** A yes/no flag such as "dating is approximate" (DM-04). */
export function CheckField({
  label,
  registration,
}: {
  label: string;
  registration: UseFormRegisterReturn;
}) {
  return (
    <label className="flex items-center gap-2 text-sm">
      <input
        type="checkbox"
        className="size-4 accent-amber-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-700 dark:focus-visible:outline-amber-400"
        data-testid={`admin-field-${registration.name}`}
        {...registration}
      />
      {label}
    </label>
  );
}
