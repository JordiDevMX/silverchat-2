import type { Story, StoryGroup } from "../types.ts";

export type StoryEntry = {
  story: Story;
  userId: string;
  indexInGroup: number;
  groupCount: number;
};

/**
 * Flattens story groups in the viewer's locked cross-user order while
 * filtering out expired stories and preserving each story's group coordinates.
 */
export function buildStoryTimeline(
  groups: StoryGroup[] | undefined,
  orderedUserIds: string[],
  nowMs = Date.now(),
): StoryEntry[] {
  if (!groups?.length || !orderedUserIds.length) return [];
  const byUser = new Map<string, StoryGroup>();
  for (const group of groups) {
    byUser.set(group.user_id, group);
  }
  const entries: StoryEntry[] = [];
  for (const userId of orderedUserIds) {
    const group = byUser.get(userId);
    if (!group) continue;
    const activeStories = group.stories.filter((s) => Date.parse(s.expires_at) > nowMs);
    const groupCount = activeStories.length;
    for (let i = 0; i < groupCount; i++) {
      const story = activeStories[i];
      if (!story) continue;
      entries.push({
        story,
        userId,
        indexInGroup: i,
        groupCount,
      });
    }
  }
  return entries;
}

/** Resolves the starting flat timeline index for a given userId and within-user index. */
export function resolveInitialCursor(
  timeline: StoryEntry[],
  userId: string,
  initialStoryIndex = 0,
): number {
  let firstForUser = -1;
  let lastForUser = -1;
  for (let i = 0; i < timeline.length; i++) {
    const entry = timeline[i];
    if (entry?.userId !== userId) continue;
    if (firstForUser === -1) firstForUser = i;
    lastForUser = i;
    if (entry.indexInGroup === initialStoryIndex) return i;
  }
  if (firstForUser === -1) return -1;
  return initialStoryIndex < 0 ? firstForUser : lastForUser;
}

/** Keeps the viewer anchored on the same story ID after live cache updates or deletions. */
export function resolveCursorAfterTimelineChange(
  timeline: StoryEntry[],
  currentStoryId: string | null,
  fallbackIndex: number,
): number {
  if (!timeline.length) return -1;
  if (currentStoryId) {
    const found = timeline.findIndex((entry) => entry.story.id === currentStoryId);
    if (found >= 0) return found;
  }
  return Math.max(0, Math.min(timeline.length - 1, fallbackIndex));
}

/**
 * Story-level navigation target (used by tap zones, buttons, keyboard, and auto-advance):
 * steps one story at a time within the current user's tray, rolling over to the adjacent
 * user only at the tray boundary. Returns `"end"` past the final story, `null` before the first.
 */
export function resolveStoryNavigationTarget(
  timeline: StoryEntry[],
  fromIndex: number,
  delta: 1 | -1,
): number | "end" | null {
  if (!timeline.length || fromIndex < 0 || fromIndex >= timeline.length) return null;
  const next = fromIndex + delta;
  if (next >= timeline.length) return "end";
  if (next < 0) return null;
  return next;
}

/**
 * User-level navigation target (used by the hold + drag 3D cube gesture):
 * skips any remaining stories in the current user's tray and always lands on the
 * adjacent user's FIRST story (`indexInGroup === 0`). Returns `null` at the first/last user.
 */
export function resolveUserNavigationTarget(
  timeline: StoryEntry[],
  fromIndex: number,
  delta: 1 | -1,
): number | null {
  const current = timeline[fromIndex];
  if (!current) return null;

  if (delta > 0) {
    // Jump directly past the remainder of the current user's tray to the next user's first story.
    const nextUserStart = fromIndex - current.indexInGroup + current.groupCount;
    return nextUserStart < timeline.length ? nextUserStart : null;
  }

  // Jump directly before the current user's tray, then land on the previous user's FIRST story.
  const prevUserLastIndex = fromIndex - current.indexInGroup - 1;
  if (prevUserLastIndex < 0) return null;
  const prevUserLast = timeline[prevUserLastIndex];
  if (!prevUserLast) return null;
  const prevUserFirstIndex = prevUserLastIndex - prevUserLast.indexInGroup;
  return prevUserFirstIndex >= 0 ? prevUserFirstIndex : null;
}

/**
 * Computes the minimal sorted, deduplicated set of story indices to keep mounted/preloaded:
 * active story + user-level drag neighbors + story-level tap neighbors + any in-flight track faces.
 */
export function getPreloadStoryIndices(
  timeline: StoryEntry[],
  activeIndex: number,
  activeTrackIndices: Iterable<number>,
): number[] {
  if (!timeline.length || activeIndex < 0 || activeIndex >= timeline.length) return [];
  const set = new Set<number>([activeIndex]);

  for (const idx of activeTrackIndices) {
    if (idx >= 0 && idx < timeline.length) set.add(idx);
  }

  const prevUser = resolveUserNavigationTarget(timeline, activeIndex, -1);
  const nextUser = resolveUserNavigationTarget(timeline, activeIndex, 1);
  if (prevUser !== null) set.add(prevUser);
  if (nextUser !== null) set.add(nextUser);

  const prevStory = resolveStoryNavigationTarget(timeline, activeIndex, -1);
  const nextStory = resolveStoryNavigationTarget(timeline, activeIndex, 1);
  if (typeof prevStory === "number") set.add(prevStory);
  if (typeof nextStory === "number") set.add(nextStory);

  return [...set].sort((a, b) => a - b);
}
