// Guess first (core/guess.ts): a new topic's questions before its cards are met. The learner guesses, then sees
// the answer. Practice only: nothing here is checked, scored or saved, and there is no clock.
import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { guessCard } from '@lernlab/core/guess';
import type { Block } from '@lernlab/core/types';
import { useKeys, type BlockResult, type Ctx } from '../ctx';
import { Media, Rich } from '../rich';
import { CodeBlock } from '../code-block';
import { Button, Input } from '../components';
import { GUESS_START, guessKey, guessStep, type GuessAction, type GuessState } from '../guess-logic';

export function GuessBlock({
  block,
  ctx,
  onDone,
  onStep,
}: {
  block: Extract<Block, { kind: 'guess' }>;
  ctx: Ctx;
  onDone: (r: BlockResult) => void;
  onStep: (s: { done: number; total: number }) => void;
}) {
  const { t } = useTranslation();
  const [s, setS] = useState<GuessState>(GUESS_START);
  const total = block.itemIds.length;
  const item = ctx.item(block.itemIds[s.i]);
  const card = useMemo(() => guessCard(item), [item]);
  const nextRef = useRef<HTMLButtonElement>(null);
  // Nothing is answered for real, so the block reports no answers: no XP, no perfect-block bonus.
  const end = () => onDone({ correct: 0, total: 0 });
  const act = (a: GuessAction) => {
    const n = guessStep(s, a, total);
    if (n === 'done') end();
    else setS(n);
  };
  useEffect(() => onStep({ done: s.i, total }), [s.i]);
  useEffect(() => {
    if (s.revealed) nextRef.current?.focus();
  }, [s.revealed]);
  useKeys((e) => {
    if (e.target instanceof HTMLButtonElement) return; // the focused button handles its own Enter
    const a = guessKey(e.key, s, card.choices.length);
    if (!a) return;
    e.preventDefault();
    act(a);
  });

  const guessed = s.picked !== null ? card.choices[s.picked] : s.guess.trim();
  return (
    <div className="guess">
      <div className="row guess-head">
        <div className="blocktitle grow">{t('session.guess.title', { topic: block.topic })}</div>
        <Button variant="ghost" onClick={end}>
          {t('session.guess.skip')}
        </Button>
      </div>
      <p className="small muted guess-note">{t('session.guess.kind')}</p>
      <div className="card flipcard" key={s.i}>
        <Media item={item} size="md" />
        <div className="prompt">
          <Rich html={card.prompt} />
        </div>
        {card.code && (
          <CodeBlock
            code={card.code.code}
            lang={card.code.lang}
            gap={<span className="code-gap">{t('session.guess.gap')}</span>}
          />
        )}
        {card.choices.length > 0 && (
          <div className="col" role="group" aria-label={t('session.guess.choices')}>
            {card.choices.map((c, i) => (
              <button
                key={i}
                className={`opt ${s.revealed && card.correct.includes(i) ? 'right' : ''}`}
                aria-pressed={s.picked === i}
                disabled={s.revealed}
                onClick={() => act({ type: 'pick', choice: i })}
              >
                <span className="k">{i + 1}</span>
                <Rich html={c} />
              </button>
            ))}
          </div>
        )}
        {!s.revealed && card.choices.length === 0 && (
          <Input
            id="guess-input"
            className="guess-input"
            label={t('session.guess.yours')}
            hint={t('session.guess.optional')}
            value={s.guess}
            autoFocus
            autoComplete="off"
            spellCheck={false}
            onChange={(e) => act({ type: 'type', text: e.target.value })}
          />
        )}
        {s.revealed && (
          // Not right/wrong feedback: a guess is never marked, the answer just follows.
          <div role="status" className="guess-answer">
            {guessed && <div className="small muted">{t('session.guess.yourGuess', { guess: guessed })}</div>}
            <div className="ans">
              {t('session.guess.answer')} <Rich html={card.answer} />
            </div>
            {card.explanation && (
              <div className="small" style={{ marginTop: 6 }}>
                <Rich html={card.explanation} />
              </div>
            )}
          </div>
        )}
      </div>
      <div className="actions">
        {!s.revealed ? (
          <Button variant="primary" onClick={() => act({ type: 'reveal' })}>
            {t('session.guess.show')} <span className="kbd">{t('keys.enter')}</span>
          </Button>
        ) : (
          <Button ref={nextRef} variant="primary" onClick={() => act({ type: 'next' })}>
            {s.i + 1 >= total ? t('session.guess.toCards') : t('session.guess.next')}{' '}
            <span className="kbd">{t('keys.enter')}</span>
          </Button>
        )}
      </div>
    </div>
  );
}
