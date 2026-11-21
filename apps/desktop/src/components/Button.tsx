// Button (style guide: docs/design/images/Style.png): one look per job, at least 44 px tall, visible focus.
import type { ComponentPropsWithRef } from 'react';
import { cx } from './logic';

export type ButtonVariant = 'default' | 'primary' | 'good' | 'ghost' | 'danger';

export type ButtonProps = ComponentPropsWithRef<'button'> & {
  /** primary: the one main action on a screen; good: confirm a correct answer; danger: deletes things. */
  variant?: ButtonVariant;
};

export function Button({ variant = 'default', className, ...rest }: ButtonProps) {
  return <button {...rest} className={cx('btn', variant !== 'default' && variant, className)} />;
}
