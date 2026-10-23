import { Composer } from "@/features/messages/components/Composer";
import type { SendInput } from "@/features/messages/types";
import { channelChat } from "../../lib/channelChat";
import type { Channel } from "../../types";
export function ChannelComposer({
  channel,
  onSend,
}: {
  channel: Channel;
  onSend: (input: SendInput) => Promise<void>;
}) {
  return (
    <Composer
      chat={channelChat(channel)}
      onSend={onSend}
      replyToId={null}
      onClearReply={() => {}}
    />
  );
}
