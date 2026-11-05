import { useEffect, useRef, useState } from "react";
import type { Area } from "react-easy-crop";
import { useI18n } from "@/app/providers/i18n-provider";
import { cropAvatar, saveAvatar } from "@/lib/avatar-upload";
import { type Profile, useProfileRefresh } from "../hooks";
import { useAction } from "./useAction";
import { useAvatarUrl } from "./useAvatar";
export function useAvatarPicker({
  profile,
  onClose,
  onSaved,
  onSave,
}: {
  profile: Pick<Profile, "id" | "avatar_url">;
  onSave?: (file: File | null) => Promise<{ cleanupPending: boolean }>;
  onClose: () => void;
  onSaved: (warning: boolean) => void;
}) {
  const [source, setSource] = useState("");
  const [view, setView] = useState(false);
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [area, setArea] = useState<Area>();
  const upload = useRef<HTMLInputElement>(null);
  const camera = useRef<HTMLInputElement>(null);
  const action = useAction();
  const refresh = useProfileRefresh();
  const url = useAvatarUrl(profile.avatar_url);
  const { t } = useI18n();
  useEffect(
    () => () => {
      if (source) URL.revokeObjectURL(source);
    },
    [source],
  );
  const select = (file?: File) => {
    if (!file) return;
    void action.run(async () => {
      if (!file.type.startsWith("image/") || file.size > 20 * 1024 * 1024)
        throw new Error("Choose an image smaller than 20 MB.");
      setCrop({ x: 0, y: 0 });
      setZoom(1);
      setArea(undefined);
      setSource(URL.createObjectURL(file));
    });
  };
  const save = (remove = false) =>
    void action.run(async () => {
      if (!remove && !area) return;
      const file = remove ? null : await cropAvatar(source, area as Area);
      const result = onSave
        ? await onSave(file)
        : await saveAvatar(profile.id, file, profile.avatar_url);
      if (!onSave) await refresh();
      onSaved(result.cleanupPending);
      onClose();
    });
  return {
    source,
    view,
    setView,
    crop,
    setCrop,
    zoom,
    setZoom,
    area,
    setArea,
    upload,
    camera,
    action,
    url,
    t,
    select,
    save,
  };
}
