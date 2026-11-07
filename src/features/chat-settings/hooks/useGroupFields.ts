import { useState } from "react";
import { useMessageText } from "@/features/messages/i18n";
import type { ChatDetails } from "@/features/messages/types";
export function useGroupFields(
  chat: ChatDetails,
  onSave: (patch: { name?: string; description?: string }) => Promise<void>,
) {
  const { say } = useMessageText();
  const [name, setName] = useState(chat.name);
  const [description, setDescription] = useState(chat.description ?? "");
  const [error, setError] = useState("");
  const save = async (field: "name" | "description") => {
    const value = field === "name" ? name : description;
    const original = field === "name" ? chat.name : (chat.description ?? "");
    if (value === original) return;
    if (field === "name" && !value.trim()) {
      setError(say("Name is required.", "El nombre es obligatorio."));
      return;
    }
    setError("");
    try {
      await onSave({ [field]: value });
    } catch {
      setError(
        say(
          "Unable to save group details. Try again.",
          "No se pudieron guardar los datos del grupo. Inténtalo de nuevo.",
        ),
      );
    }
  };

  return { say, name, setName, description, setDescription, error, save };
}
