import type { Message } from "../types.ts";
import { getAvailableActions } from "./actionMatrix.ts";

export const SWIPE_LOCK_DISTANCE_PX = 10;
export const SWIPE_VERTICAL_CANCEL_PX = 10;
export const SWIPE_DIRECTION_RATIO = 1.25;
export const SWIPE_MAX_TRAVEL_PX = 84;
export const SWIPE_RESISTANCE_SCALE_PX = 84;
export const SWIPE_ARM_THRESHOLD_PX = 48;
export const SWIPE_DISARM_THRESHOLD_PX = 42;
export const SWIPE_REDUCED_MOTION_FACTOR = 0.15;

const SPRING_STIFFNESS = 420;
const SETTLE_POS_EPSILON_PX = 0.35;
const SETTLE_VEL_EPSILON_PX = 4;
const MAX_STEP_DT = 0.05;
const SUBSTEP_DT = 1 / 180;

export type SwipeIntent = "pending" | "lock-horizontal" | "yield-vertical" | "ignore-left";

/**
 * Resolves initial pointer displacement into a deliberate gesture decision
 * before locking horizontal travel or yielding to vertical list scrolling.
 */
export function classifySwipeIntent(dx: number, dy: number): SwipeIntent {
  const absDx = Math.abs(dx);
  const absDy = Math.abs(dy);

  if (absDy >= SWIPE_VERTICAL_CANCEL_PX && absDy * SWIPE_DIRECTION_RATIO >= absDx) {
    return "yield-vertical";
  }
  if (dx <= -SWIPE_LOCK_DISTANCE_PX && absDx > absDy) {
    return "ignore-left";
  }
  if (dx >= SWIPE_LOCK_DISTANCE_PX && dx > absDy * SWIPE_DIRECTION_RATIO) {
    return "lock-horizontal";
  }
  if (absDy >= SWIPE_VERTICAL_CANCEL_PX && absDy > dx) {
    return "yield-vertical";
  }
  return "pending";
}

/**
 * Converts raw positive horizontal finger drag (after lock) into bounded,
 * rubber-banded visual travel (`0 .. < SWIPE_MAX_TRAVEL_PX`).
 */
export function computeSwipeTravel(rawDx: number): number {
  if (rawDx <= 0 || !Number.isFinite(rawDx)) return 0;
  return SWIPE_MAX_TRAVEL_PX * (1 - Math.exp(-rawDx / SWIPE_RESISTANCE_SCALE_PX));
}

/**
 * Inverts `computeSwipeTravel` so catching a rebounding message mid-spring
 * resumes seamlessly from its current visual position without jumping.
 */
export function invertSwipeTravel(travelX: number): number {
  if (travelX <= 0 || !Number.isFinite(travelX)) return 0;
  const clamped = Math.min(SWIPE_MAX_TRAVEL_PX - 0.5, travelX);
  return -SWIPE_RESISTANCE_SCALE_PX * Math.log(1 - clamped / SWIPE_MAX_TRAVEL_PX);
}

/**
 * Applies arm/disarm hysteresis around the activation threshold to prevent
 * haptic or visual chatter when a finger hovers near the boundary.
 */
export function updateArmedState(travelX: number, wasArmed: boolean): boolean {
  if (wasArmed) {
    return travelX >= SWIPE_DISARM_THRESHOLD_PX;
  }
  return travelX >= SWIPE_ARM_THRESHOLD_PX;
}

export type SwipeIndicatorMetrics = {
  progress: number;
  opacity: number;
  scale: number;
  offsetX: number;
  bubbleTranslateX: number;
};

/**
 * Computes compositor-only transforms and opacity for the reply affordance and
 * sliding message row, damping spatial travel when reduced motion is preferred.
 */
export function computeIndicatorMetrics(
  travelX: number,
  armed: boolean,
  reducedMotion: boolean,
): SwipeIndicatorMetrics {
  const progress = Math.max(0, Math.min(1, travelX / SWIPE_ARM_THRESHOLD_PX));
  const opacity = travelX <= 1 ? 0 : Math.min(1, progress * 1.25);
  const bubbleTranslateX = reducedMotion ? travelX * SWIPE_REDUCED_MOTION_FACTOR : travelX;

  if (reducedMotion) {
    return {
      progress,
      opacity,
      scale: 1,
      offsetX: 4,
      bubbleTranslateX,
    };
  }

  const baseScale = 0.5 + 0.45 * progress;
  const scale = armed ? 1.08 : baseScale;
  const offsetX = -8 + 14 * progress;

  return {
    progress,
    opacity,
    scale,
    offsetX,
    bubbleTranslateX,
  };
}

/**
 * Advances a critically damped spring returning `pos` to rest (`0`) with
 * fixed substepping so release velocity carries smoothly into the rebound.
 */
export function stepSwipeSpring(
  pos: number,
  vel: number,
  dtSeconds: number,
): { pos: number; vel: number; settled: boolean } {
  const damping = 2 * Math.sqrt(SPRING_STIFFNESS);
  let remaining = Math.min(MAX_STEP_DT, Math.max(0, dtSeconds));
  let x = pos;
  let v = vel;

  while (remaining > 0) {
    const dt = Math.min(remaining, SUBSTEP_DT);
    const accel = -SPRING_STIFFNESS * x - damping * v;
    v += accel * dt;
    x += v * dt;
    remaining -= dt;
  }

  if (Math.abs(x) < SETTLE_POS_EPSILON_PX && Math.abs(v) < SETTLE_VEL_EPSILON_PX) {
    return { pos: 0, vel: 0, settled: true };
  }
  return { pos: Math.max(0, x), vel: v, settled: false };
}

/**
 * Delegates reply eligibility to the shared message action matrix so channels,
 * read-only requests, write-restricted groups, system rows, and deleted/pending
 * messages never arm or trigger a reply.
 */
export function canSwipeReplyToMessage(
  message: Message,
  userId: string,
  readOnly: boolean,
  writeRestricted: boolean,
): boolean {
  return getAvailableActions(message, userId, readOnly, Date.now(), writeRestricted).includes(
    "reply",
  );
}

export type TextRectLike = {
  left: number;
  right: number;
  top: number;
  bottom: number;
};

/**
 * Checks whether a pointer coordinate falls over rendered text line rects
 * (within a small tolerance) so mouse drags on text preserve text selection
 * while drags on bubble padding, media, or row whitespace swipe to reply.
 */
export function isPointInTextRects(
  rects: Iterable<TextRectLike>,
  x: number,
  y: number,
  paddingPx = 2,
): boolean {
  for (const rect of rects) {
    if (rect.right <= rect.left || rect.bottom <= rect.top) continue;
    if (
      x >= rect.left - paddingPx &&
      x <= rect.right + paddingPx &&
      y >= rect.top - paddingPx &&
      y <= rect.bottom + paddingPx
    ) {
      return true;
    }
  }
  return false;
}
