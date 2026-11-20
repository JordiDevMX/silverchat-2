// LiveKit room lifecycle (13): token fetch → connect → publish tracks → wire
// events into the store. Mounted by the active-call modals; cleanup always
// disconnects so leaving the modal never leaks a room. The connection logic
// lives in lib/roomConnection.ts (injectable deps → unit-testable guards);
// this hook supplies the real Room and maps a network loss to the hangup.
import { Room, VideoPresets } from "livekit-client";
import { useEffect } from "react";
import { hangupActiveCall } from "../lib/callActions";
import { fetchLiveKitToken } from "../lib/livekit";
import { startRoomConnection } from "../lib/roomConnection";

export function useLiveKitRoom(callId: string, mode: "voice" | "video") {
  useEffect(() => {
    return startRoomConnection(callId, mode, {
      fetchToken: fetchLiveKitToken,
      createRoom: () =>
        new Room({
          adaptiveStream: true,
          dynacast: true,
          videoCaptureDefaults: { resolution: VideoPresets.h720.resolution },
        }),
      onNetworkLost: () => void hangupActiveCall("network_lost"),
    });
  }, [callId, mode]);
}
