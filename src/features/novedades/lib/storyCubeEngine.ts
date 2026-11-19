export const COMMIT_DISTANCE_THRESHOLD = 0.27;
export const FLING_VELOCITY_THRESHOLD = 1.1;
export const FLING_MIN_DISPLACEMENT = 0.06;
export const BOUNDARY_MAX_OVERSCROLL = 0.28;
export const BOUNDARY_RESISTANCE_SCALE = 0.55;
export const CUBE_SHADE_MAX_OPACITY = 0.45;
export const DEFAULT_SPRING_STIFFNESS = 340;
export const REDUCED_MOTION_SPRING_STIFFNESS = 520;

const REST_EPSILON = 0.0005;
const SETTLE_POS_EPSILON = 0.0015;
const SETTLE_VEL_EPSILON = 0.015;
const MAX_STEP_DT = 0.05;
const SUBSTEP_DT = 1 / 180;

export type CubeFaceStyle = {
  visible: boolean;
  transform: string;
  opacity: number;
  shadeOpacity: number;
};

/**
 * Applies smooth asymptotic rubber-band resistance when dragging past the
 * absolute first or last story in the timeline.
 */
export function applyBoundaryResistance(pos: number, minPos: number, maxPos: number): number {
  if (pos < minPos) {
    const over = minPos - pos;
    const damped = BOUNDARY_MAX_OVERSCROLL * (1 - Math.exp(-over / BOUNDARY_RESISTANCE_SCALE));
    return minPos - damped;
  }
  if (pos > maxPos) {
    const over = pos - maxPos;
    const damped = BOUNDARY_MAX_OVERSCROLL * (1 - Math.exp(-over / BOUNDARY_RESISTANCE_SCALE));
    return maxPos + damped;
  }
  return pos;
}

/**
 * Computes GPU-composited transform and opacity for a single story face.
 *
 * Coordinate convention (locked):
 * - `relativeOffset = faceIndex - position`
 * - Dragging RIGHT increases `position` toward `k + 1` (NEXT):
 *   - Current face `k` has `relativeOffset < 0` -> rotates `+angle` (swings right with pointer)
 *   - Incoming NEXT face `k + 1` has `relativeOffset > 0` -> rotates `-angle` (enters from left)
 * - Dragging LEFT decreases `position` toward `k - 1` (PREVIOUS):
 *   - Current face `k` has `relativeOffset > 0` -> rotates `-angle` (swings left with pointer)
 *   - Incoming PREVIOUS face `k - 1` has `relativeOffset < 0` -> rotates `+angle` (enters from right)
 */
export function computeCubeFaceStyle(
  relativeOffset: number,
  stageWidth: number,
  reducedMotion: boolean,
): CubeFaceStyle {
  const absOffset = Math.abs(relativeOffset);
  if (absOffset >= 1) {
    return {
      visible: false,
      transform: reducedMotion ? "none" : "translate3d(0, 0, 0)",
      opacity: 0,
      shadeOpacity: 0,
    };
  }

  if (reducedMotion) {
    return {
      visible: true,
      transform: "none",
      opacity: Math.max(0, Math.min(1, 1 - absOffset)),
      shadeOpacity: 0,
    };
  }

  if (absOffset < REST_EPSILON) {
    return {
      visible: true,
      transform: "translate3d(0, 0, 0)",
      opacity: 1,
      shadeOpacity: 0,
    };
  }

  const halfWidth = Math.max(1, stageWidth) / 2;
  const angleDeg = -relativeOffset * 90;
  const roundedAngle = Number(angleDeg.toFixed(3));
  const roundedRadius = Number(halfWidth.toFixed(2));
  const shadeOpacity = Math.min(CUBE_SHADE_MAX_OPACITY, absOffset * CUBE_SHADE_MAX_OPACITY);

  return {
    visible: true,
    transform: `translateZ(-${roundedRadius}px) rotateY(${roundedAngle}deg) translateZ(${roundedRadius}px)`,
    opacity: 1,
    shadeOpacity,
  };
}

/**
 * Decides the discrete story index to settle onto when a drag ends.
 * Respects distance threshold (~27%), fling velocity threshold, mid-flight catches,
 * and timeline boundaries.
 */
export function computeReleaseTarget({
  pos,
  anchorPos,
  velocityStoriesPerSec,
  minIndex,
  maxIndex,
}: {
  pos: number;
  anchorPos: number;
  velocityStoriesPerSec: number;
  minIndex: number;
  maxIndex: number;
}): number {
  const clamp = (n: number) => Math.max(minIndex, Math.min(maxIndex, n));
  const anchorInt = Math.round(anchorPos);
  const wasMidFlight = Math.abs(anchorPos - anchorInt) > 0.02;

  if (wasMidFlight) {
    const low = Math.floor(anchorPos);
    const high = Math.ceil(anchorPos);
    const projected = pos + Math.max(-0.35, Math.min(0.35, velocityStoriesPerSec * 0.14));
    const bounded = Math.max(low, Math.min(high, Math.round(projected)));
    return clamp(bounded);
  }

  const delta = pos - anchorInt;
  if (
    delta >= COMMIT_DISTANCE_THRESHOLD ||
    (velocityStoriesPerSec >= FLING_VELOCITY_THRESHOLD && delta >= FLING_MIN_DISPLACEMENT)
  ) {
    return clamp(anchorInt + 1);
  }
  if (
    delta <= -COMMIT_DISTANCE_THRESHOLD ||
    (velocityStoriesPerSec <= -FLING_VELOCITY_THRESHOLD && delta <= -FLING_MIN_DISPLACEMENT)
  ) {
    return clamp(anchorInt - 1);
  }
  return clamp(anchorInt);
}

/**
 * Critically damped spring step with fixed substepping for frame-rate-independent,
 * zero-overshoot, velocity-preserving transitions and retargeting.
 */
export function stepSpring(
  pos: number,
  vel: number,
  target: number,
  dtSeconds: number,
  stiffness = DEFAULT_SPRING_STIFFNESS,
): { pos: number; vel: number; settled: boolean } {
  const damping = 2 * Math.sqrt(stiffness);
  let remaining = Math.min(MAX_STEP_DT, Math.max(0, dtSeconds));
  let x = pos;
  let v = vel;

  while (remaining > 0) {
    const dt = Math.min(remaining, SUBSTEP_DT);
    const accel = -stiffness * (x - target) - damping * v;
    v += accel * dt;
    x += v * dt;
    remaining -= dt;
  }

  if (Math.abs(x - target) < SETTLE_POS_EPSILON && Math.abs(v) < SETTLE_VEL_EPSILON) {
    return { pos: target, vel: 0, settled: true };
  }
  return { pos: x, vel: v, settled: false };
}

/**
 * Computes the minimal sorted list of story indices that must be mounted to
 * support instant drag previews (prev + active + next) and seamless mid-flight
 * retargeting without remounting media.
 */
export function getVisibleIndices(pos: number, targetIndex: number, totalCount: number): number[] {
  if (totalCount <= 0) return [];
  const last = totalCount - 1;
  const minCandidate = Math.min(Math.floor(pos), targetIndex) - 1;
  const maxCandidate = Math.max(Math.ceil(pos), targetIndex) + 1;
  const start = Math.max(0, minCandidate);
  const end = Math.min(last, maxCandidate);
  const indices: number[] = [];
  for (let i = start; i <= end; i++) {
    indices.push(i);
  }
  return indices;
}
