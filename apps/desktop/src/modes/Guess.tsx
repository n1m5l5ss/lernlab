// Guess first (core/guess.ts): a new topic's questions before its cards are met. The learner guesses, then sees
// the answer. Practice only: nothing here is checked, scored or saved, and there is no clock.
// Try first (#218) is the same round with one problem of a maths or science unit: the learner writes an attempt,
// then compares it with the worked solution.
import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { guessCard } from '@lernlab/core/guess';
import type { Block } from '@lernlab/core/types';
import { useKeys, type BlockResult, type Ctx } from '../ctx';
import { Media, Rich } from '../rich';
import { CodeBlock } from '../code-block';
import { Button, Input } from '../components';
import { GUESS_START, guessKey, guessStep, type GuessAction, type GuessState } from '../guess-logic';

const MAC = typeof navigator !== 'undefined' && /Mac/.test(navigator.platform);

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
  const tryFirst = !!block.tryFirst;
  const tk = tryFirst ? 'session.tryFirst' : 'session.guess';
  useKeys((e) => {
    if (e.target instanceof HTMLButtonElement) return; // the focused button handles its own Enter
    // An attempt has several lines: Enter is a new line there, Ctrl/Cmd+Enter shows the solution.
    if (e.target instanceof HTMLTextAreaElement && !(e.ctrlKey || e.metaKey)) return;
    const a = guessKey(e.key, s, card.choices.length);
    if (!a) return;
    e.preventDefault();
    act(a);
  });

  const guessed = s.picked !== null ? card.choices[s.picked] : s.guess.trim();
  return (
    <div className="guess">
      <div className="row guess-head">
        <div className="blocktitle grow">{t(`${tk}.title`, { topic: block.topic })}</div>
        <Button variant="ghost" onClick={end}>
          {t(`${tk}.skip`)}
        </Button>
      </div>
      <p className="small muted guess-note">{t(`${tk}.kind`)}</p>
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
        {!s.revealed && tryFirst && (
          <>
            <label className="lbl" htmlFor="try-input">
              {t('session.tryFirst.yours')}
            </label>
            <textarea
              id="try-input"
              className="input try-input"
              value={s.guess}
              autoFocus
              autoComplete="off"
              spellCheck={false}
              aria-describedby="try-hint"
              onChange={(e) => act({ type: 'type', text: e.target.value })}
            />
            <p id="try-hint" className="small muted">
              {t('session.tryFirst.optional')}
            </p>
          </>
        )}
        {!s.revealed && !tryFirst && card.choices.length === 0 && (
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
            {guessed && <div className="small muted try-yours">{t(`${tk}.yourGuess`, { guess: guessed })}</div>}
            {card.steps && (
              <>
                <div className="try-solution">{t('session.tryFirst.solution')}</div>
                <ol className="worked-steps">
                  {card.steps.map((step, i) => (
                    <li key={i} className="worked-step">
                      {step.label && (
                        <div className="worked-label">
                          <Rich html={step.label} />
                        </div>
                      )}
                      <div className="worked-result">
                        <Rich html={step.result} />
                      </div>
                    </li>
                  ))}
                </ol>
              </>
            )}
            <div className="ans">
              {t('session.guess.answer')} <Rich html={card.answer} />
            </div>
            {tryFirst && <p className="small muted">{t('session.tryFirst.compare')}</p>}
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
            {t(`${tk}.show`)}{' '}
            <span className="kbd">
              {t(tryFirst ? (MAC ? 'ex.explain.checkKeysMac' : 'ex.explain.checkKeys') : 'keys.enter')}
            </span>
          </Button>
        ) : (
          <Button ref={nextRef} variant="primary" onClick={() => act({ type: 'next' })}>
            {s.i + 1 >= total ? t(`${tk}.toCards`) : t('session.guess.next')}{' '}
            <span className="kbd">{t('keys.enter')}</span>
          </Button>
        )}
      </div>
    </div>
  );
}
