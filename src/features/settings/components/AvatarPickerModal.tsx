import { Camera, ImagePlus, Trash2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import Cropper, { type Area } from "react-easy-crop";
import { useI18n } from "@/app/providers/i18n-provider";
import { Modal } from "@/features/auth/components";
import { cropAvatar, saveAvatar } from "@/lib/avatar-upload";
import { type Profile, useProfileRefresh } from "../hooks";
import { useAction, useAvatarUrl } from "./shared";
export function AvatarPickerModal({
  profile,
  onClose,
  onSaved,
}: {
  profile: Profile;
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
      const result = await saveAvatar(profile.id, file, profile.avatar_url);
      await refresh();
      onSaved(result.cleanupPending);
      onClose();
    });
  return (
    <Modal title={t("Change photo")} onClose={action.busy ? undefined : onClose}>
      <input
        ref={upload}
        hidden
        type="file"
        accept="image/*"
        onChange={(e) => select(e.target.files?.[0])}
      />
      <input
        ref={camera}
        hidden
        type="file"
        accept="image/*"
        capture="user"
        onChange={(e) => select(e.target.files?.[0])}
      />
      {source ? (
        <>
          <div className="avatar-crop">
            <Cropper
              image={source}
              crop={crop}
              zoom={zoom}
              minZoom={1}
              maxZoom={3}
              aspect={1}
              cropShape="round"
              showGrid={false}
              zoomWithScroll={false}
              onTouchRequest={(e) => e.touches.length < 2}
              onCropChange={setCrop}
              onZoomChange={setZoom}
              onCropComplete={(_, pixels) => setArea(pixels)}
            />
          </div>
          <label htmlFor="avatar-zoom">
            {t("Zoom")} {zoom.toFixed(1)}×
          </label>
          <input
            id="avatar-zoom"
            type="range"
            min="1"
            max="3"
            step="0.05"
            value={zoom}
            disabled={action.busy}
            onChange={(e) => setZoom(Number(e.target.value))}
          />
        </>
      ) : view && url.data ? (
        <img className="avatar-preview" src={url.data} alt={t("Profile photo")} />
      ) : (
        <div className="avatar-actions">
          {profile.avatar_url && (
            <button
              className="button secondary"
              type="button"
              disabled={!url.data || action.busy}
              onClick={() => setView(true)}
            >
              {t("View photo")}
            </button>
          )}
          <button
            className="button secondary"
            type="button"
            disabled={action.busy}
            onClick={() => camera.current?.click()}
          >
            <Camera size={20} />
            {t("Take photo")}
          </button>
          <button
            className="button secondary"
            type="button"
            disabled={action.busy}
            onClick={() => upload.current?.click()}
          >
            <ImagePlus size={20} />
            {t("Upload photo")}
          </button>
          {profile.avatar_url && (
            <button
              className="button danger"
              type="button"
              disabled={action.busy}
              onClick={() => save(true)}
            >
              <Trash2 size={20} />
              {t("Remove photo")}
            </button>
          )}
        </div>
      )}
      {action.feedback}
      <div className="modal-actions">
        <button className="button secondary" type="button" disabled={action.busy} onClick={onClose}>
          {t("Cancel")}
        </button>
        {source && (
          <button
            className="button primary"
            type="button"
            disabled={!area || action.busy}
            onClick={() => save()}
          >
            {t(action.busy ? "Saving…" : "Save")}
          </button>
        )}
      </div>
    </Modal>
  );
}
