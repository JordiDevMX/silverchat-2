import {
  type PointerEvent as ReactPointerEvent,
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import {
  applyBoundaryResistance,
  computeCubeFaceStyle,
  computeReleaseTarget,
  DEFAULT_SPRING_STIFFNESS,
  getVisibleIndices,
  REDUCED_MOTION_SPRING_STIFFNESS,
  stepSpring,
} from "../../lib/storyCubeEngine";

const HOLD_CHROME_DELAY_MS = 180;
const TAP_MAX_DURATION_MS = 250;
const DRAG_LOCK_PX = 10;
const VERTICAL_LOCK_PX = 12;
const DISMISS_MIN_DY = 80;
const DISMISS_MAX_DX = 100;
const VELOCITY_WINDOW_MS = 110;
const MAX_FLING_VELOCITY = 7;

type GesturePhase = "pressing" | "holding" | "dragging" | "vertical";

type VelocitySample = {
  x: number;
  t: number;
};

type ActiveGesture = {
  pointerId: number;
  startX: number;
  startY: number;
  startTime: number;
  phase: GesturePhase;
  anchorPos: number;
  prePressTarget: number;
  dragOriginX: number;
  dragOriginPos: number;
  samples: VelocitySample[];
  holdTimer: ReturnType<typeof setTimeout> | null;
};

type FaceNodes = {
  face: HTMLElement;
  shade: HTMLElement | null;
};

function useReducedMotionPreference() {
  const [reduced, setReduced] = useState(() =>
    typeof window !== "undefined" && typeof window.matchMedia === "function"
      ? window.matchMedia("(prefers-reduced-motion: reduce)").matches
      : false,
  );
  useEffect(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") return;
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const onChange = () => setReduced(mq.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);
  return reduced;
}

function sameNumberArray(a: number[], b: number[]) {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return false;
  }
  return true;
}

function computeVelocityStoriesPerSec(samples: VelocitySample[], now: number, stageWidth: number) {
  if (samples.length < 2 || stageWidth <= 0) return 0;
  const latest = samples[samples.length - 1];
  if (!latest || now - latest.t > 90) return 0;
  let oldest = samples[0] ?? latest;
  for (let i = samples.length - 2; i >= 0; i--) {
    const candidate = samples[i];
    if (!candidate) continue;
    oldest = candidate;
    if (latest.t - candidate.t >= 35) break;
  }
  const dtMs = latest.t - oldest.t;
  if (dtMs < 8) return 0;
  const pxPerSec = ((latest.x - oldest.x) / dtMs) * 1000;
  return pxPerSec / stageWidth;
}

/**
 * Unified, interruptible 3D cube transition engine + Instagram-style
 * press-and-hold / horizontal scrub / tap / vertical dismiss Pointer Events controller.
 */
export function useStoryNavigation({
  totalCount,
  initialIndex,
  disabled = false,
  onReachEnd,
  onClose,
}: {
  totalCount: number;
  initialIndex: number;
  disabled?: boolean;
  onReachEnd: () => void;
  onClose: () => void;
}) {
  const reducedMotion = useReducedMotionPreference();
  const reducedMotionRef = useRef(reducedMotion);
  reducedMotionRef.current = reducedMotion;

  const clampedInitial = totalCount > 0 ? Math.max(0, Math.min(totalCount - 1, initialIndex)) : -1;
  const [activeIndex, setActiveIndex] = useState(clampedInitial);
  const [visibleIndices, setVisibleIndices] = useState<number[]>(() =>
    clampedInitial >= 0 ? getVisibleIndices(clampedInitial, clampedInitial, totalCount) : [],
  );
  const [isPressed, setIsPressed] = useState(false);
  const [isHolding, setIsHolding] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [isSettling, setIsSettling] = useState(false);

  const totalCountRef = useRef(totalCount);
  totalCountRef.current = totalCount;
  const disabledRef = useRef(disabled);
  disabledRef.current = disabled;
  const onReachEndRef = useRef(onReachEnd);
  onReachEndRef.current = onReachEnd;
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  const initializedRef = useRef(clampedInitial >= 0);
  const posRef = useRef(Math.max(clampedInitial, 0));
  const velRef = useRef(0);
  const targetIndexRef = useRef(clampedInitial);
  const springFrameRef = useRef<number | null>(null);
  const lastFrameTimeRef = useRef<number | null>(null);
  const gestureRef = useRef<ActiveGesture | null>(null);

  const viewportRef = useRef<HTMLDivElement | null>(null);
  const resizeObserverRef = useRef<ResizeObserver | null>(null);
  const widthRef = useRef(360);
  const faceNodesRef = useRef(new Map<number, FaceNodes>());

  const applySingleFace = useCallback((index: number, nodes: FaceNodes) => {
    const style = computeCubeFaceStyle(
      index - posRef.current,
      widthRef.current,
      reducedMotionRef.current,
    );
    nodes.face.style.visibility = style.visible ? "visible" : "hidden";
    nodes.face.style.transform = style.transform;
    nodes.face.style.opacity = String(style.opacity);
    if (nodes.shade) {
      nodes.shade.style.opacity = String(style.shadeOpacity);
    }
  }, []);

  const applyAllFaces = useCallback(() => {
    for (const [index, nodes] of faceNodesRef.current) {
      applySingleFace(index, nodes);
    }
  }, [applySingleFace]);

  const syncVisibleWindow = useCallback(() => {
    const count = totalCountRef.current;
    if (count <= 0) {
      setVisibleIndices((prev) => (prev.length === 0 ? prev : []));
      return;
    }
    const next = getVisibleIndices(posRef.current, targetIndexRef.current, count);
    setVisibleIndices((prev) => (sameNumberArray(prev, next) ? prev : next));
  }, []);

  const stopSpring = useCallback(() => {
    if (springFrameRef.current !== null) {
      cancelAnimationFrame(springFrameRef.current);
      springFrameRef.current = null;
    }
    lastFrameTimeRef.current = null;
  }, []);

  const startSpringTo = useCallback(
    (nextTarget: number, initialVelocity?: number) => {
      const count = totalCountRef.current;
      if (count <= 0) return;
      const clampedTarget = Math.max(0, Math.min(count - 1, nextTarget));
      targetIndexRef.current = clampedTarget;
      setActiveIndex(clampedTarget);
      if (initialVelocity !== undefined) {
        velRef.current = Math.max(
          -MAX_FLING_VELOCITY,
          Math.min(MAX_FLING_VELOCITY, initialVelocity),
        );
      }

      if (Math.abs(posRef.current - clampedTarget) < 0.0015 && Math.abs(velRef.current) < 0.015) {
        stopSpring();
        posRef.current = clampedTarget;
        velRef.current = 0;
        setIsSettling(false);
        applyAllFaces();
        syncVisibleWindow();
        return;
      }

      setIsSettling(true);
      syncVisibleWindow();

      if (springFrameRef.current !== null) return;
      lastFrameTimeRef.current = null;

      const tick = (now: number) => {
        const prev = lastFrameTimeRef.current;
        lastFrameTimeRef.current = now;
        const dt = prev === null ? 1 / 60 : Math.max(0, (now - prev) / 1000);
        const stiffness = reducedMotionRef.current
          ? REDUCED_MOTION_SPRING_STIFFNESS
          : DEFAULT_SPRING_STIFFNESS;
        const next = stepSpring(
          posRef.current,
          velRef.current,
          targetIndexRef.current,
          dt,
          stiffness,
        );
        posRef.current = next.pos;
        velRef.current = next.vel;
        applyAllFaces();

        if (next.settled) {
          springFrameRef.current = null;
          lastFrameTimeRef.current = null;
          setIsSettling(false);
          syncVisibleWindow();
        } else {
          syncVisibleWindow();
          springFrameRef.current = requestAnimationFrame(tick);
        }
      };

      springFrameRef.current = requestAnimationFrame(tick);
    },
    [applyAllFaces, stopSpring, syncVisibleWindow],
  );

  // Sync once timeline first populates (e.g. async query load) without bogus startup animation.
  useEffect(() => {
    if (totalCount <= 0) {
      stopSpring();
      initializedRef.current = false;
      targetIndexRef.current = -1;
      posRef.current = 0;
      velRef.current = 0;
      setActiveIndex(-1);
      setVisibleIndices([]);
      setIsSettling(false);
      return;
    }
    if (!initializedRef.current && initialIndex >= 0) {
      const clamped = Math.max(0, Math.min(totalCount - 1, initialIndex));
      initializedRef.current = true;
      targetIndexRef.current = clamped;
      posRef.current = clamped;
      velRef.current = 0;
      setActiveIndex(clamped);
      setVisibleIndices(getVisibleIndices(clamped, clamped, totalCount));
      setIsSettling(false);
      return;
    }
    if (targetIndexRef.current >= totalCount) {
      const clamped = totalCount - 1;
      stopSpring();
      targetIndexRef.current = clamped;
      posRef.current = clamped;
      velRef.current = 0;
      setActiveIndex(clamped);
      setVisibleIndices(getVisibleIndices(clamped, clamped, totalCount));
      setIsSettling(false);
    }
  }, [totalCount, initialIndex, stopSpring]);

  // Allow caller to snap index when live timeline membership shifts (e.g. story expires).
  const syncIndex = useCallback(
    (nextIndex: number) => {
      if (nextIndex === targetIndexRef.current) return;
      stopSpring();
      targetIndexRef.current = nextIndex;
      posRef.current = Math.max(0, nextIndex);
      velRef.current = 0;
      setActiveIndex(nextIndex);
      setIsSettling(false);
      syncVisibleWindow();
      applyAllFaces();
    },
    [applyAllFaces, stopSpring, syncVisibleWindow],
  );

  // Measure viewport width via ResizeObserver so hot pointermove/rAF loops never read layout.
  const setViewportRef = useCallback(
    (node: HTMLDivElement | null) => {
      if (resizeObserverRef.current) {
        resizeObserverRef.current.disconnect();
        resizeObserverRef.current = null;
      }
      viewportRef.current = node;
      if (!node) return;
      const updateWidth = () => {
        const w = node.clientWidth;
        if (w > 0 && w !== widthRef.current) {
          widthRef.current = w;
          applyAllFaces();
        }
      };
      const initialW = node.clientWidth;
      if (initialW > 0) widthRef.current = initialW;
      applyAllFaces();
      if (typeof ResizeObserver !== "undefined") {
        const observer = new ResizeObserver(updateWidth);
        observer.observe(node);
        resizeObserverRef.current = observer;
      }
    },
    [applyAllFaces],
  );

  useLayoutEffect(() => {
    reducedMotionRef.current = reducedMotion;
    applyAllFaces();
  }, [reducedMotion, applyAllFaces]);

  const registerFace = useCallback(
    (index: number, face: HTMLElement | null, shade: HTMLElement | null) => {
      if (face) {
        const nodes: FaceNodes = { face, shade };
        faceNodesRef.current.set(index, nodes);
        applySingleFace(index, nodes);
      } else {
        faceNodesRef.current.delete(index);
      }
    },
    [applySingleFace],
  );

  const clearGestureTimers = useCallback((gesture: ActiveGesture | null) => {
    if (gesture?.holdTimer) {
      clearTimeout(gesture.holdTimer);
      gesture.holdTimer = null;
    }
  }, []);

  const navigate = useCallback(
    (delta: 1 | -1) => {
      if (disabledRef.current) return;
      const count = totalCountRef.current;
      if (count <= 0) return;
      const currentTarget = targetIndexRef.current;
      const nextTarget = currentTarget + delta;
      if (nextTarget >= count) {
        onReachEndRef.current();
        return;
      }
      if (nextTarget < 0) {
        // Already at the first story; settle cleanly if mid-flight.
        startSpringTo(0);
        return;
      }
      startSpringTo(nextTarget);
    },
    [startSpringTo],
  );

  const cancelActiveGesture = useCallback(
    (targetEl?: HTMLElement, pointerId?: number) => {
      const g = gestureRef.current;
      if (!g) return;
      gestureRef.current = null;
      clearGestureTimers(g);
      if (targetEl && pointerId !== undefined) {
        try {
          if (targetEl.hasPointerCapture(pointerId)) {
            targetEl.releasePointerCapture(pointerId);
          }
        } catch {
          // Synthetic pointer events may not hold native browser capture.
        }
      }
      setIsPressed(false);
      setIsHolding(false);
      setIsDragging(false);
      startSpringTo(targetIndexRef.current, 0);
    },
    [clearGestureTimers, startSpringTo],
  );

  // Cancel active gesture cleanly if viewer becomes disabled (closing / modal opened).
  useEffect(() => {
    if (disabled && gestureRef.current) {
      cancelActiveGesture();
    }
  }, [disabled, cancelActiveGesture]);

  // Cleanup all rAFs, observers, and timers on unmount.
  useEffect(() => {
    return () => {
      stopSpring();
      clearGestureTimers(gestureRef.current);
      gestureRef.current = null;
      if (resizeObserverRef.current) {
        resizeObserverRef.current.disconnect();
        resizeObserverRef.current = null;
      }
    };
  }, [stopSpring, clearGestureTimers]);

  const onPointerDown = useCallback(
    (e: ReactPointerEvent<HTMLDivElement>) => {
      if (disabledRef.current || totalCountRef.current <= 0) return;
      if (!e.isPrimary) return;
      if (e.pointerType === "mouse" && e.button !== 0) return;
      if (gestureRef.current !== null) return;
      if (
        (e.target as HTMLElement).closest("button, a, input, textarea, [data-no-story-gesture]")
      ) {
        return;
      }

      const now = performance.now();
      const prePressTarget = targetIndexRef.current;
      stopSpring();
      setIsSettling(false);

      const anchorPos = posRef.current;
      const gesture: ActiveGesture = {
        pointerId: e.pointerId,
        startX: e.clientX,
        startY: e.clientY,
        startTime: now,
        phase: "pressing",
        anchorPos,
        prePressTarget,
        dragOriginX: e.clientX,
        dragOriginPos: anchorPos,
        samples: [{ x: e.clientX, t: now }],
        holdTimer: null,
      };

      gesture.holdTimer = setTimeout(() => {
        if (gestureRef.current !== gesture) return;
        if (gesture.phase === "pressing") {
          gesture.phase = "holding";
          gesture.holdTimer = null;
          setIsHolding(true);
        }
      }, HOLD_CHROME_DELAY_MS);

      gestureRef.current = gesture;
      setIsPressed(true);

      try {
        e.currentTarget.setPointerCapture(e.pointerId);
      } catch {
        // Synthetic events in unit/browser scripts may not have an active pointer id.
      }
    },
    [stopSpring],
  );

  const onPointerMove = useCallback(
    (e: ReactPointerEvent<HTMLDivElement>) => {
      const g = gestureRef.current;
      if (!g || g.pointerId !== e.pointerId) return;

      const dx = e.clientX - g.startX;
      const dy = e.clientY - g.startY;
      const absDx = Math.abs(dx);
      const absDy = Math.abs(dy);
      const now = performance.now();

      if (g.phase === "pressing" || g.phase === "holding") {
        if (absDx >= DRAG_LOCK_PX && absDx > absDy * 1.1) {
          clearGestureTimers(g);
          g.phase = "dragging";
          g.dragOriginX = e.clientX;
          g.dragOriginPos = posRef.current;
          g.samples = [{ x: e.clientX, t: now }];
          setIsHolding(true);
          setIsDragging(true);
          syncVisibleWindow();
          return;
        }
        if (g.phase === "pressing" && dy >= VERTICAL_LOCK_PX && absDy > absDx * 1.3) {
          clearGestureTimers(g);
          g.phase = "vertical";
          return;
        }
        return;
      }

      if (g.phase === "dragging") {
        const width = Math.max(1, widthRef.current);
        // Locked direction mapping: dragging RIGHT (+dx) advances toward NEXT (+1),
        // dragging LEFT (-dx) returns toward PREVIOUS (-1).
        const dragDeltaStories = (e.clientX - g.dragOriginX) / width;
        const anchorInt = Math.round(g.anchorPos);
        const rawPos = g.dragOriginPos + dragDeltaStories;
        const clampedPerGesture = Math.max(anchorInt - 1, Math.min(anchorInt + 1, rawPos));
        const maxIndex = Math.max(0, totalCountRef.current - 1);
        const boundedPos = applyBoundaryResistance(clampedPerGesture, 0, maxIndex);

        posRef.current = boundedPos;
        velRef.current = 0;
        applyAllFaces();

        g.samples.push({ x: e.clientX, t: now });
        const cutoff = now - VELOCITY_WINDOW_MS;
        while (g.samples.length > 2 && (g.samples[0]?.t ?? now) < cutoff) {
          g.samples.shift();
        }
      }
    },
    [applyAllFaces, clearGestureTimers, syncVisibleWindow],
  );

  const onPointerUp = useCallback(
    (e: ReactPointerEvent<HTMLDivElement>) => {
      const g = gestureRef.current;
      if (!g || g.pointerId !== e.pointerId) return;

      gestureRef.current = null;
      clearGestureTimers(g);
      try {
        if (e.currentTarget.hasPointerCapture(e.pointerId)) {
          e.currentTarget.releasePointerCapture(e.pointerId);
        }
      } catch {
        // Synthetic pointer events may not hold native browser capture.
      }

      const now = performance.now();
      const dx = e.clientX - g.startX;
      const dy = e.clientY - g.startY;
      const elapsedMs = now - g.startTime;

      setIsPressed(false);
      setIsHolding(false);
      setIsDragging(false);

      if (g.phase === "vertical") {
        if (dy > DISMISS_MIN_DY && Math.abs(dx) < DISMISS_MAX_DX) {
          onCloseRef.current();
          return;
        }
        startSpringTo(Math.round(posRef.current), 0);
        return;
      }

      if (g.phase === "dragging") {
        const velStoriesPerSec = computeVelocityStoriesPerSec(g.samples, now, widthRef.current);
        const maxIndex = Math.max(0, totalCountRef.current - 1);
        const commitTarget = computeReleaseTarget({
          pos: posRef.current,
          anchorPos: g.anchorPos,
          velocityStoriesPerSec: velStoriesPerSec,
          minIndex: 0,
          maxIndex,
        });
        startSpringTo(commitTarget, velStoriesPerSec);
        return;
      }

      if (g.phase === "holding") {
        // Released after a hold without dragging -> never trigger tap; settle smoothly if caught mid-flight.
        const settleTarget = Math.max(
          0,
          Math.min(Math.max(0, totalCountRef.current - 1), Math.round(posRef.current)),
        );
        startSpringTo(settleTarget, 0);
        return;
      }

      // Phase === "pressing": check swipe-down dismiss first, then quick tap.
      if (dy > DISMISS_MIN_DY && Math.abs(dx) < DISMISS_MAX_DX) {
        onCloseRef.current();
        return;
      }

      if (elapsedMs < TAP_MAX_DURATION_MS && Math.hypot(dx, dy) < DRAG_LOCK_PX) {
        const rect = e.currentTarget.getBoundingClientRect();
        const isLeftTap = e.clientX - rect.left < rect.width * 0.3;
        targetIndexRef.current = g.prePressTarget;
        navigate(isLeftTap ? -1 : 1);
        return;
      }

      const settleTarget = Math.max(
        0,
        Math.min(Math.max(0, totalCountRef.current - 1), Math.round(posRef.current)),
      );
      startSpringTo(settleTarget, 0);
    },
    [clearGestureTimers, navigate, startSpringTo],
  );

  const onPointerCancel = useCallback(
    (e: ReactPointerEvent<HTMLDivElement>) => {
      const g = gestureRef.current;
      if (!g || g.pointerId !== e.pointerId) return;
      cancelActiveGesture(e.currentTarget, e.pointerId);
    },
    [cancelActiveGesture],
  );

  const onLostPointerCapture = useCallback(
    (e: ReactPointerEvent<HTMLDivElement>) => {
      const g = gestureRef.current;
      if (!g || g.pointerId !== e.pointerId) return;
      cancelActiveGesture(e.currentTarget, e.pointerId);
    },
    [cancelActiveGesture],
  );

  return {
    activeIndex,
    visibleIndices,
    isPressed,
    isHolding,
    isDragging,
    isSettling,
    chromeHidden: isHolding || isDragging,
    reducedMotion,
    navigate,
    syncIndex,
    setViewportRef,
    registerFace,
    gestureHandlers: {
      onPointerDown,
      onPointerMove,
      onPointerUp,
      onPointerCancel,
      onLostPointerCapture,
      onContextMenu: (e: React.MouseEvent) => e.preventDefault(),
    },
  };
}
