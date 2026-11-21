// Card: the surface with a hairline border that screens group content on.
import type { ComponentPropsWithRef } from 'react';
import { cx } from './logic';

export type CardProps = ComponentPropsWithRef<'div'> & {
  /** A <section> or <article> when the card is a group with its own heading. */
  as?: 'div' | 'section' | 'article';
};

export function Card({ as: Tag = 'div', className, ...rest }: CardProps) {
  return <Tag {...rest} className={cx('card', className)} />;
}
