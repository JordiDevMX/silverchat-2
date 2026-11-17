// Global call state (7.1). Single active call per client (L12); LiveKit
// handles and tracks live here so modals and hooks share one source of truth.
import type {
  LocalAudioTrack,
  LocalVideoTrack,
  RemoteAudioTrack,
  RemoteVideoTrack,
  Room,
} from "livekit-client";
import { create } from "zustand";
import type { CallParticipant, CallPhase, CallType } from "../types";

export type { CallParticipant };

export interface ActiveCall {
  id: string;
  chatId: string;
  type: CallType;
  roomName: string;
  initiatorId: string | null;
}

const defaults = {
  phase: "idle" as CallPhase,
  call: null as ActiveCall | null,
  other: null as CallParticipant | null,
  room: null as Room | null,
  localVideoTrack: null as LocalVideoTrack | null,
  localAudioTrack: null as LocalAudioTrack | null,
  remoteVideoTrack: null as RemoteVideoTrack | null,
  remoteAudioTrack: null as RemoteAudioTrack | null,
  isMicEnabled: true,
  isCameraEnabled: false,
  isSpeakerOn: true,
  remoteAudioLevel: 0,
  localAudioLevel: 0,
  answeredAt: null as string | null,
  ringStartedAt: null as string | null,
  /** Transient status line (the app has no toast system; same role="status"
   * pattern as ChatSettingsNotice). Cleared by the renderer after a timeout. */
  note: null as string | null,
};

type CallStore = typeof defaults;

export const useCallStore = create<CallStore>(() => ({ ...defaults }));

/** Back to idle. Callers disconnect the LiveKit room first (9.4) so no media
 * stream outlives the state reset. */
export function resetCallStore() {
  useCallStore.setState({ ...defaults, note: useCallStore.getState().note });
}

/** Set the transient status note. */
export function notifyCall(note: string | null) {
  useCallStore.setState({ note });
}

/** Enter the incoming-ringing phase with the resolved peer profile. */
export function enterIncomingCall(call: ActiveCall, other: CallParticipant, ringStartedAt: string) {
  useCallStore.setState({ ...defaults, phase: "incoming-ringing", call, other, ringStartedAt });
}

/** Enter the outgoing-ringing phase after start_call succeeded. */
export function enterOutgoingCall(call: ActiveCall, other: CallParticipant, ringStartedAt: string) {
  useCallStore.setState({ ...defaults, phase: "outgoing-ringing", call, other, ringStartedAt });
}
