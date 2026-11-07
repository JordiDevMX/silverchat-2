import { useRouter } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useChatUIStore } from "@/features/chat-settings/stores/uiStore";
import { useChatText } from "../i18n";
import { useCreateDirectChat } from "./useCreateDirectChat";
import { useDirectContacts, useUserSearch } from "./useUserSearch";

export function useNewChatPage() {
  const t = useChatText();
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState("");
  const contacts = useDirectContacts();
  const search = useUserSearch(query);
  const createDirectChat = useCreateDirectChat();
  const clearNotice = useChatUIStore((s) => s.notify);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        if (createDirectChat.errorMessage) {
          createDirectChat.clearError();
          clearNotice("");
        }
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [createDirectChat, clearNotice]);

  const trimmedQuery = query.trim();
  const isSearching = trimmedQuery.length > 0;

  const openContact = (chatId: string) => void router.navigate({ href: `/chats/${chatId}` });
  const chooseResult = (userId: string) => {
    const existing = contacts.data?.find((contact) => contact.user.id === userId);
    if (existing) openContact(existing.chatId);
    else createDirectChat.mutate(userId);
  };
  const changeQuery = (value: string) => {
    setQuery(value);
    if (createDirectChat.errorMessage) createDirectChat.clearError();
  };
  const dismissError = () => {
    createDirectChat.clearError();
    clearNotice("");
  };
  return {
    openContact,
    chooseResult,
    changeQuery,
    dismissError,
    t,
    router,
    inputRef,
    query,
    setQuery,
    contacts,
    search,
    createDirectChat,

    trimmedQuery,
    isSearching,
  };
}
