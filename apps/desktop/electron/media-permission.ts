// Which permission requests the window may have: the microphone, for LernLab's own page only
// (recording audio on a card, speaking rounds). Never the camera, the screen or anything else.

/** The parts of Electron's permission request details we read. */
export type PermissionDetails = { mediaTypes?: string[]; requestingUrl?: string };

export function allowPermission(
  permission: string,
  details: PermissionDetails,
  isAppUrl: (url: string) => boolean,
): boolean {
  if (permission !== 'media') return false;
  const types = details.mediaTypes ?? [];
  return types.length > 0 && types.every((t) => t === 'audio') && isAppUrl(details.requestingUrl ?? '');
}
