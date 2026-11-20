// Regression tests for Guardian AUD-003 (rounds 4-5): a DISPOSED connection
// attempt (StrictMode double-mount, or any remount sharing the same call id)
// must never tear down or corrupt its replacement — its late token rejection,
// its connected-room teardown ("disconnected" event), its late media events
// (trackSubscribed/trackUnsubscribed/activeSpeakersChanged), its obsolete
// camera publish and its late store write are all ignored, even for identical
// call ids. Uses the extracted startRoomConnection with injected fakes,
// mirroring Guardian's offline probes of the hook.
import assert from "node:assert/strict";
import test from "node:test";
import type { RoomLike } from "../src/features/calls/lib/roomConnection.ts";
import { startRoomConnection } from "../src/features/calls/lib/roomConnection.ts";
import { useCallStore } from "../src/features/calls/stores/callStore.ts";

process.env.NODE_ENV ??= "test";

const CALL_ID = "c1111111-1111-4111-8111-111111111111";
const TOKEN = { token: "t", url: "wss://livekit.example" };

/** Flush every pending microtask (the connect chain is fully fake-resolved). */
const flush = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

class FakeRoom {
  handlers = new Map<string, ((...args: unknown[]) => void)[]>();
  connectCalls = 0;
  disconnectCalls = 0;
  micEnabledCalls = 0;
  cameraEnabledCalls = 0;
  /** Optional gates so a test can dispose between publishes and setState. */
  micGate: { promise: Promise<void>; resolve: () => void } | null = null;
  cameraGate: { promise: Promise<void>; resolve: () => void } | null = null;
  localParticipant = {
    identity: "local-user",
    setMicrophoneEnabled: async () => {
      this.micEnabledCalls++;
      if (this.micGate) await this.micGate.promise;
    },
    setCameraEnabled: async () => {
      this.cameraEnabledCalls++;
      if (this.cameraGate) await this.cameraGate.promise;
    },
    getTrackPublication: () => undefined,
  };

  on(event: string, cb: (...args: never[]) => void): RoomLike {
    const list = this.handlers.get(event) ?? [];
    list.push(cb as (...args: unknown[]) => void);
    this.handlers.set(event, list);
    return this as unknown as RoomLike;
  }

  emit(event: string, ...args: unknown[]) {
    for (const cb of this.handlers.get(event) ?? []) cb(...args);
  }

  connect = async () => {
    this.connectCalls++;
  };

  disconnect = async () => {
    this.disconnectCalls++;
  };
}

interface Attempt {
  dispose: () => void;
  gate: ReturnType<typeof deferred<{ token: string; url: string | null }>>;
  room: FakeRoom | undefined;
}

/** One startRoomConnection attempt whose token fetch is gated. `prepare`
 * runs on the fake room the moment createRoom builds it (before the connect
 * chain continues), so a test can park the chain mid-publish. */
function makeHarness() {
  const lost = { count: 0 };
  return {
    lost,
    start(prepare?: (room: FakeRoom) => void): Attempt {
      const gate = deferred<{ token: string; url: string | null }>();
      let room: FakeRoom | undefined;
      const dispose = startRoomConnection(CALL_ID, "voice", {
        fetchToken: () => gate.promise,
        createRoom: () => {
          const created = new FakeRoom();
          prepare?.(created);
          room = created;
          return created as unknown as RoomLike;
        },
        onNetworkLost: () => {
          lost.count++;
        },
      });
      return {
        dispose,
        gate,
        get room() {
          return room;
        },
      };
    },
  };
}

test.beforeEach(() => {
  useCallStore.setState({
    phase: "answered",
    call: {
      id: CALL_ID,
      chatId: "a1111111-1111-4111-8111-111111111111",
      type: "voice",
      roomName: "call_x",
      initiatorId: null,
    },
  });
});

test.afterEach(() => {
  useCallStore.setState({ call: null, room: null });
});

test("a voice call can display and hide the peer camera in the same room", async () => {
  const attempt = makeHarness().start();
  try {
    attempt.gate.resolve(TOKEN);
    await flush();
    const room = attempt.room;
    assert.ok(room);
    assert.equal(useCallStore.getState().isCameraEnabled, false);
    const track = { kind: "video" };
    const publication = { track, videoTrack: track };
    const peer = { identity: "other-user" };
    room.emit("trackSubscribed", track);
    assert.equal(useCallStore.getState().remoteVideoTrack, track);
    room.emit("trackMuted", publication, peer);
    assert.equal(useCallStore.getState().remoteVideoTrack, null);
    room.emit("trackUnmuted", publication, peer);
    assert.equal(useCallStore.getState().remoteVideoTrack, track);
    assert.equal(useCallStore.getState().isCameraEnabled, false);
    assert.equal(room.connectCalls, 1);
  } finally {
    attempt.dispose();
    useCallStore.setState({ remoteVideoTrack: null });
  }
});

