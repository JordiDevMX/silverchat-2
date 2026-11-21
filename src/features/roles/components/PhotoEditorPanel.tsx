import { Camera, Check, ImagePlus, Trash2, X } from "lucide-react";
import { type ReactNode, useCallback, useEffect, useId, useRef, useState } from "react";
import Cropper, { type Area } from "react-easy-crop";
import { useI18n } from "@/app/providers/i18n-provider";
import { Button } from "@/components/ui/button";
import { cropAvatar } from "@/lib/avatar-upload";
import { useClipboardImageTarget } from "@/lib/clipboard-paste";

export interface PhotoEditorPanelProps {
  existingUrl?: string | null;
  hasExisting?: boolean;
  stagedFile?: File | null;
  busy?: boolean;
  applyLabel?: string;
  previewAlt?: string;
  onSelectCropped: (file: File) => void | Promise<void>;
  onRemove?: () => void | Promise<void>;
  onError?: (message: string) => void;
  footerExtra?: ReactNode;
}

export function PhotoEditorPanel({
  existingUrl,
  hasExisting = false,
  stagedFile = null,
  busy = false,
  applyLabel,
  previewAlt,
  onSelectCropped,
  onRemove,
  onError,
  footerExtra,
}: PhotoEditorPanelProps) {
  const { t } = useI18n();
  const zoomId = useId();
  const [source, setSource] = useState("");
  const [viewExisting, setViewExisting] = useState(false);
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [area, setArea] = useState<Area>();
  const [cropping, setCropping] = useState(false);
  const [localError, setLocalError] = useState("");
  const [stagedPreviewUrl, setStagedPreviewUrl] = useState("");
  const uploadRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);
  const bodyRef = useRef<HTMLDivElement>(null);

  useEffect(
    () => () => {
      if (source) URL.revokeObjectURL(source);
    },
    [source],
  );

  useEffect(() => {
    if (!stagedFile) {
      setStagedPreviewUrl("");
      return;
    }
    const nextUrl = URL.createObjectURL(stagedFile);
    setStagedPreviewUrl(nextUrl);
    return () => URL.revokeObjectURL(nextUrl);
  }, [stagedFile]);

  const selectFile = useCallback(
    (file?: File) => {
      if (!file) return;
      if (!file.type.startsWith("image/") || file.size > 20 * 1024 * 1024) {
        const msg = "Choose an image smaller than 20 MB.";
        setLocalError(msg);
        onError?.(msg);
        return;
      }
      setLocalError("");
      setCrop({ x: 0, y: 0 });
      setZoom(1);
      setArea(undefined);
      setSource(URL.createObjectURL(file));
    },
    [onError],
  );

  const handlePasted = useCallback(
    (files: File[]) => {
      if (files[0]) selectFile(files[0]);
    },
    [selectFile],
  );

  useClipboardImageTarget({
    ref: bodyRef,
    kind: "single-image",
    disabled: busy || cropping,
    maxFileBytes: 20 * 1024 * 1024,
    onImages: handlePasted,
  });

  const commitCrop = async () => {
    if (!source || !area || busy || cropping) return;
    setCropping(true);
    setLocalError("");
    try {
      const file = await cropAvatar(source, area);
      await onSelectCropped(file);
      setSource("");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Could not process photo";
      setLocalError(msg);
      onError?.(msg);
    } finally {
      setCropping(false);
    }
  };

  const disabled = busy || cropping;

  return (
    <div ref={bodyRef} className="flex flex-col gap-3">
      <input
        ref={uploadRef}
        hidden
        type="file"
        accept="image/*"
        onChange={(e) => {
          selectFile(e.target.files?.[0]);
          e.currentTarget.value = "";
        }}
      />
      <input
        ref={cameraRef}
        hidden
        type="file"
        accept="image/*"
        capture="user"
        onChange={(e) => {
          selectFile(e.target.files?.[0]);
          e.currentTarget.value = "";
        }}
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
          <label htmlFor={zoomId} className="text-sm font-medium">
            {t("Zoom")} {zoom.toFixed(1)}×
          </label>
          <input
            id={zoomId}
            type="range"
            min="1"
            max="3"
            step="0.05"
            value={zoom}
            disabled={disabled}
            onChange={(e) => setZoom(Number(e.target.value))}
          />
        </>
      ) : stagedPreviewUrl ? (
        <div className="flex flex-col items-center gap-3 py-2">
          <img
            src={stagedPreviewUrl}
            alt={previewAlt ?? t("Profile photo")}
            className="h-28 w-28 rounded-full border border-border object-cover"
          />
          <div className="flex flex-wrap justify-center gap-2">
            <Button
              variant="outline"
              type="button"
              disabled={disabled}
              onClick={() => uploadRef.current?.click()}
            >
              <ImagePlus size={18} />
              Change photo
            </Button>
            {onRemove && (
              <Button
                variant="destructive"
                type="button"
                disabled={disabled}
                onClick={() => void onRemove()}
              >
                <Trash2 size={18} />
                {t("Remove photo")}
              </Button>
            )}
          </div>
        </div>
      ) : viewExisting && existingUrl ? (
        <div className="flex flex-col items-center gap-3">
          <img
            className="avatar-preview"
            src={existingUrl}
            alt={previewAlt ?? t("Profile photo")}
          />
          <Button
            variant="outline"
            type="button"
            disabled={disabled}
            onClick={() => setViewExisting(false)}
          >
            Back
          </Button>
        </div>
      ) : (
        <div className="avatar-actions">
          {hasExisting && (
            <Button
              variant="outline"
              type="button"
              disabled={!existingUrl || disabled}
              onClick={() => setViewExisting(true)}
            >
              {t("View photo")}
            </Button>
          )}
          <Button
            variant="outline"
            type="button"
            disabled={disabled}
            onClick={() => cameraRef.current?.click()}
          >
            <Camera size={20} />
            {t("Take photo")}
          </Button>
          <Button
            variant="outline"
            type="button"
            disabled={disabled}
            onClick={() => uploadRef.current?.click()}
          >
            <ImagePlus size={20} />
            {t("Upload photo")}
          </Button>
          {hasExisting && onRemove && (
            <Button
              variant="destructive"
              type="button"
              disabled={disabled}
              onClick={() => void onRemove()}
            >
              <Trash2 size={20} />
              {t("Remove photo")}
            </Button>
          )}
        </div>
      )}

      {localError && (
        <p role="alert" className="text-sm text-destructive">
          {localError}
        </p>
      )}

      {(source || footerExtra) && (
        <div className="modal-actions">
          {footerExtra}
          {source && (
            <>
              <Button
                variant="outline"
                type="button"
                disabled={disabled}
                onClick={() => setSource("")}
              >
                <X size={16} />
                Discard crop
              </Button>
              <Button type="button" disabled={!area || disabled} onClick={() => void commitCrop()}>
                <Check size={16} />
                {applyLabel ?? t(disabled ? "Saving…" : "Apply photo")}
              </Button>
            </>
          )}
        </div>
      )}
    </div>
  );
}
