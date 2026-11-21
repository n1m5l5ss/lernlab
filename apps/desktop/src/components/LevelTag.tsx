// The level of a question (#198): recall, apply or analyse, as a small word tag next to the question.
// It holds no text of its own: the caller passes the level's name, from t('levels.<level>').
import type { Level } from '@lernlab/core/variants';
import { cx } from './logic';

export type LevelTagProps = { level: Level; children: string; className?: string };

export function LevelTag({ level, children, className }: LevelTagProps) {
  return <span className={cx('level-tag', `level-${level}`, className)}>{children}</span>;
}
