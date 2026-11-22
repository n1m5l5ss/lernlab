// The progress card (#214) as the learner sees and prints it: the week, a few numbers, this week's goal and the
// decks. It holds no text of its own: the caller passes every word in (CardText, from t()). The same text makes
// the saved picture (progress-card.ts).
import type { CardText } from '../progress-card';
import { cx } from './logic';
import { ProgressBar } from './ProgressBar';

export type ProgressCardProps = { text: CardText; className?: string };

function Row({ label, value, share }: { label: string; value: string; share: number }) {
  return (
    <li>
      <span className="progress-card-row">
        <b>{label}</b>
        <span>{value}</span>
      </span>
      <ProgressBar label={label} value={Math.round(share * 100)} max={100} valueText={value} />
    </li>
  );
}

export function ProgressCard({ text, className }: ProgressCardProps) {
  return (
    <article className={cx('progress-card', className)} aria-label={text.title}>
      <header>
        <h3>{text.title}</h3>
        <p>{text.subtitle}</p>
      </header>
      <dl className="progress-card-stats">
        {text.stats.map((s) => (
          <div key={s.label}>
            <dt>{s.label}</dt>
            <dd>{s.value}</dd>
          </div>
        ))}
      </dl>
      {text.goals.length > 0 && (
        <section>
          <h4>{text.goalsTitle}</h4>
          <ul>
            {text.goals.map((g) => (
              <Row key={g.label} {...g} />
            ))}
          </ul>
        </section>
      )}
      {text.note && <p className="progress-card-note">{text.note}</p>}
      {text.decks.length > 0 && (
        <section>
          <h4>{text.decksTitle}</h4>
          <ul>
            {text.decks.map((d, i) => (
              <Row key={i} label={d.name} value={d.detail} share={d.share} />
            ))}
          </ul>
        </section>
      )}
      <footer>{text.footer}</footer>
    </article>
  );
}
