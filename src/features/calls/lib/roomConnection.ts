// LiveKit room connection lifecycle (13), extracted from useLiveKitRoom so
// the disposed-attempt guards (AUD-003, round 4) are unit-testable: the hook
// supplies the real Room/token implementations, tests inject fakes, and this
// module never imports livekit-client at runtime (types only).
import type {
  LocalAudioTrack,
  LocalVideoTrack,
  RemoteAudioTrack,
  RemoteVideoTrack,
  Room,
} from "livekit-client";
import { useCallStore } from "../stores/callStore.ts";

/** Structural shape of the livekit-client Room surface this module uses.
 * The real Room satisfies it; tests pass a fake. Event names and track
 * source keys are the library's string values ("trackSubscribed",
 * "microphone", …). */
export interface RoomLike {
  on(event: string, cb: (...args: never[]) => void): RoomLike;
  connect(url: string, token: string): Promise<void>;
  disconnect(): Promise<void>;
  localParticipant: {
    identity: string;
    setMicrophoneEnabled(enabled: boolean): Promise<unknown>;
    setCameraEnabled(enabled: boolean): Promise<unknown>;
    getTrackPublication(source: string): { track?: unknown } | undefined;
  };
}

export interface RoomConnectionDeps {
  fetchToken: (callId: string) => Promise<{ token: string; url?: string | null }>;
  createRoom: () => RoomLike;
  /** Invoked when the LIVE attempt loses its socket or fails to connect. */
  onNetworkLost: () => void;
}

/** Start the room connection for a call. Returns the dispose function the
 * effect cleanup must call. AUD-003 (rounds 4-5): StrictMode — and any
 * remount with the same call id — runs two attempts sharing ONE call id,
 * so a call-id ownership check alone cannot tell a disposed attempt from
 * the live one. Every late callback (disconnected, media events, connect
 * failure), every post-await step and every publish checks the per-attempt
 * `disposed` flag: a disposed attempt never tears down its replacement,
 * never reports network_lost, never attaches or clears media state, never
 * starts another publish, and never overwrites the store's room. */
export function startRoomConnection(
  callId: string,
  mode: "voice" | "video",
  deps: RoomConnectionDeps,
): () => void {
  const { fetchToken, createRoom, onNetworkLost } = deps;
  let room: RoomLike | null = null;
  let disposed = false;
  // One disconnect per room: the effect cleanup and the disposed unwind
  // paths below may both run for the same room (whichever lands first);
  // Room.disconnect() twice is harmless but the second call is noise.
  let roomTornDown = false;
  const ownsStore = () => useCallStore.getState().call?.id === callId;

  const teardownRoom = async () => {
    if (!room || roomTornDown) return;
    roomTornDown = true;
    await room.disconnect();
  };

  const connect = async () => {
    const { token, url } = await fetchToken(callId);
    if (disposed) return;
    if (!url) throw new Error("LiveKit URL missing");

    room = createRoom();

    room
      .on("trackSubscribed", (track: unknown) => {
        // AUD-003 (round 5): media events of a disposed attempt must never
        // reach the store — a late video subscription from the old room
        // would overwrite the replacement's tracks (and attach stale audio
        // to the DOM).
        if (disposed) return;
        if ((track as { kind?: string }).kind === "video") {
          useCallStore.setState({ remoteVideoTrack: track as RemoteVideoTrack });
        } else if ((track as { kind?: string }).kind === "audio") {
          useCallStore.setState({ remoteAudioTrack: track as RemoteAudioTrack });
          (track as { attach(): void }).attach();
        }
      })
      .on("trackMuted", (publication: { track?: unknown }, participant: { identity: string }) => {
        if (
          !disposed &&
          participant.identity !== room?.localParticipant.identity &&
          publication.track === useCallStore.getState().remoteVideoTrack
        ) {
          useCallStore.setState({ remoteVideoTrack: null });
        }
      })
      .on(
        "trackUnmuted",
        (publication: { videoTrack?: RemoteVideoTrack }, participant: { identity: string }) => {
          if (
            !disposed &&
            participant.identity !== room?.localParticipant.identity &&
            publication.videoTrack
          ) {
            useCallStore.setState({ remoteVideoTrack: publication.videoTrack });
          }
        },
      )
      .on("trackUnsubscribed", (track: unknown) => {
        // AUD-003 (round 5): the probe interleaving — the old room's late
        // unsubscription nulled the replacement's remoteVideoTrack. Store
        // writes are per-attempt; the track's own detach still runs so the
        // disposed room cleans up its own DOM element.
        if (!disposed) {
          if ((track as { kind?: string }).kind === "video") {
            useCallStore.setState({ remoteVideoTrack: null });
          }
          if ((track as { kind?: string }).kind === "audio") {
            useCallStore.setState({ remoteAudioTrack: null });
          }
        }
        (track as { detach(): void }).detach();
      })
      .on("activeSpeakersChanged", (speakers: unknown) => {
        // AUD-003 (round 5): a disposed attempt must not drive the
        // replacement's remote waveform.
        if (disposed) return;
        // LiveKit's built-in analyser (cheaper than polling): any non-local
        // speaker drives the remote waveform; silence resets it.
        const localIdentity = room?.localParticipant.identity;
        const remote = (speakers as { identity: string; audioLevel: number }[]).find(
          (speaker) => speaker.identity !== localIdentity,
        );
        useCallStore.setState({ remoteAudioLevel: Math.round((remote?.audioLevel ?? 0) * 100) });
      })
      .on("disconnected", () => {
        // Intentional cleanup disconnects fire this too: a disposed attempt
        // (own teardown, or the loser of a same-id remount) must never
        // report network_lost (AUD-003, round 4).
        if (disposed) return;
        // Only when THIS call still owns the store (AUD-003, round 3): a
        // late callback after the modal unmounted and a new call took over
        // must never tear down the new call.
        if (!ownsStore()) return;
        onNetworkLost();
      });

    await room.connect(url, token);
    if (disposed) {
      await teardownRoom();
      return;
    }

    // Publish order matters on Safari: mic first, then camera (L-decision).
    await room.localParticipant.setMicrophoneEnabled(true);
    // AUD-003 (round 5): check between the publishes too — the probe caught
    // a disposed attempt requesting an obsolete camera enable. A disposed
    // room unwinds without ever starting the camera.
    if (disposed) {
      await teardownRoom();
      return;
    }
    await room.localParticipant.setCameraEnabled(mode === "video");
    // Re-check after the awaited publishes: the effect may have been
    // disposed meanwhile; a disposed room must never claim the store.
    if (disposed) {
      await teardownRoom();
      return;
    }

    useCallStore.setState({
      room: room as Room,
      localAudioTrack:
        (room.localParticipant.getTrackPublication("microphone")?.track as
          | LocalAudioTrack
          | undefined) ?? null,
      localVideoTrack:
        (room.localParticipant.getTrackPublication("camera")?.track as
          | LocalVideoTrack
          | undefined) ?? null,
      isMicEnabled: true,
      isCameraEnabled: mode === "video",
    });
  };

  connect().catch((error) => {
    console.error("[useLiveKitRoom]", error);
    // AUD-003 (round 4): a disposed attempt's late failure belongs to a
    // room that was already torn down — never hang up the replacement.
    if (disposed) return;
    // Same ownership guard as the Disconnected handler: a failure surfaced
    // after a newer call claimed the store belongs to a stale room.
    if (!ownsStore()) return;
    onNetworkLost();
  });

  return () => {
    disposed = true;
    void teardownRoom();
  };
}
