import type { Attempt, SessionLength } from '@lernlab/core/types';
import type { StudySource } from '@lernlab/core/learn';
import type { BulkAction } from '@lernlab/core/browse';
import type { ColumnMapping } from '@lernlab/core/importpreview';

import type { InputOf } from '../backend/handlers';
import { CSV_TEMPLATE, CSV_TEMPLATE_NAME } from '@lernlab/core/csvtemplate';
import { call, saveFile } from './bridge';

let chain = Promise.resolve();

export const api = {
  state: () => call('state.get'),
  finishWelcome: (choice: InputOf<'welcome.finish'>['choice']) => call('welcome.finish', { choice }),
  importStatus: () => call('import.status'),
  startImport: () => call('import.anki', {}),
  session: (length: SessionLength, practice = false) => call('session.plan', { length, practice }),
  finish: (body: Parameters<typeof call<'session.finish'>>[1]) => call('session.finish', body),
  stats: () => call('stats.get'),
  summary: () => call('summary.today'),
  progress: () => call('progress.get'),
  saveSettings: (s: Record<string, unknown>) => call('settings.save', s),
  appInfo: () => call('app.info'),
  backupNow: () => call('backup.create', {}),
  backups: () => call('backup.list'),
  restoreBackup: (file: string) => call('backup.restore', { file }),
  exportAll: async () => {
    const f = await call('data.export');
    saveFile(f.name, f.data, f.type);
  },
  importAll: async (file: File) => call('data.import', { data: new Uint8Array(await file.arrayBuffer()) }),
  deleteAll: () => call('data.deleteAll', { confirm: 'delete-all-data' }),
  createDeck: (b: Parameters<typeof call<'decks.create'>>[1]) => call('decks.create', b),
  updateDeck: (id: number, patch: Parameters<typeof call<'decks.update'>>[1]['patch']) =>
    call('decks.update', { id, patch }),
  deleteDeck: (id: number) => call('decks.delete', { id }),
  activate: (id: number | null) => call('decks.activate', { id }),
  chooseSource: (source: StudySource) => call('study.choose', { source }),
  /** Save the CSV template (column names and three example cards). */
  downloadTemplate: () => saveFile(CSV_TEMPLATE_NAME, CSV_TEMPLATE, 'text/csv'),
  exportDeck: async (id: number, format: 'csv' | 'lernpack') => {
    const f = await call('decks.export', { id, format });
    saveFile(f.name, f.data, f.type);
  },
  findCards: (filter: InputOf<'cards.find'>) => call('cards.find', filter),
  getCard: (id: number) => call('cards.get', { id }),
  findDuplicates: (deckId: number, front: string, excludeId?: number) =>
    call('cards.duplicates', { deckId, front, excludeId }),
  bulkCards: (ids: number[], action: BulkAction) => call('cards.bulk', { ids, action }),
  addCard: (deckId: number, card: CardInput) => call('cards.add', { deckId, card }),
  saveCard: (id: number, card: CardInput) => call('cards.update', { id, card }),
  importFile: async (file: File, opts: Omit<InputOf<'import.file'>, 'name' | 'data'>) =>
    call('import.file', { name: file.name, data: new Uint8Array(await file.arrayBuffer()), ...opts }),
  /** What a file or pasted text would import, without saving anything. */
  previewImport: async (b: {
    file?: File;
    text?: string;
    fieldSep?: string;
    cardSep?: string;
    mapping?: ColumnMapping;
  }) =>
    call('import.preview', {
      ...(b.file ? { name: b.file.name, data: new Uint8Array(await b.file.arrayBuffer()) } : { text: b.text }),
      fieldSep: b.fieldSep,
      cardSep: b.cardSep,
      mapping: b.mapping,
    }),
  importText: (b: Parameters<typeof call<'import.text'>>[1]) => call('import.text', b),
  ankiInfo: () => call('import.ankiInfo'),
  ankiImport: (b: { source?: string; deckName?: string }) => call('import.anki', b),
  uploadMedia: async (file: File) =>
    call('media.upload', { name: file.name, data: new Uint8Array(await file.arrayBuffer()) }),
  downloadSummary: async () => {
    const s = await call('summary.today');
    saveFile(`lernlab-${s.date}.json`, JSON.stringify(s, null, 2), 'application/json');
  },
};

/** Card fields the editor sends; anything else on the object is ignored by the app. */
type CardInput = InputOf<'cards.add'>['card'];

export function sendOverride(itemId: number) {
  chain = chain.then(() =>
    call('attempt.override', { itemId }).then(
      () => {},
      () => {},
    ),
  );
}

// Attempts are sent in order in the background so answering never waits for the app.
export function sendAttempt(a: Attempt) {
  chain = chain.then(() =>
    call('attempt.record', a).then(
      () => {},
      () => {},
    ),
  );
  return chain;
}
