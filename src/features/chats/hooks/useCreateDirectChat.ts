import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "@tanstack/react-router";
import { useState } from "react";
import { useI18n } from "@/app/providers/i18n-provider";
import { useChatUIStore } from "@/features/chat-settings/stores/uiStore";
import { useAuth } from "@/lib/auth-provider";
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

  const untilMatch = raw.match(/cooldown active until\s+([^\s,;]+)/i);
  if (untilMatch?.[1]) {
    const parsed = Date.parse(untilMatch[1]);
    const retryDate = Number.isFinite(parsed) ? new Date(parsed) : new Date(nowMs + 7 * 86_400_000);
    const formattedDate = new Intl.DateTimeFormat(isEs ? "es" : "en", {
      month: "short",
      day: "numeric",
      year: "numeric",
    }).format(retryDate);
    return isEs
      ? `Aún no puedes enviar mensajes a este usuario. Inténtalo de nuevo el ${formattedDate}`
      : `You can't message this user yet. Try again on ${formattedDate}`;
  }

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
  const { user } = useAuth();
  const { language } = useI18n();
  const notify = useChatUIStore((s) => s.notify);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: async (input: CreateDirectChatInput): Promise<string> => {
      const targetUserId = typeof input === "string" ? input : input.targetUserId;
      const rawContent = typeof input === "string" ? "" : (input.initialContent ?? "");
      const initialContent = rawContent.trim() ? rawContent : "👋";

      if (user?.id && targetUserId === user.id) {
        throw new Error("Choose another user; use create_self_chat for yourself");
      }

      if (user?.id) {
        const pairKey =
          user.id < targetUserId ? `${user.id}::${targetUserId}` : `${targetUserId}::${user.id}`;

        const [existingChat, recentRequests] = await Promise.all([
          supabase
            .from("chats")
            .select("id, status")
            .eq("direct_pair_key", pairKey)
            .in("status", ["active", "pending_request"])
            .maybeSingle(),
          supabase
            .from("chat_requests")
            .select("status, responded_at")
            .or(
              `and(sender_id.eq.${user.id},recipient_id.eq.${targetUserId}),and(sender_id.eq.${targetUserId},recipient_id.eq.${user.id})`,
            )
            .order("created_at", { ascending: false })
            .limit(5),
        ]);

        if (existingChat.data?.id) {
          return existingChat.data.id;
        }

        const latestRequest = (recentRequests.data ?? [])[0];
        if (latestRequest?.status === "rejected" && latestRequest.responded_at) {
          const rejectedMs = Date.parse(latestRequest.responded_at);
          const cooldownUntilMs = rejectedMs + 7 * 86_400_000;
          if (Number.isFinite(rejectedMs) && cooldownUntilMs > Date.now()) {
            throw new Error(
              `Message request cooldown active until ${new Date(cooldownUntilMs).toISOString()}`,
            );
          }
        }
      }

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
