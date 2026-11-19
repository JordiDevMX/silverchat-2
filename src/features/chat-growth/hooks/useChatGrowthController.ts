import { useRouter } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { shouldShowGrowthCard } from "../lib/growthConfig";
import type { GrowthChatModel } from "../types";

export function useChatGrowthController({
  model,
  messagesReady,
  userMessageCount,
}: {
  model: GrowthChatModel | null;
  messagesReady: boolean;
  userMessageCount: number;
}) {
  const router = useRouter();
  const [storyOpen, setStoryOpen] = useState(false);
  const [inviteOpen, setInviteOpen] = useState(false);
  const modelKey = model ? `${model.type}:${model.id}` : null;
  const prevKeyRef = useRef<string | null>(modelKey);

  useEffect(() => {
    if (prevKeyRef.current !== modelKey) {
      prevKeyRef.current = modelKey;
      setStoryOpen(false);
      setInviteOpen(false);
    }
  }, [modelKey]);

  const visible = Boolean(
    model &&
      shouldShowGrowthCard({
        supported: true,
        isOwnerOrAdmin: model.isOwnerOrAdmin,
        messagesReady,
        userMessageCount,
      }),
  );

  const openStoryShare = useCallback(() => {
    setStoryOpen(true);
  }, []);

  const openSecondaryInvite = useCallback(() => {
    setInviteOpen(true);
  }, []);

  const openEditDescription = useCallback(() => {
    if (!model?.editDescriptionHref) return;
    void router.navigate({ href: model.editDescriptionHref });
  }, [model?.editDescriptionHref, router]);

  return {
    visible,
    storyOpen,
    setStoryOpen,
    inviteOpen,
    setInviteOpen,
    openStoryShare,
    openSecondaryInvite,
    openEditDescription,
    canEditDescription: Boolean(model?.editDescriptionHref),
  };
}