test("a disposed attempt's late token rejection cannot end its replacement (identical ids)", async () => {
  const h = makeHarness();
  const first = h.start();
  const second = h.start();

  // The first attempt is torn down, THEN its deferred token request rejects.
  first.dispose();
  first.gate.reject(new Error("late failure from the disposed attempt"));
  await flush();

  assert.equal(h.lost.count, 0, "the disposed attempt's rejection must never hang up");

  // The replacement attempt still connects normally.
  second.gate.resolve(TOKEN);
  await flush();
  assert.equal(second.room?.connectCalls, 1, "the live attempt must connect");
  assert.equal(h.lost.count, 0);

  second.dispose();
});

test("a disposed attempt's connected-room teardown fires no network_lost", async () => {
  const h = makeHarness();
  const first = h.start();
  const second = h.start();

  // Attempt 1 fully connects before being disposed (StrictMode ordering:
  // token resolves while both instances exist).
  first.gate.resolve(TOKEN);
  await flush();
  assert.equal(first.room?.connectCalls, 1);

  // Cleanup disconnects the room; the real Room then emits "disconnected".
  first.dispose();
  first.room?.emit("disconnected");
  await flush();

  assert.equal(h.lost.count, 0, "the disposed room's teardown must never hang up");

  second.gate.resolve(TOKEN);
  await flush();
  assert.equal(h.lost.count, 0);

  second.dispose();
});

test("a disposed attempt never claims the store's room", async () => {
  const h = makeHarness();
  // Park the first attempt between the track publishes and the store write:
  // the camera gate exists from room construction, before the chain runs.
  const cameraGate = deferred<void>();
  const first = h.start((room) => {
    room.cameraGate = { promise: cameraGate.promise, resolve: cameraGate.resolve };
  });
  const second = h.start();

  first.gate.resolve(TOKEN);
  await flush();
  assert.equal(first.room?.connectCalls, 1);

  // Dispose while parked, then let the publishes finish.
  first.dispose();
  cameraGate.resolve();
  await flush();

  assert.equal(first.room?.disconnectCalls, 1, "the disposed room unwinds with a self-disconnect");
  assert.equal(useCallStore.getState().room, null, "the disposed room must not own the store");
  assert.equal(h.lost.count, 0);

  // The live attempt claims the store.
  second.gate.resolve(TOKEN);
  await flush();
  assert.equal(useCallStore.getState().room, second.room);

  second.dispose();
});

test("a disposed attempt's late media events cannot corrupt the replacement's store", async () => {
  const h = makeHarness();
  // Park the old attempt at its microphone publish (Guardian's round-5 probe).
  const micGate = deferred<void>();
  const first = h.start((room) => {
    room.micGate = { promise: micGate.promise, resolve: micGate.resolve };
  });
  const second = h.start();

  first.gate.resolve(TOKEN);
  await flush();
  assert.equal(first.room?.micEnabledCalls, 1, "the old attempt reached the mic publish");

  // Dispose the old attempt while its mic enable is pending; the replacement
  // connects and receives the live video subscription.
  first.dispose();
  second.gate.resolve(TOKEN);
  await flush();
  assert.equal(useCallStore.getState().room, second.room);

  const liveTrack = { kind: "video" };
  second.room?.emit("trackSubscribed", liveTrack);
  assert.equal(useCallStore.getState().remoteVideoTrack, liveTrack);

  // The old room's late unsubscription must NOT clear the replacement's track.
  let detached = 0;
  const staleTrack = { kind: "video", detach: () => detached++, attach: () => {} };
  first.room?.emit("trackUnsubscribed", staleTrack);
  assert.equal(
    useCallStore.getState().remoteVideoTrack,
    liveTrack,
    "the disposed room's unsubscription must not null the replacement's track",
  );
  assert.equal(detached, 1, "the old room still detaches its own track");

  // A disposed room's late audio level must not drive the replacement either.
  first.room?.emit("activeSpeakersChanged", [{ identity: "remote", audioLevel: 0.9 }]);
  assert.equal(useCallStore.getState().remoteAudioLevel, 0);

  // Unwinding the parked chain never starts the camera and never writes.
  micGate.resolve();
  await flush();
  assert.equal(first.room?.cameraEnabledCalls, 0, "no obsolete camera publish after dispose");
  assert.equal(first.room?.disconnectCalls, 1);
  assert.equal(useCallStore.getState().room, second.room);

  second.dispose();
});

test("a disposed attempt never issues its camera publish", async () => {
  const h = makeHarness();
  const micGate = deferred<void>();
  const only = h.start((room) => {
    room.micGate = { promise: micGate.promise, resolve: micGate.resolve };
  });

  only.gate.resolve(TOKEN);
  await flush();
  assert.equal(only.room?.micEnabledCalls, 1);

  // Dispose between the mic and camera publishes, then let the mic finish.
  only.dispose();
  micGate.resolve();
  await flush();

  assert.equal(only.room?.cameraEnabledCalls, 0, "the disposed room must not request the camera");
  assert.equal(only.room?.disconnectCalls, 1, "the disposed room unwinds with a self-disconnect");
  assert.equal(useCallStore.getState().room, null);
  assert.equal(h.lost.count, 0);
});

test("a LIVE attempt's connect failure still reports network lost", async () => {
  const h = makeHarness();
  const live = h.start();

  live.gate.reject(new Error("boom"));
  await flush();

  assert.equal(h.lost.count, 1, "the live attempt's failure must surface");

  live.dispose();
});
