// LiveKit room lifecycle (13): token fetch → connect → publish tracks → wire
// events into the store. Mounted by the active-call modals; cleanup always
// disconnects so leaving the modal never leaks a room.
import {
  type LocalAudioTrack,
  type LocalVideoTrack,
  type Participant,
  type RemoteAudioTrack,
  type RemoteTrack,
  type RemoteVideoTrack,
  Room,
  RoomEvent,
  Track,
  VideoPresets,
} from "livekit-client";
import { useEffect } from "react";
import { hangupActiveCall } from "../lib/callActions";
import { fetchLiveKitToken } from "../lib/livekit";
import { useCallStore } from "../stores/callStore";

export function useLiveKitRoom(callId: string, mode: "voice" | "video") {
  useEffect(() => {
    let room: Room | null = null;
    let cancelled = false;

    const connect = async () => {
      const { token, url } = await fetchLiveKitToken(callId);
      if (!url) throw new Error("LiveKit URL missing");

      room = new Room({
        adaptiveStream: true,
        dynacast: true,
        videoCaptureDefaults: { resolution: VideoPresets.h720.resolution },
      });

      room
        .on(RoomEvent.TrackSubscribed, (track: RemoteTrack) => {
          if (track.kind === Track.Kind.Video) {
            useCallStore.setState({ remoteVideoTrack: track as RemoteVideoTrack });
          } else if (track.kind === Track.Kind.Audio) {
            useCallStore.setState({ remoteAudioTrack: track as RemoteAudioTrack });
            track.attach();
          }
        })
        .on(RoomEvent.TrackUnsubscribed, (track: RemoteTrack) => {
          if (track.kind === Track.Kind.Video) useCallStore.setState({ remoteVideoTrack: null });
          if (track.kind === Track.Kind.Audio) useCallStore.setState({ remoteAudioTrack: null });
          track.detach();
        })
        .on(RoomEvent.ActiveSpeakersChanged, (speakers: Participant[]) => {
          // LiveKit's built-in analyser (cheaper than polling): any non-local
          // speaker drives the remote waveform; silence resets it.
          const localIdentity = room?.localParticipant.identity;
          const remote = speakers.find((speaker) => speaker.identity !== localIdentity);
          useCallStore.setState({ remoteAudioLevel: Math.round((remote?.audioLevel ?? 0) * 100) });
        })
        .on(RoomEvent.Disconnected, () => {
          // Own socket drop: attempt a graceful end with the honest reason.
          // Only when THIS call still owns the store (AUD-003, round 3): a
          // late callback after the modal unmounted and a new call took over
          // must never tear down the new call.
          if (useCallStore.getState().call?.id !== callId) return;
          void hangupActiveCall("network_lost");
        });

      await room.connect(url, token);
      if (cancelled) {
        await room.disconnect();
        return;
      }

      // Publish order matters on Safari: mic first, then camera (L-decision).
      await room.localParticipant.setMicrophoneEnabled(true);
      await room.localParticipant.setCameraEnabled(mode === "video");

      useCallStore.setState({
        room,
        localAudioTrack:
          (room.localParticipant.getTrackPublication(Track.Source.Microphone)?.track as
            | LocalAudioTrack
            | undefined) ?? null,
        localVideoTrack:
          (room.localParticipant.getTrackPublication(Track.Source.Camera)?.track as
            | LocalVideoTrack
            | undefined) ?? null,
        isMicEnabled: true,
        isCameraEnabled: mode === "video",
      });
    };

    connect().catch((error) => {
      console.error("[useLiveKitRoom]", error);
      // Same ownership guard as the Disconnected handler: a failure surfaced
      // after a newer call claimed the store belongs to a stale room.
      if (useCallStore.getState().call?.id !== callId) return;
      void hangupActiveCall("network_lost");
    });

    return () => {
      cancelled = true;
      void room?.disconnect();
    };
  }, [callId, mode]);
}
