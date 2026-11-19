import assert from "node:assert/strict";
import test from "node:test";
import {
  applyBoundaryResistance,
  computeCubeFaceStyle,
  computeReleaseTarget,
  getVisibleIndices,
  stepSpring,
} from "../src/features/novedades/lib/storyCubeEngine.ts";
import {
  buildStoryTimeline,
  resolveCursorAfterTimelineChange,
  resolveInitialCursor,
} from "../src/features/novedades/lib/storyTimeline.ts";
import type { Story, StoryGroup } from "../src/features/novedades/types.ts";

const makeStory = (id: string, userId: string, expiresInMs = 60_000): Story => ({
  id,
  user_id: userId,
  media_type: "text",
  text_content: id,
  background_color: "#123456",
  caption: null,
  file_upload_id: null,
  media_thumbnail_upload_id: null,
  created_at: "2026-11-18T00:00:00.000Z",
  expires_at: new Date(1_700_000_000_000 + expiresInMs).toISOString(),
  viewed: false,
});

const makeGroup = (userId: string, stories: Story[]): StoryGroup => ({
  user_id: userId,
  stories,
  last_created_at: stories.at(-1)?.created_at ?? "2026-11-18T00:00:00.000Z",
  has_unwatched: stories.some((s) => !s.viewed),
});

test("buildStoryTimeline flattens across users in locked order and filters expired stories", () => {
  const now = 1_700_000_000_000;
  const groups: StoryGroup[] = [
    makeGroup("u2", [makeStory("u2-1", "u2"), makeStory("u2-expired", "u2", -1000)]),
    makeGroup("u1", [makeStory("u1-1", "u1"), makeStory("u1-2", "u1")]),
    makeGroup("u3", [makeStory("u3-1", "u3")]),
  ];
  const timeline = buildStoryTimeline(groups, ["u1", "u2", "u3"], now);
  assert.deepEqual(
    timeline.map((e) => [e.story.id, e.userId, e.indexInGroup, e.groupCount]),
    [
      ["u1-1", "u1", 0, 2],
      ["u1-2", "u1", 1, 2],
      ["u2-1", "u2", 0, 1],
      ["u3-1", "u3", 0, 1],
    ],
  );
  assert.equal(resolveInitialCursor(timeline, "u2", 0), 2);
  assert.equal(resolveInitialCursor(timeline, "u1", 1), 1);
  assert.equal(resolveInitialCursor(timeline, "u1", 99), 1);
  assert.equal(resolveInitialCursor(timeline, "missing", 0), -1);
});

test("resolveCursorAfterTimelineChange keeps current story id or clamps cleanly", () => {
  const now = 1_700_000_000_000;
  const timeline = buildStoryTimeline(
    [makeGroup("u1", [makeStory("s1", "u1"), makeStory("s2", "u1"), makeStory("s3", "u1")])],
    ["u1"],
    now,
  );
  assert.equal(resolveCursorAfterTimelineChange(timeline, "s3", 0), 2);
  assert.equal(resolveCursorAfterTimelineChange(timeline, "deleted", 1), 1);
  assert.equal(resolveCursorAfterTimelineChange(timeline, "deleted", 10), 2);
  assert.equal(resolveCursorAfterTimelineChange([], "s1", 0), -1);
});

test("computeCubeFaceStyle maps right-drag to NEXT and left-drag to PREVIOUS in 3D cube space", () => {
  // At rest on story 0
  const rest = computeCubeFaceStyle(0, 400, false);
  assert.equal(rest.visible, true);
  assert.equal(rest.transform, "translate3d(0, 0, 0)");
  assert.equal(rest.opacity, 1);
  assert.equal(rest.shadeOpacity, 0);

  // Dragging RIGHT halfway from story 0 -> story 1 (pos = 0.5):
  // Story 0 has relative offset d = 0 - 0.5 = -0.5 -> rotates +45deg (swings right with finger)
  const outgoing = computeCubeFaceStyle(-0.5, 400, false);
  assert.equal(outgoing.visible, true);
  assert.equal(outgoing.transform, "translateZ(-200px) rotateY(45deg) translateZ(200px)");
  assert.ok(outgoing.shadeOpacity > 0.15 && outgoing.shadeOpacity < 0.3);

  // Story 1 (NEXT) has relative offset d = 1 - 0.5 = +0.5 -> rotates -45deg (enters from left)
  const incomingNext = computeCubeFaceStyle(0.5, 400, false);
  assert.equal(incomingNext.visible, true);
  assert.equal(incomingNext.transform, "translateZ(-200px) rotateY(-45deg) translateZ(200px)");

  // Out of view faces (|d| >= 1) are hidden
  assert.equal(computeCubeFaceStyle(1, 400, false).visible, false);
  assert.equal(computeCubeFaceStyle(-1, 400, false).visible, false);

  // Reduced motion uses crossfade with zero spatial transform
  const reducedMid = computeCubeFaceStyle(0.4, 400, true);
  assert.equal(reducedMid.visible, true);
  assert.equal(reducedMid.transform, "none");
  assert.ok(Math.abs(reducedMid.opacity - 0.6) < 0.001);
  assert.equal(reducedMid.shadeOpacity, 0);
});

