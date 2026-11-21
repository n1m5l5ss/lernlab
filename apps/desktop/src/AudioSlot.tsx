// The card editor's audio slot: choose a file, or record your own voice (up to 60 s, Opus), play it back,
// record it again or remove it. The recording is saved in media/ through the `media.record` handler.
import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { api } from './api';
import { playMedia, stopMedia } from './audio';
import { formatNumber } from './i18n';
import { MIC_ONLY, micProblem, recorderOptions, recordingType, secondsLeft } from './recorder-logic';

/** Small outline icons beside the button text (the same drawing as the exercises' speaker and microphone). */
const ICONS = {
  mic: (
    <>
      <rect x="9" y="3" width="6" height="11" rx="3" />
      <path d="M5 11a7 7 0 0014 0M12 18v3" />
    </>
  ),
  play: (
    <>
      <path d="M4 9v6h4l5 4V5L8 9z" />
      <path d="M16 9a4 4 0 010 6" />
    </>
  ),
  stop: <rect x="6" y="6" width="12" height="12" rx="2" />,
};
const Icon = ({ name }: { name: keyof typeof ICONS }) => (
  <svg
    aria-hidden="true"
    width="20"
    height="20"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    {ICONS[name]}
  </svg>
);

export function AudioSlot({
  file,
  onChange,
  onUpload,
  onBusy,
  onError,
}: {
  file: string;
  onChange: (file: string) => void;
  onUpload: (f?: File) => void;
  /** +1 while recording or saving (the card can't be saved meanwhile), -1 when done. */
  onBusy: (delta: 1 | -1) => void;
  onError: (e: unknown) => void;
}) {
  const { t } = useTranslation();
  const type = useMemo(
    () =>
      recordingType(
        typeof MediaRecorder === 'undefined' || !navigator.mediaDevices
          ? undefined
          : (x) => MediaRecorder.isTypeSupported(x),
      ),
    [],
  );
  const [left, setLeft] = useState<number | null>(null);
  const [playing, setPlaying] = useState(false);
  const [status, setStatus] = useState('');
  const recorder = useRef<MediaRecorder | null>(null);
  const discard = useRef(false);
  const asking = useRef(false);

  // Leaving the editor mid-recording drops the recording and frees the microphone.
  useEffect(
    () => () => {
      discard.current = true;
      if (recorder.current?.state === 'recording') recorder.current.stop();
      stopMedia();
    },
    [],
  );

  const start = async () => {
    if (!type || asking.current || recorder.current) return;
    stopMedia();
    setPlaying(false);
    let stream: MediaStream;
    asking.current = true;
    try {
      stream = await navigator.mediaDevices.getUserMedia(MIC_ONLY);
    } catch (e) {
      setStatus(t(`browse.editor.record.problem.${micProblem(e)}`));
      return;
    } finally {
      asking.current = false;
    }
    if (discard.current) return stream.getTracks().forEach((track) => track.stop());
    const rec = new MediaRecorder(stream, recorderOptions(type));
    const chunks: Blob[] = [];
    const startedAt = Date.now();
    const tick = setInterval(() => {
      const s = secondsLeft(startedAt, Date.now());
      setLeft(s);
      if (s === 0 && rec.state === 'recording') rec.stop();
    }, 250);
    rec.ondataavailable = (e) => {
      if (e.data.size) chunks.push(e.data);
    };
    rec.onstop = async () => {
      clearInterval(tick);
      stream.getTracks().forEach((track) => track.stop());
      recorder.current = null;
      setLeft(null);
      try {
        if (discard.current || !chunks.length) return;
        const r = await api.saveRecording(new Blob(chunks, { type: rec.mimeType || type }));
        onChange(r.file);
        setStatus(t('browse.editor.record.saved'));
      } catch (e) {
        setStatus('');
        onError(e);
      } finally {
        onBusy(-1);
      }
    };
    recorder.current = rec;
    onBusy(1);
    rec.start(1000);
    setLeft(secondsLeft(startedAt, startedAt));
    setStatus(t('browse.editor.record.started'));
  };
  const stop = () => {
    if (recorder.current?.state === 'recording') recorder.current.stop();
  };
  const play = async () => {
    if (playing) {
      stopMedia();
      setPlaying(false);
      return;
    }
    setPlaying(true);
    await playMedia(file);
    setPlaying(false);
  };
  const recording = left !== null;

  return (
    <span className="editor-audio">
      {file && !recording ? (
        <span className="editor-slot">
          {t('browse.editor.mediaSet.audio')}
          <button className="btn ghost" onClick={play}>
            <Icon name={playing ? 'stop' : 'play'} />
            {playing ? t('browse.editor.record.stopPlaying') : t('browse.editor.record.play')}
          </button>
          <button className="btn ghost" onClick={() => onChange('')} aria-label={t('browse.editor.mediaRemove.audio')}>
            ✕
          </button>
        </span>
      ) : (
        !recording && (
          <label className="btn ghost editor-slot">
            {t('browse.editor.mediaAdd.audio')}
            <input type="file" hidden accept="audio/*" onChange={(e) => onUpload(e.target.files?.[0])} />
          </label>
        )
      )}
      {type && (
        <button
          className={`btn ghost editor-slot${recording ? ' editor-recording' : ''}`}
          onClick={recording ? stop : start}
        >
          <Icon name={recording ? 'stop' : 'mic'} />
          {recording
            ? t('browse.editor.record.stop', { seconds: formatNumber(left ?? 0) })
            : file
              ? t('browse.editor.record.again')
              : t('browse.editor.record.start')}
        </button>
      )}
      <span className="small muted" role="status">
        {status}
      </span>
    </span>
  );
}
