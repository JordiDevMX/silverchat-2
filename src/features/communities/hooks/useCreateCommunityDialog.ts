import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "@tanstack/react-router";
import type { FormEvent } from "react";
import { useEffect, useState } from "react";
import { saveGroupAvatar } from "@/features/chat-settings/lib/groupAvatar";
import { useMessageText } from "@/features/messages/i18n";
import { useAuth } from "@/lib/auth-provider";
import { supabase } from "@/lib/supabase";
import { useCreateCommunity } from "../hooks/useCreateCommunity";
import { refreshCommunities } from "../lib/cache";
import { communityApi } from "../lib/communityApi";
export function useCreateCommunityDialog(onClose: () => void) {
  const { say } = useMessageText();
  const { user } = useAuth();
  const router = useRouter();
  const create = useCreateCommunity();
  const cache = useQueryClient();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [photo, setPhoto] = useState(false);
  const [preview, setPreview] = useState("");
  const [createdId, setCreatedId] = useState<string>();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    const url = file ? URL.createObjectURL(file) : "";
    setPreview(url);
    return () => {
      if (url) URL.revokeObjectURL(url);
    };
  }, [file]);
  const submit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (busy || !name.trim()) return;
    setBusy(true);
    setError("");
    try {
      const id = createdId ?? (await create.mutateAsync({ name, description }));
      if (!id) throw new Error("Community unavailable");
      setCreatedId(id);
      if (file)
        await saveGroupAvatar(
          id,
          user?.id ?? "",
          file,
          null,
          async (patch) => {
            await communityApi(supabase).update(id, patch);
          },
          "community",
        );
      await refreshCommunities(cache, user?.id ?? "");
      await router.navigate({ href: `/communities/${id}` });
      onClose();
    } catch {
      setError(
        say(
          "Unable to finish. Retry; an already created community will be reused.",
          "No se pudo terminar. Reintenta; se reutilizará la comunidad si ya se creó.",
        ),
      );
    } finally {
      setBusy(false);
    }
  };
  return {
    say,
    name,
    setName,
    description,
    setDescription,
    file,
    setFile,
    photo,
    setPhoto,
    preview,
    createdId,
    busy,
    error,
    submit,
  };
}
