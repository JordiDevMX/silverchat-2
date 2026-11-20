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
import { ringDeadlineFrom } from "../lib/callState.ts";
import { type CallParticipant, type CallPhase, type CallType, RING_TIMEOUT_MS } from "../types.ts";

export type { CallParticipant };

export interface ActiveCall {
  id: string;
  chatId: string;
  type: CallType;
  roomName: string;
  initiatorId: string | null;
}

const defaults = {
  busyPeer: null as CallParticipant | null,
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
  /** Monotonic deadline (performance.now()) for the ring window, so wall-clock
   * changes cannot shorten or extend it. See ringDeadlineFrom. */
  ringDeadline: null as number | null,
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

/** Reset only when the given call is still the active one. Every post-await
 * path uses this so a lost race cannot wipe out a newly arrived call
 * (Guardian round 2, AUD-003). */
export function resetCallStoreIfCurrent(callId: string): void {
  if (useCallStore.getState().call?.id !== callId) return;
  resetCallStore();
}

/** Set the transient status note. */
export function notifyCall(note: string | null) {
  useCallStore.setState({ note });
}

/** Enter the incoming-ringing phase with the resolved peer profile. The ring
 * window comes from the server verdict, not from a local clock comparison. */
export function enterIncomingCall(call: ActiveCall, other: CallParticipant, expiresInMs: number) {
  useCallStore.setState({
    ...defaults,
    phase: "incoming-ringing",
    call,
    other,
    ringDeadline: ringDeadlineFrom(expiresInMs),
  });
}

/** Enter the outgoing-ringing phase after start_call succeeded. */
export function enterOutgoingCall(call: ActiveCall, other: CallParticipant) {
  useCallStore.setState({
    ...defaults,
    phase: "outgoing-ringing",
    call,
    other,
    ringDeadline: ringDeadlineFrom(RING_TIMEOUT_MS),
  });
}
