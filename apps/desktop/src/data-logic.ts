// Small rules behind Settings → Your data: backup kinds and the typed confirmation for deleting everything.

/** Why a backup was made, as a key under settings.data.kind in the language file. */
export const BACKUP_KINDS = [
  'daily',
  'before-update',
  'before-delete',
  'before-restore',
  'before-import',
  'before-delete-all',
] as const;
export type BackupKind = (typeof BACKUP_KINDS)[number] | 'manual';

export const backupKind = (label: string | null): BackupKind =>
  (BACKUP_KINDS as readonly string[]).includes(label ?? '') ? (label as BackupKind) : 'manual';

/** True when what the user typed is the confirmation word (spaces around it and letter case ignored). */
export const confirmed = (typed: string, word: string, locale?: string) =>
  word.trim() !== '' && typed.trim().toLocaleLowerCase(locale) === word.trim().toLocaleLowerCase(locale);
