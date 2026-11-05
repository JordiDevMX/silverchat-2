import { Camera, ImagePlus, Trash2 } from "lucide-react";
import Cropper from "react-easy-crop";
import { Button } from "@/components/ui/button";
import { SettingsDialog } from "@/components/ui/settings-surfaces";
import type { Profile } from "../hooks";
import { useAvatarPicker } from "../hooks/useAvatarPicker";
export function AvatarPickerModal({
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
  const {
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
  } = useAvatarPicker({ profile, onClose, onSaved, onSave });
  return (
    <SettingsDialog
      title={t("Change photo")}
      onClose={onClose}
      canClose={!action.busy}
      className="avatar-picker-dialog"
    >
      {(close) => (
        <>
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
                <Button
                  variant="outline"
                  type="button"
                  disabled={!url.data || action.busy}
                  onClick={() => setView(true)}
                >
                  {t("View photo")}
                </Button>
              )}
              <Button
                variant="outline"
                type="button"
                disabled={action.busy}
                onClick={() => camera.current?.click()}
              >
                <Camera size={20} />
                {t("Take photo")}
              </Button>
              <Button
                variant="outline"
                type="button"
                disabled={action.busy}
                onClick={() => upload.current?.click()}
              >
                <ImagePlus size={20} />
                {t("Upload photo")}
              </Button>
              {profile.avatar_url && (
                <Button
                  variant="destructive"
                  type="button"
                  disabled={action.busy}
                  onClick={() => save(true)}
                >
                  <Trash2 size={20} />
                  {t("Remove photo")}
                </Button>
              )}
            </div>
          )}
          {action.feedback}
          <div className="modal-actions">
            <Button variant="outline" type="button" disabled={action.busy} onClick={close}>
              {t("Cancel")}
            </Button>
            {source && (
              <Button type="button" disabled={!area || action.busy} onClick={() => save()}>
                {t(action.busy ? "Saving…" : "Save")}
              </Button>
            )}
          </div>
        </>
      )}
    </SettingsDialog>
  );
}
