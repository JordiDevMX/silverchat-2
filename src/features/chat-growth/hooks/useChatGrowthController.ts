import { useRouter } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { readGrowthDismissed, writeGrowthDismissed } from "../lib/dismissal";
import { shouldAutoShowGrowthDialog } from "../lib/growthConfig";
import type { GrowthChatModel } from "../types";

export function useChatGrowthController({
  userId,
  model,
  messagesReady = true,
  messageCount = 0,
  autoShowEnabled = true,
  onEditDescriptionOverride,
}: {
  userId: string | undefined;
  model: GrowthChatModel | null;
  messagesReady?: boolean;
  messageCount?: number;
  autoShowEnabled?: boolean;
  onEditDescriptionOverride?: () => void;
}) {
  const router = useRouter();
  const [autoOpen, setAutoOpen] = useState(false);
  const [manualOpen, setManualOpen] = useState(false);
  const [storyOpen, setStoryOpen] = useState(false);
  const [inviteOpen, setInviteOpen] = useState(false);
  const modelKey = model && userId ? `${userId}:${model.type}:${model.id}` : null;
  const modelType = model?.type;
  const modelId = model?.id;
  const isOwnerOrAdmin = model?.isOwnerOrAdmin ?? false;
  const prevKeyRef = useRef<string | null>(modelKey);
  const handledKeyRef = useRef<string | null>(null);

  useEffect(() => {
    if (prevKeyRef.current !== modelKey) {
      prevKeyRef.current = modelKey;
      handledKeyRef.current = null;
      setAutoOpen(false);
      setManualOpen(false);
      setStoryOpen(false);
      setInviteOpen(false);
    }
    if (!autoShowEnabled || !modelType || !modelId || !userId || !modelKey) return;
    if (handledKeyRef.current === modelKey) return;
    const dismissed = readGrowthDismissed(window.localStorage, userId, modelType, modelId);
    if (
      shouldAutoShowGrowthDialog({
        supported: true,
        isOwnerOrAdmin,
        messagesReady,
        messageCount,
        dismissed,
      })
    ) {
      handledKeyRef.current = modelKey;
      setAutoOpen(true);
    } else if (messagesReady) {
      handledKeyRef.current = modelKey;
    }
  }, [
    autoShowEnabled,
    isOwnerOrAdmin,
    messageCount,
    messagesReady,
    modelId,
    modelKey,
    modelType,
    userId,
  ]);

  const dismiss = useCallback(() => {
    if (modelType && modelId && userId) {
      writeGrowthDismissed(window.localStorage, userId, modelType, modelId);
    }
    setAutoOpen(false);
    setManualOpen(false);
  }, [modelId, modelType, userId]);

  const openManually = useCallback(() => {
    if (!isOwnerOrAdmin) return;
    setManualOpen(true);
  }, [isOwnerOrAdmin]);

  const openStoryShare = useCallback(() => {
    dismiss();
    setStoryOpen(true);
  }, [dismiss]);

  const openSecondaryInvite = useCallback(() => {
    dismiss();
    setInviteOpen(true);
  }, [dismiss]);

  const openEditDescription = useCallback(() => {
    if (onEditDescriptionOverride) {
      dismiss();
      onEditDescriptionOverride();
      return;
    }
    if (!model?.editDescriptionHref) return;
    dismiss();
    void router.navigate({ href: model.editDescriptionHref });
  }, [dismiss, model?.editDescriptionHref, onEditDescriptionOverride, router]);

  return {
    dialogOpen: autoOpen || manualOpen,
    storyOpen,
    setStoryOpen,
    inviteOpen,
    setInviteOpen,
    dismiss,
    openManually,
    openStoryShare,
    openSecondaryInvite,
    openEditDescription,
    canEditDescription: Boolean(onEditDescriptionOverride || model?.editDescriptionHref),
  };
}
