// Concept map from memory (#219): link a topic's terms from memory, then compare with the author's map.
// The map is a list of links: pick a term, say how it relates, pick the other term. Everything works with the
// keyboard and a screen reader; the picture is a second view of the same list, never the only way in.
// Practice only: nothing is saved, graded or scheduled, and there is no timer.
import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { MAP_LABEL_MAX_LENGTH, addLink, compareMaps, layoutTerms, type MapLink } from '@lernlab/core/conceptmap';
import type { OutputOf } from '../backend/handlers';
import { api } from './api';
import { ConceptMapView, SideBySide } from './components';

type AuthorMap = OutputOf<'conceptmap.get'>;

export function ConceptMap({ deckId, topic, onDone }: { deckId: number; topic: string; onDone: () => void }) {
  const { t } = useTranslation();
  const [map, setMap] = useState<AuthorMap | null>(null);
  const [error, setError] = useState('');
  const [step, setStep] = useState<'draw' | 'compare'>('draw');
  const [links, setLinks] = useState<MapLink[]>([]);
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [label, setLabel] = useState('');
  const [status, setStatus] = useState('');
  const heading = useRef<HTMLHeadingElement>(null);
  const fromRef = useRef<HTMLSelectElement>(null);

  useEffect(() => {
    api
      .mapGet(deckId, topic)
      .then(setMap)
      .catch((e: unknown) => setError(e instanceof Error ? e.message : String(e)));
  }, [deckId, topic]);
  useEffect(() => heading.current?.focus(), [step, map === null]);
  const nodes = useMemo(() => layoutTerms(map?.terms ?? []), [map]);

  if (error)
    return (
      <main className="summary">
        <p role="alert" className="feedback wrong">
          {error}
        </p>
        <div className="summary-actions">
          <button className="btn primary" onClick={onDone}>
            {t('cmap.back')}
          </button>
        </div>
      </main>
    );
  if (!map) return <div className="wrap muted">{t('app.loading')}</div>;

  const text = (l: Pick<MapLink, 'from' | 'label' | 'to'>) =>
    l.label ? t('cmap.link', { from: l.from, label: l.label, to: l.to }) : t('cmap.linkPlain', l);
  const add = (e: FormEvent) => {
    e.preventDefault();
    if (!from || !to) return setStatus(t('cmap.pickBoth'));
    const next = addLink(links, from, label, to);
    if (next === 'same') return setStatus(t('cmap.sameTerm'));
    if (next === 'linked') return setStatus(t('cmap.alreadyLinked', { from, to }));
    setLinks(next);
    setStatus(t('cmap.added', { link: text(next[next.length - 1]) }));
    setLabel('');
    setTo('');
    fromRef.current?.focus();
  };
  const remove = (i: number) => {
    setStatus(t('cmap.removed', { link: text(links[i]) }));
    setLinks(links.filter((_, k) => k !== i));
    fromRef.current?.focus();
  };
  const result = compareMaps(links, map.links);
  const pair = (a: string, b: string) => [a.toLowerCase(), b.toLowerCase()].sort().join('\n');
  const matchedPairs = new Set(result.matched.map((m) => pair(m.from, m.to)));
  const tone = (l: MapLink, other: 'missing' | 'extra') =>
    matchedPairs.has(pair(l.from, l.to)) ? ('matched' as const) : other;
  const select = (id: string, value: string, set: (v: string) => void, lbl: string, ref?: typeof fromRef) => (
    <label className="cmap-field" htmlFor={id}>
      <span>{lbl}</span>
      <select id={id} ref={ref} className="input" value={value} onChange={(e) => set(e.target.value)}>
        <option value="">{t('cmap.choose')}</option>
        {map.terms.map((term) => (
          <option key={term} value={term}>
            {term}
          </option>
        ))}
      </select>
    </label>
  );
  const list = (id: string, title: string, note: string, rows: string[]) => (
    <section className="panel cmap-panel" aria-labelledby={id}>
      <h2 id={id}>{title}</h2>
      {rows.length ? (
        <ul className="cmap-list">
          {rows.map((r, i) => (
            <li key={i}>{r}</li>
          ))}
        </ul>
      ) : (
        <p className="muted">{note}</p>
      )}
    </section>
  );

  return (
    <main className="summary cmap">
      <p className="summary-kicker">{t('cmap.kicker')}</p>
      <h1 ref={heading} tabIndex={-1}>
        {map.topic}
      </h1>
      {step === 'draw' ? (
        <>
          <p className="summary-note">{t('cmap.prompt', { count: map.terms.length })}</p>
          <section className="panel cmap-panel" aria-labelledby="cmap-terms">
            <h2 id="cmap-terms">{t('cmap.terms')}</h2>
            <ul className="cmap-terms">
              {map.terms.map((term) => (
                <li key={term}>{term}</li>
              ))}
            </ul>
            <form className="cmap-add" onSubmit={add} aria-label={t('cmap.addTitle')}>
              {select('cmap-from', from, setFrom, t('cmap.from'), fromRef)}
              <label className="cmap-field" htmlFor="cmap-label">
                <span>{t('cmap.label')}</span>
                <input
                  id="cmap-label"
                  className="input"
                  value={label}
                  maxLength={MAP_LABEL_MAX_LENGTH}
                  placeholder={t('cmap.labelPlaceholder')}
                  onChange={(e) => setLabel(e.target.value)}
                />
              </label>
              {select('cmap-to', to, setTo, t('cmap.to'))}
              <button type="submit" className="btn">
                {t('cmap.add')}
              </button>
            </form>
            <p className="small muted" role="status">
              {status}
            </p>
          </section>
          <section className="panel cmap-panel" aria-labelledby="cmap-yours">
            <h2 id="cmap-yours">{t('cmap.yourLinks', { count: links.length })}</h2>
            {links.length ? (
              <ul className="cmap-list">
                {links.map((l, i) => (
                  <li key={`${l.from}\n${l.to}`}>
                    <span className="grow">{text(l)}</span>
                    <button
                      className="btn ghost"
                      onClick={() => remove(i)}
                      aria-label={t('cmap.removeLink', { link: text(l) })}
                    >
                      {t('cmap.remove')}
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="muted">{t('cmap.noLinks')}</p>
            )}
            <ConceptMapView nodes={nodes} links={links} label={t('cmap.yourMapAlt', { count: links.length })} />
          </section>
          <div className="summary-actions">
            <button className="btn primary" onClick={() => setStep('compare')}>
              {t('cmap.compare')}
            </button>
            <button className="btn ghost" onClick={onDone}>
              {t('cmap.back')}
            </button>
          </div>
        </>
      ) : (
        <>
          <p role="status" className="summary-note">
            {t('cmap.result', { matched: result.matched.length, count: map.links.length })} {t('cmap.resultNote')}
          </p>
          <SideBySide
            label={t('cmap.sideBySide')}
            left={
              <figure className="cmap-figure">
                <figcaption>{t('cmap.yours')}</figcaption>
                <ConceptMapView
                  nodes={nodes}
                  links={links.map((l) => ({ ...l, tone: tone(l, 'extra') }))}
                  label={t('cmap.yourMapAlt', { count: links.length })}
                />
              </figure>
            }
            right={
              <figure className="cmap-figure">
                <figcaption>{t('cmap.authors')}</figcaption>
                <ConceptMapView
                  nodes={nodes}
                  links={map.links.map((l) => ({ ...l, tone: tone(l, 'missing') }))}
                  label={t('cmap.authorsMapAlt', { count: map.links.length })}
                />
              </figure>
            }
          />
          <p className="small muted">{t('cmap.legend')}</p>
          {list(
            'cmap-matched',
            t('cmap.matched', { count: result.matched.length }),
            t('cmap.noneMatched'),
            result.matched.map((m) =>
              [
                t('cmap.pair', { from: m.from, to: m.to }),
                t('cmap.words', {
                  yours: m.yours || t('cmap.noLabel'),
                  authors: m.authors || t('cmap.noLabel'),
                }),
                m.reversed ? t('cmap.reversed') : '',
              ]
                .filter(Boolean)
                .join(' '),
            ),
          )}
          {list(
            'cmap-missing',
            t('cmap.missing', { count: result.missing.length }),
            t('cmap.noneMissing'),
            result.missing.map(text),
          )}
          {list(
            'cmap-extra',
            t('cmap.extra', { count: result.extra.length }),
            t('cmap.noneExtra'),
            result.extra.map(text),
          )}
          <div className="summary-actions">
            <button className="btn primary" onClick={onDone}>
              {t('cmap.done')}
            </button>
            <button className="btn ghost" onClick={() => setStep('draw')}>
              {t('cmap.keepDrawing')}
            </button>
            <button
              className="btn ghost"
              onClick={() => {
                setLinks([]);
                setStatus('');
                setStep('draw');
              }}
            >
              {t('cmap.again')}
            </button>
          </div>
        </>
      )}
    </main>
  );
}
