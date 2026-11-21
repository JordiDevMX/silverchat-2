import {
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
  useCallback,
  useEffect,
  useRef,
} from "react";
import {
  classifySwipeIntent,
  computeIndicatorMetrics,
  computeSwipeTravel,
  invertSwipeTravel,
  SWIPE_LOCK_DISTANCE_PX,
  stepSwipeSpring,
  updateArmedState,
} from "../lib/swipeToReply";

type SwipePhase = "pressing" | "dragging";

type VelocitySample = {
  x: number;
  t: number;
};

type ActivePointerGesture = {
  pointerId: number;
  startX: number;
  startY: number;
  dragOriginX: number;
  phase: SwipePhase;
  armed: boolean;
  samples: VelocitySample[];
};

const VELOCITY_WINDOW_MS = 90;
const MAX_RELEASE_VELOCITY_PX = 900;
const CLICK_SUPPRESS_MS = 400;
const SCROLL_CANCEL_DELTA_PX = 2;
const HAPTIC_ARM_MS = 12;

/**
 * Module-scoped single-in-flight coordinator: guarantees at most one message row
 * holds an active swipe gesture at any instant across the conversation.
 */
let activeCoordinator: { token: symbol; cancel: () => void } | null = null;

function prefersReducedMotion(): boolean {
  return (
    typeof window !== "undefined" &&
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

function triggerArmHaptic() {
  try {
    if (typeof navigator !== "undefined" && typeof navigator.vibrate === "function") {
      navigator.vibrate(HAPTIC_ARM_MS);
    }
  } catch {
    // Ignore platforms or permission contexts that reject vibration.
  }
}

function computeReleaseVelocity(samples: VelocitySample[], now: number): number {
  if (samples.length < 2) return 0;
  const latest = samples[samples.length - 1];
  if (!latest || now - latest.t > VELOCITY_WINDOW_MS) return 0;
  let oldest = samples[0] ?? latest;
  for (let i = samples.length - 2; i >= 0; i--) {
    const candidate = samples[i];
    if (!candidate) continue;
    oldest = candidate;
    if (latest.t - candidate.t >= 24) break;
  }
  const dtMs = latest.t - oldest.t;
  if (dtMs < 6) return 0;
  const rawVel = ((latest.x - oldest.x) / dtMs) * 1000;
  return Math.max(-MAX_RELEASE_VELOCITY_PX, Math.min(MAX_RELEASE_VELOCITY_PX, rawVel));
}

function isInteractiveSwipeExclusion(target: EventTarget | null): boolean {
  if (!(target instanceof Element)) return false;
  return Boolean(
    target.closest(
      "input, textarea, select, option, [data-no-swipe-reply], .message-overflow, .message-retry, .message-reactions button",
    ),
  );
}

/**
 * Drives per-row swipe-right-to-reply via direct DOM compositor transforms and a
 * critically damped rAF spring, avoiding React re-renders and layout reads per frame.
 */
export function useSwipeToReply({
  enabled,
  onReply,
  onSwipeLock,
}: {
  enabled: boolean;
  onReply: () => void;
  onSwipeLock?: () => void;
}) {
  const rowRef = useRef<HTMLDivElement | null>(null);
  const trackRef = useRef<HTMLDivElement | null>(null);
  const indicatorRef = useRef<HTMLDivElement | null>(null);

  const enabledRef = useRef(enabled);
  enabledRef.current = enabled;
  const onReplyRef = useRef(onReply);
  onReplyRef.current = onReply;
  const onSwipeLockRef = useRef(onSwipeLock);
  onSwipeLockRef.current = onSwipeLock;

  const instanceTokenRef = useRef(Symbol("swipe-row"));
  const gestureRef = useRef<ActivePointerGesture | null>(null);
  const travelRef = useRef(0);
  const springVelRef = useRef(0);
  const springFrameRef = useRef<number | null>(null);
  const lastFrameTimeRef = useRef<number | null>(null);
  const suppressClickUntilRef = useRef(0);
  const cleanupListenersRef = useRef<(() => void) | null>(null);

  const stopSpring = useCallback(() => {
    if (springFrameRef.current !== null) {
      cancelAnimationFrame(springFrameRef.current);
      springFrameRef.current = null;
    }
    lastFrameTimeRef.current = null;
  }, []);

  const applyVisuals = useCallback((travelX: number, armed: boolean, active: boolean) => {
    travelRef.current = travelX;
    const row = rowRef.current;
    const track = trackRef.current;
    const indicator = indicatorRef.current;
    const reduced = prefersReducedMotion();
    const metrics = computeIndicatorMetrics(travelX, armed, reduced);

    if (row) {
      if (active) {
        row.dataset.swiping = "true";
      } else {
        delete row.dataset.swiping;
      }
      if (armed) {
        row.dataset.swipeArmed = "true";
      } else {
        delete row.dataset.swipeArmed;
      }
    }

    if (track) {
      if (travelX <= 0.05 && !active) {
        track.style.transform = "";
        track.style.willChange = "";
      } else {
        track.style.willChange = "transform";
        track.style.transform = `translate3d(${metrics.bubbleTranslateX.toFixed(2)}px, 0, 0)`;
      }
    }

    if (indicator) {
      if (travelX <= 0.05 && !active) {
        indicator.style.opacity = "";
        indicator.style.transform = "";
        delete indicator.dataset.armed;
      } else {
        indicator.style.opacity = metrics.opacity.toFixed(3);
        indicator.style.transform = `translate3d(${metrics.offsetX.toFixed(2)}px, -50%, 0) scale(${metrics.scale.toFixed(3)})`;
        if (armed) {
          indicator.dataset.armed = "true";
        } else {
          delete indicator.dataset.armed;
        }
      }
    }
  }, []);

  const releaseGlobalListeners = useCallback(() => {
    if (cleanupListenersRef.current) {
      cleanupListenersRef.current();
      cleanupListenersRef.current = null;
    }
  }, []);

  const releaseCoordinator = useCallback(() => {
    if (activeCoordinator?.token === instanceTokenRef.current) {
      activeCoordinator = null;
    }
  }, []);

  const springToRest = useCallback(
    (initialVelocityPx: number) => {
      stopSpring();
      const startTravel = travelRef.current;
      if (startTravel <= 0.35 || prefersReducedMotion()) {
        springVelRef.current = 0;
        applyVisuals(0, false, false);
        return;
      }

      springVelRef.current = initialVelocityPx;
      lastFrameTimeRef.current = null;

      const tick = (now: number) => {
        const prev = lastFrameTimeRef.current;
        lastFrameTimeRef.current = now;
        const dt = prev === null ? 1 / 60 : Math.max(0, (now - prev) / 1000);
        const next = stepSwipeSpring(travelRef.current, springVelRef.current, dt);
        springVelRef.current = next.vel;

        if (next.settled) {
          springFrameRef.current = null;
          lastFrameTimeRef.current = null;
          applyVisuals(0, false, false);
          return;
        }

        applyVisuals(next.pos, false, false);
        springFrameRef.current = requestAnimationFrame(tick);
      };

      springFrameRef.current = requestAnimationFrame(tick);
    },
    [applyVisuals, stopSpring],
  );

  const cancel = useCallback(() => {
    const g = gestureRef.current;
    gestureRef.current = null;
    releaseGlobalListeners();
    releaseCoordinator();

    const row = rowRef.current;
    if (g && row) {
      try {
        if (row.hasPointerCapture(g.pointerId)) {
          row.releasePointerCapture(g.pointerId);
        }
      } catch {
        // Synthetic pointer events may not hold native capture.
      }
    }

    if (travelRef.current > 0) {
      springToRest(0);
    } else {
      applyVisuals(0, false, false);
    }
  }, [applyVisuals, releaseCoordinator, releaseGlobalListeners, springToRest]);

  // Cancel cleanly whenever swipe becomes disallowed mid-flight (deleted, read-only, etc.).
  useEffect(() => {
    if (!enabled && gestureRef.current) {
      cancel();
    }
  }, [enabled, cancel]);

  // Deterministic cleanup on unmount.
  useEffect(() => {
    return () => {
      gestureRef.current = null;
      stopSpring();
      releaseGlobalListeners();
      releaseCoordinator();
    };
  }, [releaseCoordinator, releaseGlobalListeners, stopSpring]);

  const attachActiveListeners = useCallback(
    (row: HTMLElement) => {
      releaseGlobalListeners();
      const scroller = row.closest(".message-list");
      const initialScrollTop = scroller ? scroller.scrollTop : 0;

      const onScroll = () => {
        const current = scroller ? scroller.scrollTop : 0;
        const g = gestureRef.current;
        if (!g) return;
        if (
          g.phase === "pressing" ||
          Math.abs(current - initialScrollTop) > SCROLL_CANCEL_DELTA_PX
        ) {
          cancel();
        }
      };
      const onVisibilityOrBlur = () => {
        if (gestureRef.current) cancel();
      };

      scroller?.addEventListener("scroll", onScroll, { passive: true });
      window.addEventListener("blur", onVisibilityOrBlur);
      document.addEventListener("visibilitychange", onVisibilityOrBlur);

      cleanupListenersRef.current = () => {
        scroller?.removeEventListener("scroll", onScroll);
        window.removeEventListener("blur", onVisibilityOrBlur);
        document.removeEventListener("visibilitychange", onVisibilityOrBlur);
      };
    },
    [cancel, releaseGlobalListeners],
  );

  const onPointerDown = useCallback(
    (e: ReactPointerEvent<HTMLDivElement>) => {
      if (!enabledRef.current) return;
      if (e.pointerType === "mouse") return;
      if (!e.isPrimary) return;
      if (isInteractiveSwipeExclusion(e.target)) return;
      if (activeCoordinator && activeCoordinator.token !== instanceTokenRef.current) return;
      if (gestureRef.current) return;

      stopSpring();
      suppressClickUntilRef.current = 0;
      const existingTravel = travelRef.current;
      const resumedRawDx = existingTravel > 0.5 ? invertSwipeTravel(existingTravel) : 0;
      const now = performance.now();

      gestureRef.current = {
        pointerId: e.pointerId,
        startX: e.clientX,
        startY: e.clientY,
        dragOriginX: e.clientX - resumedRawDx,
        phase: existingTravel > 0.5 ? "dragging" : "pressing",
        armed: updateArmedState(existingTravel, false),
        samples: [{ x: e.clientX, t: now }],
      };

      activeCoordinator = {
        token: instanceTokenRef.current,
        cancel,
      };
      attachActiveListeners(e.currentTarget);
    },
    [attachActiveListeners, cancel, stopSpring],
  );

  const onPointerMove = useCallback(
    (e: ReactPointerEvent<HTMLDivElement>) => {
      const g = gestureRef.current;
      if (!g || g.pointerId !== e.pointerId) return;
      if (!enabledRef.current) {
        cancel();
        return;
      }

      const dx = e.clientX - g.startX;
      const dy = e.clientY - g.startY;

      if (g.phase === "pressing") {
        const intent = classifySwipeIntent(dx, dy);
        if (intent === "yield-vertical" || intent === "ignore-left") {
          cancel();
          return;
        }
        if (intent === "pending") return;

        g.phase = "dragging";
        g.dragOriginX = g.startX + SWIPE_LOCK_DISTANCE_PX;
        g.samples = [{ x: g.startX, t: performance.now() }];
        suppressClickUntilRef.current = Date.now() + CLICK_SUPPRESS_MS;
        onSwipeLockRef.current?.();

        try {
          e.currentTarget.setPointerCapture(e.pointerId);
        } catch {
          // Synthetic pointer events in tests may not hold native capture.
        }
      }

      const rawDx = Math.max(0, e.clientX - g.dragOriginX);
      const travelX = computeSwipeTravel(rawDx);
      const nextArmed = updateArmedState(travelX, g.armed);
      if (nextArmed && !g.armed) {
        triggerArmHaptic();
      }
      g.armed = nextArmed;

      const now = performance.now();
      g.samples.push({ x: e.clientX, t: now });
      const cutoff = now - VELOCITY_WINDOW_MS;
      while (g.samples.length > 2 && (g.samples[0]?.t ?? now) < cutoff) {
        g.samples.shift();
      }

      applyVisuals(travelX, nextArmed, true);
    },
    [applyVisuals, cancel],
  );

  const onPointerUp = useCallback(
    (e: ReactPointerEvent<HTMLDivElement>) => {
      const g = gestureRef.current;
      if (!g || g.pointerId !== e.pointerId) return;

      gestureRef.current = null;
      releaseGlobalListeners();
      releaseCoordinator();

      try {
        if (e.currentTarget.hasPointerCapture(e.pointerId)) {
          e.currentTarget.releasePointerCapture(e.pointerId);
        }
      } catch {
        // Synthetic pointer events may not hold native capture.
      }

      if (g.phase !== "dragging") {
        if (travelRef.current > 0) springToRest(0);
        return;
      }

      suppressClickUntilRef.current = Date.now() + CLICK_SUPPRESS_MS;
      const shouldReply = g.armed && enabledRef.current;
      const releaseVel = computeReleaseVelocity(g.samples, performance.now());

      if (shouldReply) {
        onReplyRef.current();
      }
      springToRest(releaseVel);
    },
    [releaseCoordinator, releaseGlobalListeners, springToRest],
  );

  const onPointerCancel = useCallback(
    (e: ReactPointerEvent<HTMLDivElement>) => {
      const g = gestureRef.current;
      if (!g || g.pointerId !== e.pointerId) return;
      cancel();
    },
    [cancel],
  );

  const onLostPointerCapture = useCallback(
    (e: ReactPointerEvent<HTMLDivElement>) => {
      // lostpointercapture bubbles when a child yields implicit touch capture to this row.
      if (e.target !== e.currentTarget) return;
      const g = gestureRef.current;
      if (!g || g.pointerId !== e.pointerId) return;
      cancel();
    },
    [cancel],
  );

  const onClickCapture = useCallback((e: ReactMouseEvent<HTMLDivElement>) => {
    if (Date.now() < suppressClickUntilRef.current) {
      e.preventDefault();
      e.stopPropagation();
      suppressClickUntilRef.current = 0;
    }
  }, []);

  return {
    rowRef,
    trackRef,
    indicatorRef,
    cancel,
    rowHandlers: {
      onPointerDown,
      onPointerMove,
      onPointerUp,
      onPointerCancel,
      onLostPointerCapture,
      onClickCapture,
    },
  };
}
