// Code on a card: real text in a <pre> (selectable, whitespace kept, read by screen readers), coloured by
// token class from the design tokens. Card text is never injected as HTML here: every token is a text node.
import { useId, useMemo, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { GAP, highlight, langName } from '@lernlab/core/code';

function Tokens({ code, lang, gap }: { code: string; lang: string; gap?: ReactNode }) {
  const tokens = useMemo(() => highlight(code, lang), [code, lang]);
  const out: ReactNode[] = [];
  tokens.forEach((tk, i) =>
    tk.text.split(GAP).forEach((text, j) => {
      if (j) out.push(<span key={`gap${i}`}>{gap}</span>);
      if (text)
        out.push(
          tk.kind ? (
            <span key={`${i}.${j}`} className={`tok-${tk.kind}`}>
              {text}
            </span>
          ) : (
            text
          ),
        );
    }),
  );
  return <>{out}</>;
}

/** A code snippet, named by its language. `gap` takes the place of the fill-the-token gap (GAP) in the code. */
export function CodeBlock({ code, lang, gap }: { code: string; lang: string; gap?: ReactNode }) {
  const { t } = useTranslation();
  const id = useId();
  const name = langName(lang);
  return (
    <figure className="code-block" aria-labelledby={id}>
      <figcaption id={id} className="code-lang">
        {name ? t('ex.code.language', { lang: name }) : t('ex.code.plain')}
      </figcaption>
      {/* Focusable so a long line can be scrolled with the keyboard. */}
      <pre className="code" tabIndex={0}>
        <code>
          <Tokens code={code} lang={lang} gap={gap} />
        </code>
      </pre>
    </figure>
  );
}

/** One line of code (a step in order-the-lines), indentation kept. */
export const CodeLine = ({ code, lang }: { code: string; lang: string }) => (
  <code className="code code-line">
    <Tokens code={code} lang={lang} />
  </code>
);
