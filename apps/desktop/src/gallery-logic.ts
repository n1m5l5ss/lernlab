// The deck gallery screen's small rules: which decks you already have, licence links, how to share a deck.
import { REPO_URL } from './about';

/** "Share your deck": the deck submission form in LernLab's issues (.github/ISSUE_TEMPLATE/deck_submission.yml). */
export const SUBMIT_DECK_URL = `${REPO_URL}/issues/new?template=deck_submission.yml`;

/** The SPDX page for a single licence id; null for an expression (MIT OR CC0-1.0) or a LicenseRef. */
export const licenceUrl = (licence: string) =>
  /^[A-Za-z0-9.+-]+$/.test(licence) && !licence.startsWith('LicenseRef-')
    ? `https://spdx.org/licenses/${licence}.html`
    : null;

/** A gallery deck counts as installed when you have a deck with its title (installs use the title). */
export const isInstalled = (title: string, decks: { name: string }[]) =>
  decks.some((d) => d.name.trim().toLocaleLowerCase() === title.trim().toLocaleLowerCase());

/** A file size in kB or MB, rounded for people (shown with Intl's unit formatting). */
export const sizeParts = (bytes: number) =>
  bytes < 1024 * 1024
    ? { unit: 'kilobyte' as const, value: Math.max(1, Math.round(bytes / 1024)) }
    : { unit: 'megabyte' as const, value: Math.round((bytes / 1024 / 1024) * 10) / 10 };
