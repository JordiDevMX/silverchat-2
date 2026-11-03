import { useRouter } from "@tanstack/react-router";
import type { FormEvent } from "react";
import { useState } from "react";
import { useMessageText } from "@/features/messages/i18n";
import { useCreateCommunityChat } from "../hooks/useCreateCommunityChat";
export function useCreateCommunityChatDialog(communityId: string, onClose: () => void) {
  const { say } = useMessageText();
  const router = useRouter();
  const mutation = useCreateCommunityChat(communityId);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const submit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!name.trim() || mutation.isPending) return;
    try {
      const id = await mutation.mutateAsync({ name, description });
      await router.navigate({ href: `/communities/${communityId}/chats/${id}` });
      onClose();
    } catch {
      /* Mutation error is rendered below. */
    }
  };
  return { say, name, setName, description, setDescription, mutation, submit };
}
