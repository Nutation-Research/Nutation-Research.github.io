/**
 * Sister-site URLs. Dev points at the local Yuna vite server (:5173).
 *
 * Production is the same Vercel site as this page (`/viewer/index.html`), packed by
 * `scripts/pack_viewer.sh`. It used to point at a Tailscale machine that is
 * not this laptop and is no longer up.
 */
export function yunaHref(dev: boolean): string {
  return dev ? 'http://localhost:5173/' : '/viewer/index.html';
}

export const YUNA_HREF = yunaHref(import.meta.env.DEV);

/**
 * The viewer with the coach already open on one element: `embed` drops Yuna's
 * own page chrome, `coach` is the element number on the scoreboard card, and
 * `signals` seeds the telemetry lanes so a reader lands on traces that say
 * something about a jump rather than on the store's single default.
 */
const EMBED_SIGNALS = ['inclination_deg', 'com_height', 'shoulder_sep'];

export function coachEmbedHref(run: string, element: number, base = YUNA_HREF): string {
  return `${base}?artifact=${run}&embed=1&coach=${element}&signals=${EMBED_SIGNALS.join(',')}`;
}
