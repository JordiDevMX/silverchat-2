import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "@tanstack/react-router";
import { useState } from "react";
import { useI18n } from "@/app/providers/i18n-provider";
import { useChatUIStore } from "@/features/chat-settings/stores/uiStore";
import { useAuth } from "@/lib/auth-provider";
import { supabase } from "@/lib/supabase";

export interface CreateGroupChatInput {
  name: string;
  memberIds: string[];
}

export function validateGroupChatInput(
  name: string,
  memberIds: string[],
  currentUserId?: string,
  language = "en",
):
  | { valid: true; trimmedName: string; uniqueMemberIds: string[] }
  | { valid: false; error: string } {
  const isEs = language === "es";
  const trimmedName = name.trim();

  if (trimmedName.length < 1) {
    return {
      valid: false,
      error: isEs ? "El nombre del grupo es obligatorio" : "Group name is required",
    };
  }

  if (trimmedName.length > 100) {
    return {
      valid: false,
      error: isEs
        ? "El nombre del grupo debe tener entre 1 y 100 caracteres"
        : "Group name must be between 1 and 100 characters",
    };
  }

  const uniqueMemberIds = [
    ...new Set(memberIds.filter((id) => Boolean(id) && id !== currentUserId)),
  ];

  if (uniqueMemberIds.length < 1) {
    return {
      valid: false,
      error: isEs
        ? "Selecciona al menos 1 miembro para crear el grupo"
        : "Select at least 1 member to create a group",
    };
  }

  if (uniqueMemberIds.length > 100) {
    return {
      valid: false,
      error: isEs ? "Puedes seleccionar hasta 100 miembros" : "You can select up to 100 members",
    };
  }

  return {
    valid: true,
    trimmedName,
    uniqueMemberIds,
  };
}

export function formatGroupChatError(error: unknown, language = "en"): string {
  const raw =
    error instanceof Error
      ? error.message
      : typeof error === "object" && error !== null && "message" in error
        ? String((error as { message: unknown }).message)
        : String(error ?? "");

  const isEs = language === "es";

  if (/blocked/i.test(raw)) {
    return isEs
      ? "No puedes añadir a un usuario bloqueado al grupo"
      : "You can't add a blocked user to the group";
  }

  if (/group name/i.test(raw)) {
    return isEs ? "El nombre del grupo es obligatorio" : "Group name is required";
  }

  if (/1 to 255|select at least|member/i.test(raw)) {
    return isEs
      ? "Selecciona al menos 1 miembro para crear el grupo"
      : "Select at least 1 member to create a group";
  }

  return (
    raw ||
    (isEs
      ? "No se pudo crear el grupo. Inténtalo de nuevo."
      : "Could not create group. Please try again.")
  );
}

export function useCreateGroupChat() {
  const queryClient = useQueryClient();
  const router = useRouter();
  const { user } = useAuth();
  const { language } = useI18n();
  const notify = useChatUIStore((s) => s.notify);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: async (input: CreateGroupChatInput): Promise<string> => {
      const validation = validateGroupChatInput(input.name, input.memberIds, user?.id, language);
      if (!validation.valid) {
        throw new Error(validation.error);
      }

      const { data, error } = await supabase.rpc("create_group_chat", {
        p_name: validation.trimmedName,
        p_member_ids: validation.uniqueMemberIds,
      });

      if (error) throw error;
      if (!data) throw new Error("No group chat ID returned");
      return data;
    },
    onMutate: () => {
      setErrorMessage(null);
    },
    onSuccess: async (chatId) => {
      void queryClient.invalidateQueries({ queryKey: ["chats"] });
      await router.navigate({ href: `/chats/${chatId}` });
    },
    onError: (err) => {
      const message = formatGroupChatError(err, language);
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
