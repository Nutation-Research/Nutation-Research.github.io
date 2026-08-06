import type { ArtifactTable } from './decode';
import { JOINT_NAMES, N_JOINTS } from './joints';

interface JointCols {
  x: (number | null)[];
  y: (number | null)[];
  vis: (number | null)[];
  effort: (number | null)[];
}

interface RawTable {
  n: number;
  frame: number[];
  inclination_deg: (number | null)[];
  com_x: (number | null)[];
  com_y: (number | null)[];
  joints: Record<string, JointCols>;
}

const nz = (v: number | null | undefined): number => (v == null ? NaN : v);

/** Parse the exported JSON pose slice into the same columnar `ArtifactTable` shape
 *  Yuna's real decode.ts produces from Parquet — so overlay.ts / strobePoses / etc. run unmodified. */
export async function loadArtifactTable(url: string): Promise<ArtifactTable> {
  const res = await fetch(url, { cache: 'no-store' });
  const raw = (await res.json()) as RawTable;
  const n = raw.n;

  const frame = new Int32Array(n);
  const jointsXY = new Float32Array(n * N_JOINTS * 2);
  const vis = new Float32Array(n * N_JOINTS);
  const inclinationDeg = new Float32Array(n);
  const comXY = new Float32Array(n * 2);
  const effort = new Float32Array(n * N_JOINTS);

  for (let i = 0; i < n; i++) {
    frame[i] = raw.frame[i];
    inclinationDeg[i] = nz(raw.inclination_deg[i]);
    comXY[i * 2] = nz(raw.com_x[i]);
    comXY[i * 2 + 1] = nz(raw.com_y[i]);
    for (let j = 0; j < N_JOINTS; j++) {
      const col = raw.joints[JOINT_NAMES[j]];
      const base = (i * N_JOINTS + j) * 2;
      jointsXY[base] = nz(col.x[i]);
      jointsXY[base + 1] = nz(col.y[i]);
      vis[i * N_JOINTS + j] = nz(col.vis[i]);
      effort[i * N_JOINTS + j] = nz(col.effort[i]);
    }
  }

  return { n, frame, jointsXY, vis, inclinationDeg, comXY, effort };
}
