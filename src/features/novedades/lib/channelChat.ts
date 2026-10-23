import type { ChatDetails } from "@/features/messages/types";
import type { Channel } from "../types";
export function channelChat(c: Channel, canReact = true): ChatDetails {
  return {
    id: c.id,
    type: "direct",
    status: "active",
    name: c.name,
    avatar: c.avatar_url,
    createdBy: c.owner_id,
    createdAt: c.created_at,
    description: c.description,
    members: [],
    readOnly: !canReact,
    channelMode: true,
  };
}
