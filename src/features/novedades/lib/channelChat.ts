import type { ChatDetails } from "../../messages/types.ts";
import type { Channel, ChannelStaffRole } from "../types.ts";

export function channelChat(c: Channel, staffRole: ChannelStaffRole = null): ChatDetails {
  return {
    id: c.id,
    type: "direct",
    status: "active",
    name: c.name,
    avatar: c.avatar_url,
    createdBy: null,
    createdAt: c.created_at,
    description: c.description,
    members: [],
    onlyAdminsCanSend: false,
    readOnly: staffRole === null,
    channelMode: true,
    channelStaffRole: staffRole,
  };
}
