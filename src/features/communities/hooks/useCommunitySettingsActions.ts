import { useState } from "react";
import { useMessageText } from "@/features/messages/i18n";
import { useAuth } from "@/lib/auth-provider";
import { getAvailableCommunityActions } from "../lib/communityActions";
import type { Community } from "../types";
import { useCommunityChats } from "./useCommunityChats";
import { useDeleteCommunity } from "./useDeleteCommunity";
import { useLeaveCommunity } from "./useLeaveCommunity";
import { useMuteCommunity } from "./useMuteCommunity";
export function useCommunitySettingsActions(community: Community) {
  const { say } = useMessageText();
  const { user } = useAuth();
  const [modal, setModal] = useState<
    "members" | "add" | "mute" | "leave" | "delete" | "create" | null
  >(null);
  const [confirmation, setConfirmation] = useState("");
  const [error, setError] = useState(false);
  const chats = useCommunityChats(community.id);
  const leave = useLeaveCommunity(community.id);
  const remove = useDeleteCommunity(community.id);
  const mute = useMuteCommunity(community.id);
  const owner = community.owner_id === user?.id;
  const admin = community.role === "admin";
  const muted =
    !!chats.data?.length &&
    chats.data.every(
      (c) => !!c.membership.muted_until && Date.parse(c.membership.muted_until) > Date.now(),
    );
  const actions = getAvailableCommunityActions(community, user?.id ?? "", admin, owner, muted);
  const open = (value: typeof modal) => {
    setError(false);
    setConfirmation("");
    setModal(value);
  };
  const chooseMute = async (until: string | null) => {
    try {
      await mute.mutateAsync(until);
      setModal(null);
      setError(false);
    } catch {
      setError(true);
    }
  };
  const confirmAction = async () => {
    setError(false);
    try {
      if (modal === "leave") await leave.mutateAsync();
      else await remove.mutateAsync();
      setModal(null);
    } catch {
      setError(true);
    }
  };
  return {
    say,
    modal,
    setModal,
    confirmation,
    setConfirmation,
    error,
    leave,
    remove,
    mute,
    owner,
    admin,
    muted,
    actions,
    open,
    chooseMute,
    confirmAction,
  };
}
