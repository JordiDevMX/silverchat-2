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
