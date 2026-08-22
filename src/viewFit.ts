/**
 * Framing the orthographic intro camera across viewport shapes.
 *
 * The rosette is drawn on the unit sphere, so it is about two world units wide.
 * A landscape window has width to spare and uses the tuned half-height; a phone
 * held upright does not, and keying off height alone crops the mark on both
 * sides. Portrait therefore grows the frustum until the whole mark fits.
 */

/** The Goldstein unit sphere the brand rosette is traced on. */
export const MARK_RADIUS = 1.0;

/** Half-width the frustum must cover so the outer loops clear the edge. */
export const FIT_HALF_WIDTH = MARK_RADIUS * 1.1;

/** Orthographic half-height for a viewport of the given aspect (width / height). */
export function fitHalfHeight(aspect: number, baseHalfHeight: number): number {
  if (!(aspect > 0)) return baseHalfHeight;
  return Math.max(baseHalfHeight, FIT_HALF_WIDTH / aspect);
}

/** Half-width that follows from `fitHalfHeight`, for assertions and debugging. */
export function fitHalfWidth(aspect: number, baseHalfHeight: number): number {
  return fitHalfHeight(aspect, baseHalfHeight) * Math.max(aspect, 0);
}
