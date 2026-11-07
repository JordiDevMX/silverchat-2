import { useQuery } from "@tanstack/react-query";
import { useRouter } from "@tanstack/react-router";
import { type FormEvent, useEffect, useState } from "react";
import { saveGroupAvatar } from "@/features/chat-settings/lib/groupAvatar";
import { useChatUIStore } from "@/features/chat-settings/stores/uiStore";
import { useMessageText } from "@/features/messages/i18n";
import { useAuth } from "@/lib/auth-provider";
import { supabase } from "@/lib/supabase";
import { validSlug } from "../../lib/storyOrdering";
import { useCreateChannel } from "./useCreateChannel";
export function useCreateChannelDialog(onClose: () => void) {
  const { user } = useAuth();
  const { say } = useMessageText();
  const router = useRouter();
  const create = useCreateChannel();
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [custom, setCustom] = useState(false);
  const [description, setDescription] = useState("");
  const [file, setFile] = useState<File>();
  const [photoOpen, setPhotoOpen] = useState(false);
  const [preview, setPreview] = useState("");
  useEffect(() => {
    if (!file) {
      setPreview("");
      return;
    }
    const url = URL.createObjectURL(file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);
  const [term, setTerm] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [created, setCreated] = useState<string>();
  useEffect(() => {
    const timer = setTimeout(() => setTerm(slug), 500);
    return () => clearTimeout(timer);
  }, [slug]);
  const available = useQuery({
    queryKey: ["channel-slug", user?.id, term],
    enabled: validSlug(term) && !created,
    queryFn: async () => {
      const r = await supabase.from("channels").select("id").eq("slug", term).maybeSingle();
      if (r.error) throw r.error;
      return !r.data;
    },
  });
  const submit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      const photo = file;
      const id = created ?? (await create.mutateAsync({ name, slug, description }));
      setCreated(id);
      if (photo)
        await saveGroupAvatar(
          id,
          user?.id ?? "",
          photo,
          null,
          async (patch) => {
            const r = await supabase.rpc("update_channel_info", {
              p_channel_id: id,
              p_avatar_url: patch.avatar_url,
            });
            if (r.error) throw r.error;
          },
          "channel",
        );
      useChatUIStore.getState().notify(say("Channel created", "Canal creado"));
      onClose();
      await router.navigate({ href: `/channels/${id}/info` });
    } catch (e) {
      setError(
        e && typeof e === "object" && "message" in e
          ? String(e.message)
          : say("Unable to create channel. Try again.", "No se pudo crear el canal. Reinténtalo."),
      );
    } finally {
      setBusy(false);
    }
  };
  return {
    user,
    say,
    name,
    setName,
    slug,
    setSlug,
    custom,
    setCustom,
    description,
    setDescription,
    file,
    setFile,
    photoOpen,
    setPhotoOpen,
    preview,
    term,
    error,
    busy,
    created,
    available,
    submit,
  };
}
