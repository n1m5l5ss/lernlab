// Looking after cards in the real app: import a CSV, find and edit a card, change a setting, make a
// backup, and find all of it again after a restart. axe checks each screen on the way.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync } from 'node:fs';
import { join } from 'node:path';
import { checkA11y, close, freshProfile, launch, nav, screenshot, startsWith, t } from './app';

const DECK = 'E2E fruit';
const CSV = 'front,back\nder Apfel,apple\ndie Birne,pear\ndie Kirsche,cherry\n';

test('import a CSV, edit a card, change the theme, back up, and keep it all after a restart', async () => {
  const profile = freshProfile();
  let app = await launch(profile);
  try {
    const { page } = app;
    await page.getByRole('button', { name: t('welcome.continue') }).click();
    await page.getByRole('heading', { level: 1, name: t('pages.home') }).waitFor();

    // Decks → Import → a CSV file: preview first, nothing saved until Import.
    await nav(page, 'decks');
    await checkA11y(page, 'decks');
    await page.getByRole('button', { name: t('decks.import'), exact: true }).click();
    const panel = page.getByRole('region', { name: t('decks.importPanel.title') });
    await panel.locator('input[type=file]').setInputFiles({
      name: 'fruit.csv',
      mimeType: 'text/csv',
      buffer: Buffer.from(CSV),
    });
    await panel.getByText(t('decks.importPanel.found', { count: 3 })).waitFor();
    await panel.getByRole('textbox', { name: t('decks.importPanel.deckName') }).fill(DECK);
    await checkA11y(page, 'import');
    await panel.getByRole('button', { name: t('decks.importPanel.importCount', { count: 3 }) }).click();
    await panel.getByText(t('decks.importReport.added', { count: 3 })).waitFor();
    await panel.getByRole('button', { name: t('decks.importReport.done') }).click();
    await page.getByRole('heading', { name: DECK }).waitFor();

    // Cards: search, open a card, change its back, save.
    await nav(page, 'cards');
    await page.getByLabel(t('browse.search')).fill('Apfel');
    await page.getByRole('button', { name: /der Apfel/ }).click();
    const back = page.getByLabel(t('browse.editor.back'), { exact: true });
    assert.equal(await back.inputValue(), 'apple');
    await back.fill('apple (the fruit)');
    await page.getByRole('button', { name: t('common.save'), exact: true }).click();
    await page.getByText(t('common.saved')).waitFor();
    await checkA11y(page, 'cards');

    // Settings: the dark theme applies at once.
    await nav(page, 'settings');
    await checkA11y(page, 'settings');
    await page.getByLabel(t('settings.theme')).selectOption('dark');
    await page.locator('html[data-theme="dark"]').waitFor({ state: 'attached' });
    await page.getByText(t('common.saved')).waitFor();

    // Backup: made on request, then offered for a restore.
    await page.getByRole('button', { name: t('settings.backupNow') }).click();
    await page.getByText(startsWith(t('settings.backupDone', { file: '' }))).waitFor();
    const backups = readdirSync(join(profile, 'data', 'backups'));
    assert.ok(backups.length >= 1, 'a backup file is in the data folder');
    await page.getByRole('button', { name: t('settings.data.chooseBackup') }).click();
    const restore = page.getByRole('combobox', { name: t('settings.data.restore') });
    await restore.waitFor();
    assert.equal(await restore.locator('option').count(), backups.length);
    await screenshot(page, 'settings-backup');
    await close(app, { keepProfile: true });

    // After a restart: still dark, the deck and the edited card are still there.
    app = await launch(profile);
    await app.page.getByRole('heading', { level: 1, name: t('pages.home') }).waitFor();
    await app.page.locator('html[data-theme="dark"]').waitFor({ state: 'attached' });
    await nav(app.page, 'cards');
    await app.page.getByLabel(t('browse.search')).fill('Apfel');
    await app.page.getByRole('button', { name: /der Apfel/ }).click();
    assert.equal(await app.page.getByLabel(t('browse.editor.back'), { exact: true }).inputValue(), 'apple (the fruit)');
    await nav(app.page, 'decks');
    await app.page.getByRole('heading', { name: DECK }).waitFor();
    await screenshot(app.page, 'decks-after-restart');
  } finally {
    await close(app);
  }
});
