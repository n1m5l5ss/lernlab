// The placeholder for internet media that is turned off (#177), and the src helper the card views share.
import { useTranslation } from 'react-i18next';
export { mediaSrc } from './remote-media';

/** Shown instead of a picture or video that a deck links from the internet while that is off (#177). */
export function BlockedMedia({ kind }: { kind: 'image' | 'video' }) {
  const { t } = useTranslation();
  return (
    <div className="media media-blocked" role="note">
      {t(`media.blocked.${kind}`)}
    </div>
  );
}
