import { useQueryClient } from "@tanstack/react-query";
import { type FormEvent, useRef, useState } from "react";
import { useChatUIStore } from "@/features/chat-settings/stores/uiStore";
import { useMessageText } from "@/features/messages/i18n";
import { useAuth } from "@/lib/auth-provider";
import { supabase } from "@/lib/supabase";
import type { Story } from "../../types";
export function useStoryReply(story: Story, onFocusChange: (open: boolean) => void) {
  const { user } = useAuth();
  const { say } = useMessageText();
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  const pending = useRef<{ id: string; content: string; chat?: string } | undefined>(undefined);
  const cache = useQueryClient();
  const submit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (busy || !text.trim()) return;
    setBusy(true);
    setError(false);
    onFocusChange(true);
    const input =
      pending.current?.content === text.trim()
        ? pending.current
        : { id: crypto.randomUUID(), content: text.trim() };
    pending.current = input;
    try {
      if (!input.chat) {
        const r = await supabase.rpc("create_direct_chat_request", {
          p_target_user_id: story.user_id,
          p_initial_content: "",
        });
        if (r.error) throw r.error;
        input.chat = r.data;
      }
      const r = await supabase.from("messages").insert({
        id: input.id,
        chat_id: input.chat,
        sender_id: user?.id ?? "",
        type: "text",
        content: input.content,
        reply_to_story_id: story.id,
      });
      if (r.error) {
        const existing = await supabase
          .from("messages")
          .select("id")
          .eq("id", input.id)
          .eq("sender_id", user?.id ?? "")
          .eq("chat_id", input.chat)
          .maybeSingle();
        if (existing.error || !existing.data) throw r.error;
      }
      setText("");
      pending.current = undefined;
      onFocusChange(false);
      useChatUIStore.getState().notify(say("Reply sent", "Respuesta enviada"));
      void cache.invalidateQueries({ queryKey: ["chats", user?.id] });
      void cache.invalidateQueries({ queryKey: ["messages", user?.id, input.chat] });
    } catch {
      setError(true);
    } finally {
      setBusy(false);
    }
  };
  return { say, text, setText, busy, error, submit };
}
