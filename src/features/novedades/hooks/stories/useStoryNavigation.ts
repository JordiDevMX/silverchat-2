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
  REDUCED_MOTION_SPRING_STIFFNESS,
  stepSpring,
} from "../../lib/storyCubeEngine";
import {
  getPreloadStoryIndices,
  resolveStoryNavigationTarget,
  resolveUserNavigationTarget,
  type StoryEntry,
} from "../../lib/storyTimeline";

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
  anchorInt: number;
  minDragSlot: number;
  maxDragSlot: number;
  prePressTargetSlot: number;
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

function buildRestUserSlots(timeline: StoryEntry[], storyIndex: number): Map<number, number> {
  const slots = new Map<number, number>();
  if (storyIndex < 0 || storyIndex >= timeline.length) return slots;
  slots.set(0, storyIndex);
  const prevUser = resolveUserNavigationTarget(timeline, storyIndex, -1);
  const nextUser = resolveUserNavigationTarget(timeline, storyIndex, 1);
  if (prevUser !== null) slots.set(-1, prevUser);
  if (nextUser !== null) slots.set(1, nextUser);
  return slots;
}

/**
 * Unified, interruptible 3D cube transition engine with explicit navigation granularity:
 * - Story-level (`navigateStory`): tap zones, Previous/Next buttons, keyboard, timer auto-advance.
 * - User-level (hold + drag cube gesture): jumps whole user trays, landing on the target user's first story.
 * Both route through the same virtual-slot spring and GPU-composited cube transform driver.
 */
