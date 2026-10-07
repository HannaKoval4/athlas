import type { NoteExportFormat } from '@atlas/shared';
import { Download } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Button } from '../components/ui/button.tsx';
import { useExportNotes } from './api.ts';

/** F-08: "Download Markdown" / "Download PDF" of all the user's notes. */
export function ExportNotes() {
  const { t, i18n } = useTranslation();
  const exportNotes = useExportNotes();
  // Headings of the file follow the interface language; the server knows ru and en.
  const lang = i18n.resolvedLanguage === 'en' ? 'en' : 'ru';

  const buttons: { format: NoteExportFormat; label: string }[] = [
    { format: 'md', label: t('notes.exportMd') },
    { format: 'pdf', label: t('notes.exportPdf') },
  ];

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap gap-2">
        {buttons.map(({ format, label }) => (
          <Button
            key={format}
            variant="outline"
            disabled={exportNotes.isPending}
            data-testid={`export-${format}`}
            onClick={() => exportNotes.mutate({ format, lang })}
          >
            <Download />
            {label}
          </Button>
        ))}
      </div>
      <div aria-live="polite" className="text-sm">
        {exportNotes.isPending && <span>{t('notes.exporting')}</span>}
        {exportNotes.isError && (
          <span role="alert" className="text-destructive">
            {t('notes.exportError')}
          </span>
        )}
      </div>
    </div>
  );
}
