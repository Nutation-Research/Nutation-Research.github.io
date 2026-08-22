/**
 * The live Yuna embed.
 *
 * The frame holds a still until the reader actually reaches it, then loads the
 * viewer — which opens itself on the element and plays. Loading on approach
 * instead would spend the coach sequence off-screen, and loading a whole viewer
 * on a phone would spend a reader's data on panes that cannot fit. The still
 * also stands in whenever the viewer cannot be reached at all, so a page that
 * outlives a deployment degrades to a picture of the thing plus a link to it.
 */

/** Whether the viewport has room for the viewer's stage, panel and telemetry. */
export function canEmbed(matches: (query: string) => boolean): boolean {
  return matches('(min-width: 900px)') && matches('(min-height: 520px)');
}

/**
 * The viewer's own "I am running" ping (posted by the app once it reaches the
 * artifact view). The frame's `load` event cannot stand in for this: a
 * cross-origin frame reports `load` just as happily for the browser's own
 * "server IP address could not be found" page or a gateway error, and trading
 * the still for one of those is worse than not embedding at all.
 */
export const VIEWER_READY = 'yuna:ready';

export function isViewerReady(data: unknown): boolean {
  return typeof data === 'object' && data !== null && (data as { type?: unknown }).type === VIEWER_READY;
}

export interface EmbedRefs {
  frame: HTMLElement | null;
  iframe: HTMLIFrameElement | null;
  src: string;
  wide: boolean;
}

export function mountEmbed({ frame, iframe, src, wide }: EmbedRefs): void {
  if (!iframe || !wide) return;

  const onMessage = (e: MessageEvent) => {
    if (!isViewerReady(e.data)) return;
    window.removeEventListener('message', onMessage);
    frame?.classList.add('is-live');
  };
  window.addEventListener('message', onMessage);
  // The same middle band the demo video uses, so both start on arrival.
  const io = new IntersectionObserver(
    ([entry]) => {
      if (!entry.isIntersecting) return;
      io.disconnect();
      iframe.src = src;
    },
    { rootMargin: '-12% 0px -18% 0px', threshold: 0 },
  );
  io.observe(iframe);
}
