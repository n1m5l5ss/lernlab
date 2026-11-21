// "Reconnecting…" while main restarts the data process after a crash (#56). Desktop only: the web dev
// server has no separate data process. Shown above every screen, including a session, and never blocks it.
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { dataStatusKey } from './data-status-logic';

export function DataStatus() {
  const { t } = useTranslation();
  const bridge = typeof window !== 'undefined' ? window.lernlab?.data : undefined;
  const [key, setKey] = useState<string | null>(null);
  useEffect(() => {
    if (!bridge) return;
    bridge.status().then(
      (s) => setKey(dataStatusKey(s)),
      () => {},
    );
    bridge.onStatus((s) => setKey(dataStatusKey(s)));
  }, [bridge]);
  return (
    <div className="data-status-region" role="status" aria-live="polite">
      {key && (
        <p className={`data-status ${key === 'app.dataFailed' ? 'failed' : ''}`}>
          {key === 'app.reconnecting' && <span className="data-status-spinner" aria-hidden="true" />}
          {t(key)}
        </p>
      )}
    </div>
  );
}
