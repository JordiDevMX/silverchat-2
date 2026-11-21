import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { saveGroupAvatar } from "@/features/chat-settings/lib/groupAvatar";
import { useChatUIStore } from "@/features/chat-settings/stores/uiStore";
import { matchesUserFilter, useDirectContacts } from "@/features/chats/hooks/useUserSearch";
import { useMessageText } from "@/features/messages/i18n";
import { useAuth } from "@/lib/auth-provider";
import { supabase } from "@/lib/supabase";
import { sendChannelInvitationsInBatches } from "../../lib/channelInvitations";
import { validSlug } from "../../lib/storyOrdering";
import { useCreateChannel } from "./useCreateChannel";

export function useCreateChannelDialog(onClose: () => void) {
  const { user } = useAuth();
  const { say } = useMessageText();
  const router = useRouter();
  const cache = useQueryClient();
  const create = useCreateChannel();
  const contactsQuery = useDirectContacts();

  const [step, setStep] = useState(0);
  const [channelDraftId] = useState(() => crypto.randomUUID());
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [custom, setCustom] = useState(false);
  const [description, setDescription] = useState("");
  const [file, setFile] = useState<File>();
  const [avatarSaved, setAvatarSaved] = useState(false);

  const [contactSearch, setContactSearch] = useState("");
  const [selectedContactIds, setSelectedContactIds] = useState<string[]>([]);
  const inviteIdsRef = useRef<Map<string, string>>(new Map());
  const [sentInviteContacts, setSentInviteContacts] = useState<Set<string>>(() => new Set());
  const [failedInviteContacts, setFailedInviteContacts] = useState<Set<string>>(() => new Set());

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
      const r = await supabase.from("channels_public").select("id").eq("slug", term).maybeSingle();
      if (r.error) throw r.error;
      return !r.data;
    },
  });

  const contacts = (contactsQuery.data ?? [])
    .map((item) => item.user)
    .filter((u) => matchesUserFilter(u, contactSearch));

  const toggleContact = (contactId: string) => {
    setSelectedContactIds((prev) => {
      if (prev.includes(contactId)) return prev.filter((id) => id !== contactId);
      if (!inviteIdsRef.current.has(contactId)) {
        inviteIdsRef.current.set(contactId, crypto.randomUUID());
      }
      return [...prev, contactId];
    });
  };

  const finishAndOpen = async (id: string) => {
    useChatUIStore.getState().notify(say("Channel created", "Canal creado"));
    onClose();
    await router.navigate({ href: `/channels/${id}/info` });
  };

  const submit = async () => {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      const id =
        created ??
        (await create.mutateAsync({
          channelId: channelDraftId,
          name,
          slug,
          description,
        }));
      setCreated(id);

      if (file && !avatarSaved) {
        await saveGroupAvatar(
          id,
          user?.id ?? "",
          file,
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
        setAvatarSaved(true);
      }

      const unsent = selectedContactIds.filter((cid) => !sentInviteContacts.has(cid));
      if (unsent.length > 0) {
        const batchResult = await sendChannelInvitationsInBatches({
          channelId: id,
          recipientIds: unsent,
          getInvitationId: (recipientId) => {
            let invId = inviteIdsRef.current.get(recipientId);
            if (!invId) {
              invId = crypto.randomUUID();
              inviteIdsRef.current.set(recipientId, invId);
            }
            return invId;
          },
          sendBatch: async (channelId, batch) =>
            supabase.rpc("send_channel_invitations", {
              p_channel_id: channelId,
              p_invitations: batch,
            }),
          onBatchSucceeded: (batchSucceeded) => {
            setSentInviteContacts((prev) => new Set([...prev, ...batchSucceeded]));
          },
        });

        if (batchResult.succeeded.length > 0) {
          void cache.invalidateQueries({ queryKey: ["channel-invitations-sent", user?.id, id] });
        }
        if (batchResult.error || batchResult.failed.length > 0) {
          setFailedInviteContacts(new Set(batchResult.failed.map((f) => f.recipientId)));
          if (batchResult.error) throw batchResult.error;
          throw new Error(
            say(
              "Some invitations could not be delivered. Retry the remaining contacts or open your channel.",
              "Algunas invitaciones no se pudieron enviar. Reintenta los contactos pendientes o abre el canal.",
            ),
          );
        }
        setFailedInviteContacts(new Set());
      }

      await finishAndOpen(id);
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
    step,
    setStep,
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
    avatarSaved,
    term,
    error,
    busy,
    created,
    available,
    contacts,
    contactsLoading: contactsQuery.isPending,
    contactSearch,
    setContactSearch,
    selectedContactIds,
    sentInviteContacts,
    failedInviteContacts,
    toggleContact,
    submit,
    finishLater: () => (created ? void finishAndOpen(created) : undefined),
  };
}
