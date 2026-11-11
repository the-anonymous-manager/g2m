import type { Note } from '@/lib/i18n/notes';

/**
 * Text from the sheet on a translated page. A translation shows as it is; text with no translation yet shows in
 * English, marked as English (so screen readers and search engines read it right, and Arabic pages keep it
 * left to right), with a tooltip saying it is not translated yet.
 */
export function IntlText({ note, label }: { note: Note; label: string }) {
  if (note.translated) return <>{note.text}</>;
  return (
    <span lang="en" dir="ltr" title={label}>
      {note.text}
    </span>
  );
}
