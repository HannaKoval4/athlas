import type { AdminCulture, AdminEra, AdminRegion, AdminSource } from '@atlas/shared';
import { useState } from 'react';
import type { UseFormRegisterReturn } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { isApiError } from '../api/client.ts';
import { useAdminList } from './api.ts';

/** Translated text of a failed admin request; the server's detail is appended for the admin. */
export function useAdminErrorText() {
  const { t } = useTranslation();
  return (error: unknown): string | undefined => {
    if (!error) return undefined;
    if (!isApiError(error)) return t('admin.errors.network');
    const key =
      error.status === 409
        ? 'admin.errors.conflict'
        : error.status === 400
          ? 'admin.errors.invalid'
          : error.status === 404
            ? 'admin.errors.notFound'
            : error.status === 403
              ? 'admin.errors.forbidden'
              : 'admin.errors.server';
    return `${t(key)} (${error.message})`;
  };
}

// ---- Reference data for selects ----------------------------------------------------------------

export const useCultureOptions = () => useAdminList<AdminCulture>('cultures');
export const useRegionOptions = () => useAdminList<AdminRegion>('regions');
export const useEraOptions = () => useAdminList<AdminEra>('eras');
export const useSourceOptions = () => useAdminList<AdminSource>('sources');

/** Open/closed state of an editor drawer: closed, creating a new record, or editing `item`. */
export function useEditor<T>() {
  const [state, setState] = useState<{ open: boolean; item?: T }>({ open: false });
  return {
    open: state.open,
    item: state.item,
    create: () => setState({ open: true }),
    edit: (item: T) => setState({ open: true, item }),
    close: () => setState({ open: false }),
  };
}

/** Fills an empty slug from the (Russian) name once the name field is left: "Храм" -> "khram". */
export function withSlugSuggestion(
  registration: UseFormRegisterReturn,
  suggest: () => void,
): UseFormRegisterReturn {
  return {
    ...registration,
    onBlur: async (event) => {
      await registration.onBlur(event);
      suggest();
    },
  };
}
