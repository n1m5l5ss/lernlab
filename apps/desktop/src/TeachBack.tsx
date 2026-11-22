// Teach-back (#208): explain a mastered tag to a beginner, by typing or by recording your voice, then compare
// with the tag's key points and tick the ones you missed. The cards behind them can be practised.
// Nothing is saved: the text and the recording live in this screen only (the recording is never written to
// disk or sent anywhere), and nothing here touches the schedule. The 60 seconds is a suggestion, not a timer.
import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { TEACH_SECONDS, missedCards, type TeachPoint } from '@lernlab/core/teachback';
import { api } from './api';
import { KeyPointChecklist } from './components';
import { MIC_ONLY, clock, micProblem, recorderOptions, recordingType } from './recorder-logic';

/** A recording is kept in memory, so it stops by itself after five minutes. */
const RECORDING_MAX_SECONDS = 300;

export function TeachBack({
  tag,
  onPractise,
  onDone,
}: {
  tag: string;
  /** Practise the cards behind the missed points. */
  onPractise: (ids: number[]) => void;
  onDone: () => void;
}) {
  const { t } = useTranslation();
  const [points, setPoints] = useState<TeachPoint[] | null>(null);
  const [error, setError] = useState('');
  const [step, setStep] = useState<'explain' | 'check'>('explain');
  const [text, setText] = useState('');
  const [missed, setMissed] = useState<boolean[]>([]);
  const [seconds, setSeconds] = useState<number | null>(null);
  const [audio, setAudio] = useState('');
  const [status, setStatus] = useState('');
  const heading = useRef<HTMLHeadingElement>(null);
  const recorder = useRef<MediaRecorder | null>(null);
  const gone = useRef(false);
  const url = useRef('');
  const type = useMemo(
    () =>
      recordingType(
        typeof MediaRecorder === 'undefined' || !navigator.mediaDevices
          ? undefined
          : (x) => MediaRecorder.isTypeSupported(x),
      ),
    [],
  );

  useEffect(() => {
    api
      .teachPoints(tag)
      .then(setPoints)
      .catch((e: unknown) => setError(e instanceof Error ? e.message : String(e)));
  }, [tag]);
  useEffect(() => heading.current?.focus(), [step, points === null]);
  // Leaving drops the recording and frees the microphone.
  useEffect(
    () => () => {
      gone.current = true;
      if (recorder.current?.state === 'recording') recorder.current.stop();
      if (url.current) URL.revokeObjectURL(url.current);
    },
    [],
  );

  const record = async () => {
    if (!type || recorder.current) return;
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia(MIC_ONLY);
    } catch (e) {
      setStatus(t(`browse.editor.record.problem.${micProblem(e)}`));
      return;
    }
    if (gone.current) return stream.getTracks().forEach((track) => track.stop());
    const rec = new MediaRecorder(stream, recorderOptions(type));
    const chunks: Blob[] = [];
    const startedAt = Date.now();
    const tick = setInterval(() => {
      const s = (Date.now() - startedAt) / 1000;
      setSeconds(s);
      if (s >= RECORDING_MAX_SECONDS && rec.state === 'recording') rec.stop();
    }, 250);
    rec.ondataavailable = (e) => {
      if (e.data.size) chunks.push(e.data);
    };
    rec.onstop = () => {
      clearInterval(tick);
      stream.getTracks().forEach((track) => track.stop());
      recorder.current = null;
      if (gone.current) return;
      setSeconds(null);
      if (!chunks.length) return;
      if (url.current) URL.revokeObjectURL(url.current);
      url.current = URL.createObjectURL(new Blob(chunks, { type: rec.mimeType || type }));
      setAudio(url.current);
      setStatus(t('teach.recorded'));
    };
    recorder.current = rec;
    rec.start(1000);
    setSeconds(0);
    setStatus(t('teach.recording'));
  };
  const stop = () => {
    if (recorder.current?.state === 'recording') recorder.current.stop();
  };
  const compare = () => {
    stop();
    setStep('check');
  };

  if (error)
    return (
      <main className="summary">
        <p role="alert" className="feedback wrong">
          {error}
        </p>
        <div className="summary-actions">
          <button className="btn primary" onClick={onDone}>
            {t('teach.back')}
          </button>
        </div>
      </main>
    );
  if (!points) return <div className="wrap muted">{t('app.loading')}</div>;
  const recording = seconds !== null;
  const ids = missedCards(points, missed);

  return (
    <main className="summary teach">
      <p className="summary-kicker">{t('teach.kicker')}</p>
      <h1 ref={heading} tabIndex={-1}>
        {tag}
      </h1>
      {step === 'explain' ? (
        <>
          <p className="summary-note">{t('teach.prompt', { tag, seconds: TEACH_SECONDS })}</p>
          <section className="panel teach-panel">
            <label className="lbl" htmlFor="teach-text">
              {t('teach.typeLabel')}
            </label>
            <textarea
              id="teach-text"
              className="input"
              rows={6}
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder={t('teach.typePlaceholder')}
            />
            {type && (
              <div className="teach-record">
                <button
                  className={`btn ghost${recording ? ' teach-recording' : ''}`}
                  onClick={recording ? stop : record}
                >
                  {recording
                    ? t('teach.stop', { time: clock(seconds ?? 0) })
                    : audio
                      ? t('teach.recordAgain')
                      : t('teach.record')}
                </button>
                <span className="small muted" role="status">
                  {status}
                </span>
              </div>
            )}
            {audio && !recording && <audio controls src={audio} aria-label={t('teach.yourRecording')} />}
            <p className="small muted">{t('teach.private')}</p>
          </section>
          <div className="summary-actions">
            <button className="btn primary" onClick={compare}>
              {t('teach.compare')}
            </button>
            <button className="btn ghost" onClick={onDone}>
              {t('teach.back')}
            </button>
          </div>
        </>
      ) : (
        <>
          <p className="summary-note">{t('teach.checkNote')}</p>
          {(text.trim() || audio) && (
            <section className="panel teach-panel" aria-labelledby="teach-yours">
              <h2 id="teach-yours">{t('teach.yours')}</h2>
              {text.trim() && <p className="teach-text">{text}</p>}
              {audio && <audio controls src={audio} aria-label={t('teach.yourRecording')} />}
            </section>
          )}
          {points.length ? (
            <KeyPointChecklist
              legend={t('teach.missedLegend')}
              points={points.map((p) => (
                <>
                  {p.text}
                  {p.about && <span className="small muted teach-about">{p.about}</span>}
                </>
              ))}
              checked={points.map((_, i) => !!missed[i])}
              onToggle={(i) => setMissed(points.map((_, k) => (k === i ? !missed[k] : !!missed[k])))}
            />
          ) : (
            <p>{t('teach.noPoints')}</p>
          )}
          <p role="status" className="summary-note">
            {points.length > 0 && (ids.length ? t('teach.missedCount', { count: ids.length }) : t('teach.allCovered'))}
          </p>
          <div className="summary-actions">
            {ids.length > 0 && (
              <button className="btn primary" onClick={() => onPractise(ids)}>
                {t('teach.practise', { count: ids.length })}
              </button>
            )}
            <button className={ids.length ? 'btn ghost' : 'btn primary'} onClick={onDone}>
              {t('teach.done')}
            </button>
            <button className="btn ghost" onClick={() => setStep('explain')}>
              {t('teach.again')}
            </button>
          </div>
        </>
      )}
    </main>
  );
}
