// The study loop, clicked through in the real app: first start → welcome → sample deck → a full session
// → summary → progress, then a restart that keeps it all. axe checks every screen on the way.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { checkA11y, close, freshProfile, launch, nav, playSession, screenshot, startsWith, t } from './app';

test('first start: welcome, sample deck, a full session, summary and progress', async () => {
  const profile = freshProfile();
  let app = await launch(profile);
  try {
    const { page } = app;

    // Welcome: shown once to a new user, "Learn a language" picked by default.
    await page.getByRole('heading', { level: 1, name: t('welcome.title') }).waitFor();
    assert.ok(await page.getByRole('radio', { name: startsWith(t('welcome.language')) }).isChecked());
    await checkA11y(page, 'welcome');
    await page.getByRole('button', { name: t('welcome.continue') }).click();

    // Home: the sample deck is in, and Start is the one obvious action.
    await page.getByRole('heading', { level: 1, name: t('pages.home') }).waitFor();
    const start = page.getByRole('button', { name: startsWith(t('home.startStudying')) });
    await start.waitFor();
    assert.ok(Number(await page.locator('.home-number').first().textContent()) >= 0);
    await checkA11y(page, 'home');

    // A full 5-minute session, from Start to its summary.
    await page.getByRole('radio', { name: t('home.lengthMinutes', { count: 5 }) }).click();
    await start.click();
    const blocks: string[] = [];
    await playSession(page, async (title) => {
      blocks.push(title);
      if (blocks.length === 1) await checkA11y(page, 'session');
    });
    assert.ok(blocks.length >= 3, `expected several rounds, got ${blocks.join(', ')}`);

    // Summary: how it went, then back home.
    await page.getByText(startsWith(t('summary.kicker', { count: 5 }).split('·')[0].trim())).waitFor();
    await checkA11y(page, 'summary');
    await page.getByRole('button', { name: startsWith(t('summary.done')) }).click();
    await page.getByRole('heading', { level: 1, name: t('pages.home') }).waitFor();
    // This week shows today as studied.
    await page.getByText(t('home.daysOfWeek', { count: 1 })).waitFor();

    // Progress shows the work.
    await nav(page, 'progress');
    await page.getByRole('heading', { name: t('progress.days.title') }).waitFor();
    await checkA11y(page, 'progress');
    await close(app, { keepProfile: true });

    // A restart opens Home straight away (no second welcome) and keeps the streak.
    app = await launch(profile);
    await app.page.getByRole('heading', { level: 1, name: t('pages.home') }).waitFor();
    await app.page.getByText(t('home.daysOfWeek', { count: 1 })).waitFor();
    assert.equal(await app.page.getByRole('heading', { name: t('welcome.title') }).count(), 0);
    await screenshot(app.page, 'home-after-restart');
  } finally {
    await close(app);
  }
});