export function useStoryNavigation({
  timeline,
  initialIndex,
  disabled = false,
  onReachEnd,
  onClose,
}: {
  timeline: StoryEntry[];
  initialIndex: number;
  disabled?: boolean;
  onReachEnd: () => void;
  onClose: () => void;
}) {
  const reducedMotion = useReducedMotionPreference();
  const reducedMotionRef = useRef(reducedMotion);
  reducedMotionRef.current = reducedMotion;

  const totalCount = timeline.length;
  const clampedInitial = totalCount > 0 ? Math.max(0, Math.min(totalCount - 1, initialIndex)) : -1;

  const [activeIndex, setActiveIndex] = useState(clampedInitial);
  const [visibleIndices, setVisibleIndices] = useState<number[]>(() =>
    clampedInitial >= 0
      ? getPreloadStoryIndices(
          timeline,
          clampedInitial,
          buildRestUserSlots(timeline, clampedInitial).values(),
        )
      : [],
  );
  const [isPressed, setIsPressed] = useState(false);
  const [isHolding, setIsHolding] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [isSettling, setIsSettling] = useState(false);

  const timelineRef = useRef(timeline);
  timelineRef.current = timeline;
  const disabledRef = useRef(disabled);
  disabledRef.current = disabled;
  const onReachEndRef = useRef(onReachEnd);
  onReachEndRef.current = onReachEnd;
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  const initializedRef = useRef(clampedInitial >= 0);
  const activeIndexRef = useRef(clampedInitial);
  const slotToStoryRef = useRef<Map<number, number>>(
    clampedInitial >= 0 ? buildRestUserSlots(timeline, clampedInitial) : new Map(),
  );
  const posRef = useRef(0);
  const velRef = useRef(0);
  const targetSlotRef = useRef(0);
  const springFrameRef = useRef<number | null>(null);
  const lastFrameTimeRef = useRef<number | null>(null);
  const gestureRef = useRef<ActiveGesture | null>(null);

  const viewportRef = useRef<HTMLDivElement | null>(null);
  const resizeObserverRef = useRef<ResizeObserver | null>(null);
  const widthRef = useRef(360);
  const faceNodesRef = useRef(new Map<number, FaceNodes>());

  const findSlotForStory = useCallback((storyIndex: number): number | undefined => {
    let bestSlot: number | undefined;
    let bestDist = Number.POSITIVE_INFINITY;
    for (const [slot, idx] of slotToStoryRef.current) {
      if (idx !== storyIndex) continue;
      const dist = Math.abs(slot - posRef.current);
      if (dist < bestDist) {
        bestDist = dist;
        bestSlot = slot;
      }
    }
    return bestSlot;
  }, []);

  const applySingleFace = useCallback(
    (storyIndex: number, nodes: FaceNodes) => {
      const slot = findSlotForStory(storyIndex);
      if (slot === undefined) {
        nodes.face.style.visibility = "hidden";
        nodes.face.style.transform = reducedMotionRef.current ? "none" : "translate3d(0, 0, 0)";
        nodes.face.style.opacity = "0";
        if (nodes.shade) nodes.shade.style.opacity = "0";
        return;
      }
      const style = computeCubeFaceStyle(
        slot - posRef.current,
        widthRef.current,
        reducedMotionRef.current,
      );
      nodes.face.style.visibility = style.visible ? "visible" : "hidden";
      nodes.face.style.transform = style.transform;
      nodes.face.style.opacity = String(style.opacity);
      if (nodes.shade) {
        nodes.shade.style.opacity = String(style.shadeOpacity);
      }
    },
    [findSlotForStory],
  );

  const applyAllFaces = useCallback(() => {
    for (const [storyIndex, nodes] of faceNodesRef.current) {
      applySingleFace(storyIndex, nodes);
    }
  }, [applySingleFace]);

  const syncMountedSlides = useCallback((focusStoryIndex: number) => {
    const tl = timelineRef.current;
    if (!tl.length || focusStoryIndex < 0 || focusStoryIndex >= tl.length) {
      setVisibleIndices((prev) => (prev.length === 0 ? prev : []));
      return;
    }
    const next = getPreloadStoryIndices(tl, focusStoryIndex, slotToStoryRef.current.values());
    setVisibleIndices((prev) => (sameNumberArray(prev, next) ? prev : next));
  }, []);

  const stopSpring = useCallback(() => {
    if (springFrameRef.current !== null) {
      cancelAnimationFrame(springFrameRef.current);
      springFrameRef.current = null;
    }
    lastFrameTimeRef.current = null;
  }, []);

  const rebaseAtStory = useCallback(
    (storyIndex: number) => {
      const tl = timelineRef.current;
      slotToStoryRef.current = buildRestUserSlots(tl, storyIndex);
      posRef.current = 0;
      velRef.current = 0;
      targetSlotRef.current = 0;
      activeIndexRef.current = storyIndex;
      setActiveIndex(storyIndex);
      applyAllFaces();
      syncMountedSlides(storyIndex);
    },
    [applyAllFaces, syncMountedSlides],
  );

  const startSpringToSlot = useCallback(
    (nextSlot: number, initialVelocity?: number) => {
      const targetStory = slotToStoryRef.current.get(nextSlot);
      if (targetStory === undefined) return;

      targetSlotRef.current = nextSlot;
      activeIndexRef.current = targetStory;
      setActiveIndex(targetStory);

      if (initialVelocity !== undefined) {
        velRef.current = Math.max(
          -MAX_FLING_VELOCITY,
          Math.min(MAX_FLING_VELOCITY, initialVelocity),
        );
      }

      if (Math.abs(posRef.current - nextSlot) < 0.0015 && Math.abs(velRef.current) < 0.015) {
        stopSpring();
        setIsSettling(false);
        rebaseAtStory(targetStory);
        return;
      }

      setIsSettling(true);
      syncMountedSlides(targetStory);

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
          targetSlotRef.current,
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
          const settledStory = slotToStoryRef.current.get(targetSlotRef.current);
          if (settledStory !== undefined) {
            rebaseAtStory(settledStory);
          }
        } else {
          springFrameRef.current = requestAnimationFrame(tick);
        }
      };

      springFrameRef.current = requestAnimationFrame(tick);
    },
    [applyAllFaces, rebaseAtStory, stopSpring, syncMountedSlides],
  );

  // Sync once timeline first populates (e.g. async query load) without bogus startup animation.
  useEffect(() => {
    if (totalCount <= 0) {
      stopSpring();
      initializedRef.current = false;
      slotToStoryRef.current = new Map();
      posRef.current = 0;
      velRef.current = 0;
      targetSlotRef.current = 0;
      activeIndexRef.current = -1;
      setActiveIndex(-1);
      setVisibleIndices([]);
      setIsSettling(false);
      return;
    }
    if (!initializedRef.current && initialIndex >= 0) {
      const clamped = Math.max(0, Math.min(totalCount - 1, initialIndex));
      initializedRef.current = true;
      setIsSettling(false);
      rebaseAtStory(clamped);
      return;
    }
    if (activeIndexRef.current >= totalCount) {
      stopSpring();
      setIsSettling(false);
      rebaseAtStory(totalCount - 1);
    }
  }, [totalCount, initialIndex, rebaseAtStory, stopSpring]);

  // Allow caller to snap index when live timeline membership shifts (e.g. story expires).
  const syncIndex = useCallback(
    (nextIndex: number) => {
      if (nextIndex === activeIndexRef.current) return;
      stopSpring();
      setIsSettling(false);
      rebaseAtStory(Math.max(0, nextIndex));
    },
    [rebaseAtStory, stopSpring],
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
    (storyIndex: number, face: HTMLElement | null, shade: HTMLElement | null) => {
      if (face) {
        const nodes: FaceNodes = { face, shade };
        faceNodesRef.current.set(storyIndex, nodes);
        applySingleFace(storyIndex, nodes);
      } else {
        faceNodesRef.current.delete(storyIndex);
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

  /**
   * Story-level navigation (tap zones, buttons, keyboard, timer auto-advance).
   * Steps one story at a time within the current user's tray and rolls over at tray edges.
   */
  const navigateStory = useCallback(
    (delta: 1 | -1) => {
      if (disabledRef.current) return;
      const tl = timelineRef.current;
      if (!tl.length) return;

      const currentSlot = targetSlotRef.current;
      const currentStory = slotToStoryRef.current.get(currentSlot);
      if (currentStory === undefined) return;

      const nextSlot = currentSlot + delta;
      // Preserve visual continuity: if nextSlot is already visible on screen mid-transition,
      // smoothly reverse back onto it rather than swapping a visible face.
      if (slotToStoryRef.current.has(nextSlot) && Math.abs(nextSlot - posRef.current) < 1) {
        startSpringToSlot(nextSlot);
        return;
      }

      const resolved = resolveStoryNavigationTarget(tl, currentStory, delta);
      if (resolved === "end") {
        onReachEndRef.current();
        return;
      }
      if (resolved === null) {
        startSpringToSlot(currentSlot);
        return;
      }

      // Remove any off-screen stale slot carrying the same story so slot lookup remains 1:1.
      for (const [slot, idx] of slotToStoryRef.current) {
        if (idx === resolved && Math.abs(slot - posRef.current) >= 1) {
          slotToStoryRef.current.delete(slot);
        }
      }
      slotToStoryRef.current.set(nextSlot, resolved);
      startSpringToSlot(nextSlot);
    },
    [startSpringToSlot],
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
      startSpringToSlot(targetSlotRef.current, 0);
    },
    [clearGestureTimers, startSpringToSlot],
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
      const tl = timelineRef.current;
      if (disabledRef.current || !tl.length) return;
      if (!e.isPrimary) return;
      if (e.pointerType === "mouse" && e.button !== 0) return;
      if (gestureRef.current !== null) return;
      if (
        (e.target as HTMLElement).closest("button, a, input, textarea, [data-no-story-gesture]")
      ) {
        return;
      }

      const now = performance.now();
      const prePressTargetSlot = targetSlotRef.current;
      stopSpring();
      setIsSettling(false);

      const anchorPos = posRef.current;
      const anchorInt = Math.round(anchorPos);
      const anchorStory = slotToStoryRef.current.get(anchorInt);

      // Prepare user-level drag targets on off-screen adjacent slots without mutating any visible face.
      if (anchorStory !== undefined) {
        const prevUser = resolveUserNavigationTarget(tl, anchorStory, -1);
        const nextUser = resolveUserNavigationTarget(tl, anchorStory, 1);

        if (Math.abs(anchorInt - 1 - anchorPos) >= 1) {
          if (prevUser !== null) {
            for (const [s, idx] of slotToStoryRef.current) {
              if (idx === prevUser && Math.abs(s - anchorPos) >= 1) {
                slotToStoryRef.current.delete(s);
              }
            }
            slotToStoryRef.current.set(anchorInt - 1, prevUser);
          } else {
            slotToStoryRef.current.delete(anchorInt - 1);
          }
        }
        if (Math.abs(anchorInt + 1 - anchorPos) >= 1) {
          if (nextUser !== null) {
            for (const [s, idx] of slotToStoryRef.current) {
              if (idx === nextUser && Math.abs(s - anchorPos) >= 1) {
                slotToStoryRef.current.delete(s);
              }
            }
            slotToStoryRef.current.set(anchorInt + 1, nextUser);
          } else {
            slotToStoryRef.current.delete(anchorInt + 1);
          }
        }
      }

      const minDragSlot = slotToStoryRef.current.has(anchorInt - 1)
        ? anchorInt - 1
        : Math.floor(anchorPos);
      const maxDragSlot = slotToStoryRef.current.has(anchorInt + 1)
        ? anchorInt + 1
        : Math.ceil(anchorPos);

      const gesture: ActiveGesture = {
        pointerId: e.pointerId,
        startX: e.clientX,
        startY: e.clientY,
        startTime: now,
        phase: "pressing",
        anchorPos,
        anchorInt,
        minDragSlot,
        maxDragSlot,
        prePressTargetSlot,
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
          syncMountedSlides(activeIndexRef.current);
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
        // Locked direction mapping: dragging RIGHT (+dx) advances to NEXT user (+1),
        // dragging LEFT (-dx) returns to PREVIOUS user (-1).
        const dragDelta = (e.clientX - g.dragOriginX) / width;
        const rawPos = g.dragOriginPos + dragDelta;
        const clampedPerGesture = Math.max(g.anchorInt - 1, Math.min(g.anchorInt + 1, rawPos));
        const boundedPos = applyBoundaryResistance(clampedPerGesture, g.minDragSlot, g.maxDragSlot);

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
    [applyAllFaces, clearGestureTimers, syncMountedSlides],
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
        const settleSlot = Math.max(
          g.minDragSlot,
          Math.min(g.maxDragSlot, Math.round(posRef.current)),
        );
        startSpringToSlot(settleSlot, 0);
        return;
      }

      if (g.phase === "dragging") {
        const velStoriesPerSec = computeVelocityStoriesPerSec(g.samples, now, widthRef.current);
        const commitSlot = computeReleaseTarget({
          pos: posRef.current,
          anchorPos: g.anchorPos,
          velocityStoriesPerSec: velStoriesPerSec,
          minIndex: g.minDragSlot,
          maxIndex: g.maxDragSlot,
        });
        startSpringToSlot(commitSlot, velStoriesPerSec);
        return;
      }

      if (g.phase === "holding") {
        // Released after a hold without dragging -> never trigger tap; settle cleanly if caught mid-flight.
        const settleSlot = Math.max(
          g.minDragSlot,
          Math.min(g.maxDragSlot, Math.round(posRef.current)),
        );
        startSpringToSlot(settleSlot, 0);
        return;
      }

      // Phase === "pressing": check swipe-down dismiss first, then quick story-level tap.
      if (dy > DISMISS_MIN_DY && Math.abs(dx) < DISMISS_MAX_DX) {
        onCloseRef.current();
        return;
      }

      if (elapsedMs < TAP_MAX_DURATION_MS && Math.hypot(dx, dy) < DRAG_LOCK_PX) {
        const rect = e.currentTarget.getBoundingClientRect();
        const isLeftTap = e.clientX - rect.left < rect.width * 0.3;
        targetSlotRef.current = g.prePressTargetSlot;
        navigateStory(isLeftTap ? -1 : 1);
        return;
      }

      const settleSlot = Math.max(
        g.minDragSlot,
        Math.min(g.maxDragSlot, Math.round(posRef.current)),
      );
      startSpringToSlot(settleSlot, 0);
    },
    [clearGestureTimers, navigateStory, startSpringToSlot],
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
    navigateStory,
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
