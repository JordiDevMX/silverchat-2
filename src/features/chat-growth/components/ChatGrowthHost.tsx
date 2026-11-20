import { AddMembersModal } from "@/features/chat-settings/components/AddMembersModal";
import type { ChatDetails } from "@/features/messages/types";
import { StoryCreator } from "@/features/novedades/components/stories/StoryCreator";
import type { useChatGrowthController } from "../hooks/useChatGrowthController";
import type { GrowthChatModel } from "../types";
import { ChannelInviteAdminModal } from "./ChannelInviteAdminModal";

export function ChatGrowthHost({
  model,
  controller,
  addMembersChat,
  addMembersContext = "group",
}: {
  model: GrowthChatModel | null;
  controller: ReturnType<typeof useChatGrowthController>;
  addMembersChat?: ChatDetails | null;
  addMembersContext?: "group" | "community";
}) {
  if (!model) return null;
  return (
    <>
      {controller.storyOpen && (
        <StoryCreator
          initialMode="text"
          initialText={model.storyPrefillText}
          onClose={() => controller.setStoryOpen(false)}
        />
      )}
      {controller.inviteOpen &&
        (addMembersChat ? (
          <AddMembersModal
            chat={addMembersChat}
            context={addMembersContext}
            onClose={() => controller.setInviteOpen(false)}
          />
        ) : (
          <ChannelInviteAdminModal
            chatType={model.type}
            chatName={model.name}
            inviteUrl={model.inviteUrl}
            onClose={() => controller.setInviteOpen(false)}
          />
        ))}
    </>
  );
}
