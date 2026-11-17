// LiveKit token fetch (13). The Edge Function URL and key are infra-owned;
// the access token comes from the shared auth module (same one the Supabase
// client uses), so the BFF-consistent token is reused.
import { getAccessToken } from "@/lib/auth";

export interface LiveKitJoinInfo {
  token: string;
  url?: string;
  room: string;
}

export async function fetchLiveKitToken(callId: string): Promise<LiveKitJoinInfo> {
  const token = getAccessToken();
  if (!token) throw new Error("Not authenticated");
  const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/livekit-token`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ call_id: callId }),
  });
  if (!response.ok) throw new Error(`livekit-token failed with ${response.status}`);
  return (await response.json()) as LiveKitJoinInfo;
}
