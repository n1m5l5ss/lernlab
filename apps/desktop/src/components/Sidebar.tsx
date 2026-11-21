// Sidebar (mockup: docs/design/images/Home-light.png): the app's name, the main places, and Settings at
// the bottom. The current place is marked aria-current="page" and shown bold on a tint, not by colour alone.
import type { ReactNode } from 'react';
import { cx } from './logic';

export type SidebarItem = {
  key: string;
  href: string;
  label: string;
  /** The inside of a 24 × 24 outline icon (its paths); the <svg> around it is drawn here. */
  icon: ReactNode;
  current?: boolean;
  /** e.g. "icon-dir" for an icon that mirrors right to left. */
  iconClassName?: string;
};

function SidebarLink({ item }: { item: SidebarItem }) {
  return (
    <a className="nav-link" href={item.href} aria-current={item.current ? 'page' : undefined}>
      <svg
        aria-hidden="true"
        className={item.iconClassName}
        width="20"
        height="20"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        {item.icon}
      </svg>
      {item.label}
    </a>
  );
}

export type SidebarProps = {
  /** The navigation landmark's name, e.g. t('nav.label'). */
  label: string;
  title?: ReactNode;
  items: SidebarItem[];
  /** Pinned to the bottom (Settings). */
  footer?: SidebarItem[];
  className?: string;
};

export function Sidebar({ label, title, items, footer = [], className }: SidebarProps) {
  return (
    <nav className={cx('sidebar', className)} aria-label={label}>
      {title && <div className="sidebar-name">{title}</div>}
      {items.map((item) => (
        <SidebarLink key={item.key} item={item} />
      ))}
      <div className="grow" />
      {footer.map((item) => (
        <SidebarLink key={item.key} item={item} />
      ))}
    </nav>
  );
}
