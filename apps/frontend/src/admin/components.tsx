import type { AdminCardListItem } from '@atlas/shared';
import { type ReactNode, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { FormError, Select, TextInput } from '../components/form.tsx';
import { Button } from '../components/ui/button.tsx';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '../components/ui/sheet.tsx';
import { useAdminCards } from './api.ts';
import { useAdminErrorText } from './hooks.ts';

export function SectionHeader({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
      <div>
        <h2 className="text-xl font-semibold">{title}</h2>
        {description && <p className="text-sm text-muted-foreground">{description}</p>}
      </div>
      {action}
    </div>
  );
}

export function AddButton({ onClick, testId }: { onClick: () => void; testId?: string }) {
  const { t } = useTranslation();
  return (
    <Button onClick={onClick} data-testid={testId ?? 'admin-add'}>
      {t('admin.add')}
    </Button>
  );
}

export interface Column<T> {
  header: string;
  cell: (row: T) => ReactNode;
  className?: string;
}

/** A plain data table; the last column holds the row actions. */
export function AdminTable<T>({
  rows,
  columns,
  rowKey,
  actions,
  empty,
  testId,
}: {
  rows: readonly T[];
  columns: readonly Column<T>[];
  rowKey: (row: T) => string;
  actions?: (row: T) => ReactNode;
  empty?: string;
  testId?: string;
}) {
  const { t } = useTranslation();
  if (rows.length === 0) {
    return <p className="text-muted-foreground">{empty ?? t('admin.empty')}</p>;
  }
  return (
    <div className="overflow-x-auto rounded-lg border border-border">
      <table className="w-full text-left text-sm" data-testid={testId}>
        <thead className="bg-muted/60">
          <tr>
            {columns.map((column) => (
              <th key={column.header} scope="col" className="px-3 py-2 font-medium">
                {column.header}
              </th>
            ))}
            {actions && (
              <th scope="col" className="px-3 py-2">
                <span className="sr-only">{t('admin.actions')}</span>
              </th>
            )}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={rowKey(row)} className="border-t border-border" data-testid="admin-row">
              {columns.map((column) => (
                <td key={column.header} className={`px-3 py-2 align-top ${column.className ?? ''}`}>
                  {column.cell(row)}
                </td>
              ))}
              {actions && (
                <td className="px-3 py-2 align-top">
                  <div className="flex flex-wrap justify-end gap-1">{actions(row)}</div>
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** Two-step delete without a modal (same pattern as notes); shows the server's refusal. */
export function DeleteButton({
  onConfirm,
  pending,
  error,
  label,
}: {
  onConfirm: () => void;
  pending: boolean;
  error?: unknown;
  /** What is deleted, for screen readers: "Delete «Parthenon»" */
  label: string;
}) {
  const { t } = useTranslation();
  const errorText = useAdminErrorText();
  const [confirming, setConfirming] = useState(false);

  if (!confirming) {
    return (
      <Button
        size="sm"
        variant="ghost"
        aria-label={label}
        data-testid="admin-delete"
        onClick={() => setConfirming(true)}
      >
        {t('admin.delete')}
      </Button>
    );
  }
  return (
    <div role="group" aria-label={label} className="flex flex-wrap items-center gap-1">
      <Button
        size="sm"
        variant="destructive"
        disabled={pending}
        data-testid="admin-delete-confirm"
        onClick={onConfirm}
      >
        {t('admin.confirmDelete')}
      </Button>
      <Button size="sm" variant="ghost" onClick={() => setConfirming(false)}>
        {t('admin.cancel')}
      </Button>
      {Boolean(error) && (
        <span role="alert" className="basis-full text-sm text-destructive">
          {errorText(error)}
        </span>
      )}
    </div>
  );
}

export function EditButton({ onClick, label }: { onClick: () => void; label: string }) {
  const { t } = useTranslation();
  return (
    <Button
      size="sm"
      variant="outline"
      aria-label={label}
      data-testid="admin-edit"
      onClick={onClick}
    >
      {t('admin.edit')}
    </Button>
  );
}

/** Right-hand drawer with an editor form. */
export function EditorSheet({
  open,
  onClose,
  title,
  description,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <Sheet open={open} onOpenChange={(next) => !next && onClose()}>
      <SheetContent
        side="right"
        className="w-full overflow-y-auto data-[side=right]:sm:max-w-xl"
        data-testid="admin-editor"
        // Without a description Radix expects an explicit "no description" to stay quiet.
        {...(description ? {} : { 'aria-describedby': undefined })}
      >
        <SheetHeader>
          <SheetTitle>{title}</SheetTitle>
          {description && <SheetDescription>{description}</SheetDescription>}
        </SheetHeader>
        <div className="px-4 pb-6">{children}</div>
      </SheetContent>
    </Sheet>
  );
}

export function FormActions({
  pending,
  error,
  onCancel,
}: {
  pending: boolean;
  error?: unknown;
  onCancel?: () => void;
}) {
  const { t } = useTranslation();
  const errorText = useAdminErrorText();
  return (
    <div className="flex flex-col gap-3">
      <FormError testId="admin-form-error">{errorText(error)}</FormError>
      <div className="flex gap-2">
        <Button type="submit" disabled={pending} data-testid="admin-save">
          {pending ? t('admin.saving') : t('admin.save')}
        </Button>
        {onCancel && (
          <Button type="button" variant="ghost" onClick={onCancel}>
            {t('admin.cancel')}
          </Button>
        )}
      </div>
    </div>
  );
}

/** Two or more fields side by side on wide screens. */
export function FieldRow({ children }: { children: ReactNode }) {
  return <div className="grid gap-3 sm:grid-cols-2">{children}</div>;
}

export function LoadState({ isPending, error }: { isPending: boolean; error: unknown }) {
  const { t } = useTranslation();
  const errorText = useAdminErrorText();
  if (isPending) return <p className="text-muted-foreground">{t('app.loading')}</p>;
  if (error) return <FormError>{errorText(error)}</FormError>;
  return null;
}

/** <option>s for a select of records with a name; the first option is the placeholder. */
export function NamedOptions({
  items,
  placeholder,
}: {
  items: readonly { id: string; name?: string; title?: string }[] | undefined;
  placeholder: string;
}) {
  return (
    <>
      <option value="">{placeholder}</option>
      {items?.map((item) => (
        <option key={item.id} value={item.id}>
          {item.name ?? item.title}
        </option>
      ))}
    </>
  );
}

/**
 * Picks a card by part of its title: drafts included, ten matches at most. The chosen id goes
 * to `onChange`; `selected` is shown so the admin sees which card is linked now.
 */
export function CardPicker({
  id,
  value,
  selectedTitle,
  onChange,
  describedBy,
  invalid,
  excludeId,
  allowEmpty = false,
}: {
  id: string;
  value: string;
  selectedTitle?: string | null;
  onChange: (cardId: string, card?: AdminCardListItem) => void;
  describedBy?: string;
  invalid?: boolean;
  excludeId?: string;
  allowEmpty?: boolean;
}) {
  const { t } = useTranslation();
  const [query, setQuery] = useState('');
  const search = query.trim();
  const cards = useAdminCards({ q: search, pageSize: 10 }, search.length >= 2);
  const options = (cards.data?.items ?? []).filter((card) => card.id !== excludeId);

  return (
    <div className="flex flex-col gap-2">
      <TextInput
        id={id}
        type="search"
        value={query}
        placeholder={t('admin.cardPicker.placeholder')}
        aria-describedby={describedBy}
        aria-invalid={invalid}
        data-testid="card-picker-search"
        onChange={(event) => setQuery(event.target.value)}
      />
      <Select
        aria-label={t('admin.cardPicker.choose')}
        value={value}
        data-testid="card-picker-select"
        onChange={(event) =>
          onChange(
            event.target.value,
            options.find((card) => card.id === event.target.value),
          )
        }
      >
        <option value="">
          {allowEmpty ? t('admin.cardPicker.none') : t('admin.cardPicker.choose')}
        </option>
        {value && !options.some((card) => card.id === value) && (
          <option value={value}>{selectedTitle ?? value}</option>
        )}
        {options.map((card) => (
          <option key={card.id} value={card.id}>
            {card.title} · {card.culture.name}
            {card.published ? '' : ` (${t('admin.cards.draft')})`}
          </option>
        ))}
      </Select>
    </div>
  );
}
