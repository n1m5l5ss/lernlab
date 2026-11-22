// The case of the card being asked (core/cases.ts, #209), or nothing for a card without one.
import { useTranslation } from 'react-i18next';
import { caseHtml, caseOf } from '@lernlab/core/cases';
import type { Item } from '@lernlab/core/types';
import { CasePanel } from './components';
import { Rich } from './rich';

export function CaseFor({ item }: { item?: Pick<Item, 'extra'> | null }) {
  const { t } = useTranslation();
  const text = item ? caseOf(item) : '';
  if (!text) return null;
  return (
    <CasePanel label={t('ex.case.label')}>
      <Rich html={caseHtml(text)} />
    </CasePanel>
  );
}
