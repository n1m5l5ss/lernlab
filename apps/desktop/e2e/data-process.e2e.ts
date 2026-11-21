// The data process (#56): when it crashes, main starts it again, the window says it is reconnecting
// meanwhile, and the app carries on with the same data afterwards.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { close, launch, nav, screenshot, t } from './app';

test('the window reconnects after the data process crashes', async () => {
  const app = await launch();
  try {
    const { page, electron } = app;
    await page.getByRole('button', { name: t('welcome.continue') }).click();
    await page.getByRole('heading', { level: 1, name: t('pages.home') }).waitFor();

    const dataPid = () =>
      electron.evaluate(
        ({ app }) => app.getAppMetrics().find((m) => m.type === 'Utility' && m.name === 'LernLab data')?.pid ?? null,
      );
    const before = await dataPid();
    assert.ok(before, 'the data process is running');

    process.kill(before, 'SIGKILL');
    const notice = page.getByRole('status').getByText(t('app.reconnecting'));
    await notice.waitFor({ timeout: 10_000 });
    await screenshot(page, 'data-reconnecting');
    await notice.waitFor({ state: 'detached', timeout: 15_000 });

    const after = await dataPid();
    assert.ok(after && after !== before, 'a new data process took over');
    // The data is still there: the sample deck from the welcome shows on Decks.
    await nav(page, 'decks');
    await page.locator('.deck-head').first().waitFor();
  } finally {
    await close(app);
  }
});
