import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "@tanstack/react-router";
import { useState } from "react";
import { useI18n } from "@/app/providers/i18n-provider";
import { useChatUIStore } from "@/features/chat-settings/stores/uiStore";
import { supabase } from "@/lib/supabase";

export type CreateDirectChatInput =
  | string
  | {
      targetUserId: string;
      initialContent?: string;
    };

export function formatDirectChatError(
  error: unknown,
  language = "en",
  nowMs: number = Date.now(),
): string {
  const raw =
    error instanceof Error
      ? error.message
      : typeof error === "object" && error !== null && "message" in error
        ? String((error as { message: unknown }).message)
        : String(error ?? "");

  const isEs = language === "es";

  const cooldownMatch = raw.match(/cooldown active(?:\s*:\s*try again in\s*(\d+)\s*days?)?/i);
  if (cooldownMatch) {
    const days = Math.max(1, Number.parseInt(cooldownMatch[1] ?? "7", 10) || 7);
    const retryDate = new Date(nowMs + days * 86_400_000);
    const formattedDate = new Intl.DateTimeFormat(isEs ? "es" : "en", {
      month: "short",
      day: "numeric",
      year: "numeric",
    }).format(retryDate);
    return isEs
      ? `Aún no puedes enviar mensajes a este usuario. Inténtalo de nuevo el ${formattedDate}`
      : `You can't message this user yet. Try again on ${formattedDate}`;
  }

  if (/blocked/i.test(raw)) {
    return isEs ? "No puedes enviar mensajes a este usuario" : "You can't message this user";
  }

  if (/choose another user|create_self_chat|yourself/i.test(raw)) {
    return isEs ? "No puedes enviarte un mensaje desde aquí" : "You can't message this user";
  }

  return isEs
    ? "No se pudo iniciar la conversación. Inténtalo de nuevo."
    : "Could not start conversation. Please try again.";
}

export function useCreateDirectChat() {
  const queryClient = useQueryClient();
  const router = useRouter();
  const { language } = useI18n();
  const notify = useChatUIStore((s) => s.notify);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: async (input: CreateDirectChatInput): Promise<string> => {
      const targetUserId = typeof input === "string" ? input : input.targetUserId;
      const initialContent = typeof input === "string" ? "" : (input.initialContent ?? "");

      const { data, error } = await supabase.rpc("create_direct_chat_request", {
        p_target_user_id: targetUserId,
        p_initial_content: initialContent,
      });

      if (error) throw error;
      if (!data) throw new Error("No chat ID returned");
      return data;
    },
    onMutate: () => {
      setErrorMessage(null);
    },
    onSuccess: async (chatId) => {
      void queryClient.invalidateQueries({ queryKey: ["chats"] });
      void queryClient.invalidateQueries({ queryKey: ["direct-contacts"] });
      void queryClient.invalidateQueries({ queryKey: ["contacts"] });
      void queryClient.invalidateQueries({ queryKey: ["message-requests"] });
      await router.navigate({ href: `/chats/${chatId}` });
    },
    onError: (err) => {
      const message = formatDirectChatError(err, language);
      setErrorMessage(message);
      notify(message);
    },
  });

  return {
    ...mutation,
    errorMessage,
    clearError: () => setErrorMessage(null),
  };
}

