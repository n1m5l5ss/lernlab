// The frame every screen lives in: skip link, sidebar, and a main area whose heading takes focus on each screen change.
import { useEffect, useRef, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { hashFor, type Route } from './routes';

/** 24 × 24 outline icons from the approved mockups (docs/design/canvas/project/Main.dc.html). */
const ICONS: Record<Route, ReactNode> = {
  home: (
    <>
      <path d="M3 11l9-7 9 7" />
      <path d="M5 10v10h14V10" />
    </>
  ),
  decks: (
    <>
      <rect x="4" y="7" width="16" height="13" rx="2" />
      <path d="M7 4h10" />
    </>
  ),
  cards: <path d="M4 6h16M4 12h16M4 18h10" />,
  progress: <path d="M4 20V10M10 20V4M16 20v-7M22 20H2" />,
  settings: (
    <>
      <circle cx="12" cy="12" r="3" />
      <path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M4.9 19.1L7 17M17 7l2.1-2.1" />
    </>
  ),
};

const MAIN_ROUTES: Route[] = ['home', 'decks', 'cards', 'progress'];

function NavLink({ route, current }: { route: Route; current: Route }) {
  const { t } = useTranslation();
  return (
    <a className="nav-link" href={hashFor(route)} aria-current={route === current ? 'page' : undefined}>
      <svg
        aria-hidden="true"
        className={route === 'cards' ? 'icon-dir' : undefined}
        width="20"
        height="20"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        {ICONS[route]}
      </svg>
      {t(`nav.${route}`)}
    </a>
  );
}

export function Shell({ route, kicker, children }: { route: Route; kicker?: string; children: ReactNode }) {
  const { t } = useTranslation();
  const heading = useRef<HTMLHeadingElement>(null);
  const first = useRef(true);

  // Moving to another screen puts focus on its heading, so screen readers announce it and Tab starts there.
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    heading.current?.focus();
  }, [route]);

  return (
    <div className="shell">
      <a className="skip-link" href="#main" onClick={(e) => (e.preventDefault(), heading.current?.focus())}>
        {t('nav.skip')}
      </a>
      <nav className="sidebar" aria-label={t('nav.label')}>
        <div className="sidebar-name">{t('app.name')}</div>
        {MAIN_ROUTES.map((r) => (
          <NavLink key={r} route={r} current={route} />
        ))}
        <div className="grow" />
        <NavLink route="settings" current={route} />
      </nav>
      <main id="main" className="shell-main">
        <div className="shell-content">
          {kicker && <p className="page-kicker">{kicker}</p>}
          <h1 ref={heading} tabIndex={-1} className="page-title">
            {t(`pages.${route}`)}
          </h1>
          {children}
        </div>
      </main>
    </div>
  );
}
