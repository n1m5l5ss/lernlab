// Input and Select: a labelled control with an optional hint and error, wired with aria-describedby and
// aria-invalid (WCAG 1.3.1, 3.3.1). The label and hint sit together in .field-text, so a layout such as
// a Settings row can put the control beside them through the wrapper's className.
import type { ComponentPropsWithRef, ReactNode } from 'react';
import { cx, fieldIds } from './logic';
import styles from './Field.module.css';

type FieldProps = {
  id: string;
  label: ReactNode;
  hint?: ReactNode;
  /** Shown under the control and announced; it also marks the control aria-invalid. */
  error?: ReactNode;
  /** The wrapper's class, for the layout around the control. */
  className?: string;
  /** The control's own class (default "input"). */
  controlClassName?: string;
};

type FrameProps = Omit<FieldProps, 'controlClassName'> & { hintId?: string; errorId?: string; children: ReactNode };

function FieldFrame({ id, label, hint, error, className, hintId, errorId, children }: FrameProps) {
  return (
    <div className={cx('field-control', className)}>
      <span className={styles['field-text']}>
        <label htmlFor={id}>{label}</label>
        {hint && (
          <span id={hintId} className={styles['field-hint']}>
            {hint}
          </span>
        )}
      </span>
      {children}
      {error && (
        <span id={errorId} className={styles['field-error']} role="alert">
          {error}
        </span>
      )}
    </div>
  );
}

export type InputProps = FieldProps & Omit<ComponentPropsWithRef<'input'>, 'id' | 'className'>;

export function Input({ id, label, hint, error, className, controlClassName = 'input', ...rest }: InputProps) {
  const { hintId, errorId, describedBy } = fieldIds(id, hint, error);
  return (
    <FieldFrame {...{ id, label, hint, error, className, hintId, errorId }}>
      <input
        {...rest}
        id={id}
        className={controlClassName}
        aria-describedby={describedBy}
        aria-invalid={error ? true : undefined}
      />
    </FieldFrame>
  );
}

export type SelectProps = FieldProps & Omit<ComponentPropsWithRef<'select'>, 'id' | 'className'>;

export function Select({ id, label, hint, error, className, controlClassName = 'input', ...rest }: SelectProps) {
  const { hintId, errorId, describedBy } = fieldIds(id, hint, error);
  return (
    <FieldFrame {...{ id, label, hint, error, className, hintId, errorId }}>
      <select
        {...rest}
        id={id}
        className={controlClassName}
        aria-describedby={describedBy}
        aria-invalid={error ? true : undefined}
      />
    </FieldFrame>
  );
}
