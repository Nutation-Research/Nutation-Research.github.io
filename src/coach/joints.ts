/**
 * The 15-joint set and canonical order from ARTIFACT.md §2. Column order in the
 * per-frame table follows this order; the overlay indexes joints by these
 * positions. This is the artifact's joint set — NOT MediaPipe's 33-landmark
 * topology (that lived in the old demo PoseOverlay).
 */
export const JOINT_NAMES = [
  'nose',
  'left_shoulder',
  'right_shoulder',
  'left_elbow',
  'right_elbow',
  'left_wrist',
  'right_wrist',
  'left_hip',
  'right_hip',
  'left_knee',
  'right_knee',
  'left_ankle',
  'right_ankle',
  'left_foot_index',
  'right_foot_index',
] as const;

export const N_JOINTS = JOINT_NAMES.length; // 15

const J = Object.fromEntries(JOINT_NAMES.map((n, i) => [n, i])) as Record<
  (typeof JOINT_NAMES)[number],
  number
>;

/** Skeleton edges as index pairs into the 15-joint set (torso, arms, legs, feet). */
export const SKELETON_EDGES: readonly [number, number][] = [
  [J.left_shoulder, J.right_shoulder],
  [J.left_shoulder, J.left_elbow],
  [J.left_elbow, J.left_wrist],
  [J.right_shoulder, J.right_elbow],
  [J.right_elbow, J.right_wrist],
  [J.left_shoulder, J.left_hip],
  [J.right_shoulder, J.right_hip],
  [J.left_hip, J.right_hip],
  [J.left_hip, J.left_knee],
  [J.left_knee, J.left_ankle],
  [J.left_ankle, J.left_foot_index],
  [J.right_hip, J.right_knee],
  [J.right_knee, J.right_ankle],
  [J.right_ankle, J.right_foot_index],
];
