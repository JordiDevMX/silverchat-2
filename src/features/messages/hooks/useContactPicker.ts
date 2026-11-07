import { useState } from "react";
import { useChats } from "@/features/chats/hooks/useChats";
import type { SendInput } from "../types";
export function useContactPicker(onSend: (input: SendInput) => Promise<void>, onClose: () => void) {
  const contacts = useChats();
  const [query, setQuery] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  const rows = [
    ...new Map(
      (contacts.data ?? [])
        .filter((c) => c.type === "direct" && !c.isBlocked && c.otherUsername)
        .map((c) => [c.otherUserId, c]),
    ).values(),
  ].filter((c) =>
    `${c.displayName} ${c.otherUsername}`.toLowerCase().includes(query.toLowerCase()),
  );
  const sendContact = async (c: (typeof rows)[number]) => {
    setBusy(true);
    try {
      await onSend({
        type: "contact",
        content: null,
        contact_data: {
          user_id: c.otherUserId,
          username: c.otherUsername,
          display_name: c.displayName,
        },
      });
      onClose();
    } catch {
      setError(true);
      onClose();
    } finally {
      setBusy(false);
    }
  };
  return { contacts, query, setQuery, busy, error, rows, sendContact };
}
