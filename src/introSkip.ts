/** Session flag: the intro already played (or was skipped) in this tab. */
export const INTRO_SEEN_KEY = 'nutation-intro-seen';

export function shouldSkipIntro(
  search: string,
  storage: Pick<Storage, 'getItem'>,
): boolean {
  const q = search.startsWith('?') ? search.slice(1) : search;
  if (new URLSearchParams(q).has('skip')) return true;
  return storage.getItem(INTRO_SEEN_KEY) === '1';
}

export function markIntroSeen(storage: Pick<Storage, 'setItem'>): void {
  storage.setItem(INTRO_SEEN_KEY, '1');
}

/**
 * Whether to drop the traced rosette and open on the stamped mark instead.
 *
 * The trace needs a wide canvas. The rosette is two world units across, so on a
 * phone it has to shrink until it reads as a scribble, and the Lagrangian under
 * it lands at 12px. Matching the CSS breakpoint keeps behaviour and layout in
 * agreement; the second query catches a phone turned landscape, which is wide
 * but far too short.
 */
export function shouldSkipTrace(matches: (query: string) => boolean): boolean {
  return (
    matches('(max-width: 720px)') || matches('(pointer: coarse) and (max-height: 520px)')
  );
}
