// The if-then study plan (#204): "After I ___, I'll study for ___", an optional backup plan, and a
// preview of the reminder in your own words. Used on Welcome and in Settings. The words you type are
// shown as text (React escapes them) inside a translated sentence; they are never HTML.
import { useTranslation } from 'react-i18next';
import { PLAN_MINUTES, PLAN_TEXT_MAX } from '@lernlab/core/studyplan';
import { Input, Select } from './components';
import { planPreview, type PlanDraft } from './plan-logic';

/** Your plan as sentences: the translated frame with your words put in. */
export function PlanSentence({ draft }: { draft: PlanDraft }) {
  const { t } = useTranslation();
  const p = planPreview(draft);
  if (!p) return null;
  return (
    <>
      {t('plan.sentence', { after: p.after, count: p.count })}
      {p.backup && <> {t('plan.backupSentence', { backup: p.backup })}</>}
    </>
  );
}

/**
 * The three fields and the preview. `onCommit` saves: Settings calls it when a text field loses focus
 * or the minutes change; Welcome saves once, when you leave the screen.
 */
export function PlanFields({
  idPrefix,
  draft,
  onChange,
  onCommit,
  disabled = false,
  className = 'field',
}: {
  idPrefix: string;
  draft: PlanDraft;
  onChange: (next: PlanDraft) => void;
  onCommit?: (next: PlanDraft) => void;
  disabled?: boolean;
  className?: string;
}) {
  const { t } = useTranslation();
  const set = (patch: Partial<PlanDraft>, commit = false) => {
    const next = { ...draft, ...patch };
    onChange(next);
    if (commit) onCommit?.(next);
  };
  return (
    <div className="plan-fields">
      <Input
        id={`${idPrefix}-after`}
        label={t('plan.after')}
        className={className}
        value={draft.after}
        maxLength={PLAN_TEXT_MAX}
        placeholder={t('plan.afterPlaceholder')}
        autoComplete="off"
        disabled={disabled}
        onChange={(e) => set({ after: e.target.value })}
        onBlur={() => onCommit?.(draft)}
      />
      <Select
        id={`${idPrefix}-minutes`}
        label={t('plan.minutes')}
        className={className}
        value={draft.minutes}
        disabled={disabled}
        onChange={(e) => set({ minutes: Number(e.target.value) }, true)}
      >
        {PLAN_MINUTES.map((m) => (
          <option key={m} value={m}>
            {t('home.lengthMinutes', { count: m })}
          </option>
        ))}
      </Select>
      <Input
        id={`${idPrefix}-backup`}
        label={t('plan.backup')}
        hint={t('plan.backupHint')}
        className={className}
        value={draft.backup}
        maxLength={PLAN_TEXT_MAX}
        placeholder={t('plan.backupPlaceholder')}
        autoComplete="off"
        disabled={disabled}
        onChange={(e) => set({ backup: e.target.value })}
        onBlur={() => onCommit?.(draft)}
      />
      {planPreview(draft) && (
        <figure className="plan-preview">
          <figcaption>{t('plan.preview')}</figcaption>
          <blockquote>
            <PlanSentence draft={draft} />
          </blockquote>
        </figure>
      )}
    </div>
  );
}

/** Next to the streak on Home: habits take weeks, and one missed day barely matters (Lally et al. 2010). */
export function HabitNote({ onHide }: { onHide: () => void }) {
  const { t } = useTranslation();
  return (
    <p className="habit-note">
      <span>{t('plan.habitNote')}</span>{' '}
      <button type="button" className="habit-note-hide" onClick={onHide}>
        {t('plan.habitHide')}
      </button>
    </p>
  );
}
