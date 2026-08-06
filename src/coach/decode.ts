/**
 * Trimmed stand-in for Yuna's app/src/artifact/decode.ts — same shapes, but hydrated from a small
 * precomputed JSON slice (see loadTable.ts) instead of decoding a full Parquet artifact. Only the
 * fields the ported Coach modules (overlay.ts, motionTrailDraw.ts, coachIllustrations.ts,
 * CoachPanel.tsx, MotionTrail.tsx) actually read are kept.
 */
export interface ArtifactTable {
  n: number;
  frame: Int32Array;
  jointsXY: Float32Array; // [n * N_JOINTS * 2] px in source resolution; NaN if missing
  vis: Float32Array; // [n * N_JOINTS] in [0,1]
  inclinationDeg: Float32Array; // [n]; NaN if null
  comXY: Float32Array; // [n * 2]; NaN if undef
  effort: Float32Array; // [n * N_JOINTS]; NaN if null
}

export interface EventRow {
  entity_id: number;
  entity_type: string;
  start_frame: number;
  end_frame: number;
  [column: string]: unknown;
}

export interface EventTable {
  rows: EventRow[];
}

/** Nearest row index for a (possibly out-of-range or off-grid) frame index. `frame` is sorted
 *  ascending; binary-search the closest, clamp to [0, n-1]. Verbatim from the real decode.ts. */
export function rowForFrame(table: Pick<ArtifactTable, 'n' | 'frame'>, frameIdx: number): number {
  const { frame, n } = table;
  if (n === 0) return 0;
  if (frameIdx <= frame[0]) return 0;
  if (frameIdx >= frame[n - 1]) return n - 1;
  let lo = 0;
  let hi = n - 1;
  while (lo + 1 < hi) {
    const mid = (lo + hi) >> 1;
    if (frame[mid] === frameIdx) return mid;
    if (frame[mid] < frameIdx) lo = mid;
    else hi = mid;
  }
  return frameIdx - frame[lo] <= frame[hi] - frameIdx ? lo : hi;
}