test("applyBoundaryResistance passes through interior positions and damps past bounds", () => {
  assert.equal(applyBoundaryResistance(1.4, 0, 3), 1.4);
  assert.equal(applyBoundaryResistance(0, 0, 3), 0);
  assert.equal(applyBoundaryResistance(3, 0, 3), 3);

  const pastStartSmall = applyBoundaryResistance(-0.2, 0, 3);
  const pastStartLarge = applyBoundaryResistance(-1.5, 0, 3);
  assert.ok(pastStartSmall < 0 && pastStartSmall > -0.2);
  assert.ok(pastStartLarge < pastStartSmall && pastStartLarge > -0.35);

  const pastEndSmall = applyBoundaryResistance(3.2, 0, 3);
  const pastEndLarge = applyBoundaryResistance(4.5, 0, 3);
  assert.ok(pastEndSmall > 3 && pastEndSmall < 3.2);
  assert.ok(pastEndLarge > pastEndSmall && pastEndLarge < 3.35);
});

test("computeReleaseTarget handles distance threshold, flings, spring-back, and boundaries", () => {
  // Drag right >= 27% -> commit NEXT
  assert.equal(
    computeReleaseTarget({
      pos: 1.3,
      anchorPos: 1,
      velocityStoriesPerSec: 0,
      minIndex: 0,
      maxIndex: 3,
    }),
    2,
  );
  // Drag right < 27% slowly -> spring back
  assert.equal(
    computeReleaseTarget({
      pos: 1.15,
      anchorPos: 1,
      velocityStoriesPerSec: 0.1,
      minIndex: 0,
      maxIndex: 3,
    }),
    1,
  );
  // Drag left >= 27% -> commit PREVIOUS
  assert.equal(
    computeReleaseTarget({
      pos: 0.7,
      anchorPos: 1,
      velocityStoriesPerSec: 0,
      minIndex: 0,
      maxIndex: 3,
    }),
    0,
  );
  // Drag left < 27% slowly -> spring back
  assert.equal(
    computeReleaseTarget({
      pos: 0.85,
      anchorPos: 1,
      velocityStoriesPerSec: -0.1,
      minIndex: 0,
      maxIndex: 3,
    }),
    1,
  );
  // Fast right fling with modest displacement -> commit NEXT
  assert.equal(
    computeReleaseTarget({
      pos: 1.1,
      anchorPos: 1,
      velocityStoriesPerSec: 2.0,
      minIndex: 0,
      maxIndex: 3,
    }),
    2,
  );
  // Fast left fling with modest displacement -> commit PREVIOUS
  assert.equal(
    computeReleaseTarget({
      pos: 0.9,
      anchorPos: 1,
      velocityStoriesPerSec: -2.0,
      minIndex: 0,
      maxIndex: 3,
    }),
    0,
  );
  // Micro-jitter with high velocity (< 6% displacement) -> spring back
  assert.equal(
    computeReleaseTarget({
      pos: 1.02,
      anchorPos: 1,
      velocityStoriesPerSec: 3.0,
      minIndex: 0,
      maxIndex: 3,
    }),
    1,
  );
  // Boundary clamping: dragging past last or before first always springs back to bound
  assert.equal(
    computeReleaseTarget({
      pos: 3.25,
      anchorPos: 3,
      velocityStoriesPerSec: 2.5,
      minIndex: 0,
      maxIndex: 3,
    }),
    3,
  );
  assert.equal(
    computeReleaseTarget({
      pos: -0.25,
      anchorPos: 0,
      velocityStoriesPerSec: -2.5,
      minIndex: 0,
      maxIndex: 3,
    }),
    0,
  );
});

test("stepSpring settles smoothly without overshoot and supports mid-flight retargeting", () => {
  let pos = 0;
  let vel = 0;
  let elapsed = 0;
  for (let i = 0; i < 60; i++) {
    const next = stepSpring(pos, vel, 1, 1 / 60);
    pos = next.pos;
    vel = next.vel;
    elapsed += 1 / 60;
    assert.ok(pos >= -0.001 && pos <= 1.001, `Unexpected overshoot: ${pos}`);
    if (next.settled) break;
  }
  assert.equal(pos, 1);
  assert.equal(vel, 0);
  assert.ok(elapsed > 0.15 && elapsed < 0.65, `Unexpected settle duration: ${elapsed}s`);

  // Mid-flight retargeting from 0.45 with positive velocity toward 0 reverses smoothly
  const rev = stepSpring(0.45, 2.5, 0, 1 / 60);
  assert.ok(rev.vel < 2.5, "Velocity should decelerate toward new target");
  let rPos = rev.pos;
  let rVel = rev.vel;
  for (let i = 0; i < 90; i++) {
    const next = stepSpring(rPos, rVel, 0, 1 / 60);
    rPos = next.pos;
    rVel = next.vel;
    if (next.settled) break;
  }
  assert.equal(rPos, 0);
});

test("getVisibleIndices preloads adjacent stories and spans mid-flight retarget windows", () => {
  assert.deepEqual(getVisibleIndices(0, 0, 5), [0, 1]);
  assert.deepEqual(getVisibleIndices(2, 2, 5), [1, 2, 3]);
  assert.deepEqual(getVisibleIndices(4, 4, 5), [3, 4]);
  assert.deepEqual(getVisibleIndices(0.4, 2, 5), [0, 1, 2, 3]);
  assert.deepEqual(getVisibleIndices(0, 0, 0), []);
});
