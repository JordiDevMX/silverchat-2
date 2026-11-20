import { ArrowUp, Plus, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { FileIconTile } from "@/components/ui/file-icon-tile";
import { Modal } from "@/features/auth/components";
import { useAuth } from "@/lib/auth-provider";
import {
  extractDataTransferMedia,
  formatClipboardFeedback,
  MAX_CLIPBOARD_IMAGES_DEFAULT,
} from "@/lib/clipboard-images";
import { useClipboardImageTarget } from "@/lib/clipboard-paste";
import { resolveFileType } from "@/lib/file-type";
import { useMessageText } from "../i18n";
import { cleanupUploads, prepareAndUpload } from "../lib/upload";
import type { SendInput } from "../types";
import { formatBytes } from "../utils/formatMessageTime";

interface ModalMediaItem {
  id: string;
  file: File;
  url: string;
  status: "queued" | "uploading" | "failed";
}

export function MediaPreviewModal({
  file,
  extraFiles = [],
  chatId,
  channelMode = false,
  onSend,
  onClose,
}: {
  file: File;
  extraFiles?: File[];
  chatId: string;
  channelMode?: boolean;
  onSend: (input: SendInput) => Promise<void>;
  onClose: () => void;
}) {
  const { user } = useAuth();
  const { say, language } = useMessageText();
  const bodyRef = useRef<HTMLDivElement>(null);
  const pickerRef = useRef<HTMLInputElement>(null);
  const controllerRef = useRef<AbortController | null>(null);
  const itemsRef = useRef<ModalMediaItem[]>([]);

  const [items, setItems] = useState<ModalMediaItem[]>(() => {
    const initial = [file, ...extraFiles].slice(0, MAX_CLIPBOARD_IMAGES_DEFAULT).map((f) => ({
      id: crypto.randomUUID(),
      file: f,
      url: URL.createObjectURL(f),
      status: "queued" as const,
    }));
    itemsRef.current = initial;
    return initial;
  });
  const [activeId, setActiveId] = useState<string>(() => itemsRef.current[0]?.id ?? "");
  const [caption, setCaption] = useState("");
  const [error, setError] = useState("");
  const [sending, setSending] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);

  const syncItems = useCallback((updater: (prev: ModalMediaItem[]) => ModalMediaItem[]) => {
    const next = updater(itemsRef.current);
    itemsRef.current = next;
    setItems(next);
    return next;
  }, []);

  useEffect(
    () => () => {
      controllerRef.current?.abort();
      for (const item of itemsRef.current) {
        URL.revokeObjectURL(item.url);
      }
    },
    [],
  );

  const appendImages = useCallback(
    (files: File[]) => {
      if (files.length === 0) return;
      const available = Math.max(0, MAX_CLIPBOARD_IMAGES_DEFAULT - itemsRef.current.length);
      const accepted = files.slice(0, available);
      if (accepted.length === 0) return;
      const added: ModalMediaItem[] = accepted.map((nextFile) => ({
        id: crypto.randomUUID(),
        file: nextFile,
        url: URL.createObjectURL(nextFile),
        status: "queued",
      }));
      syncItems((prev) => [...prev, ...added]);
      setActiveId(added[0]?.id ?? "");
      setError("");
    },
    [syncItems],
  );

  const handleFeedback = useCallback((message: string) => {
    setError(message);
  }, []);

  useClipboardImageTarget({
    ref: bodyRef,
    kind: "images",
    disabled: sending,
    maxCount: MAX_CLIPBOARD_IMAGES_DEFAULT,
    existingCount: items.length,
    onImages: appendImages,
    onFeedback: handleFeedback,
  });

  const removeItem = (id: string) => {
    if (sending) return;
    const removed = itemsRef.current.find((item) => item.id === id);
    if (removed) URL.revokeObjectURL(removed.url);
    const next = syncItems((prev) => prev.filter((item) => item.id !== id));
    if (next.length === 0) {
      onClose();
      return;
    }
    if (activeId === id) {
      setActiveId(next[0]?.id ?? "");
    }
  };

  const close = () => {
    if (sending && !uploading) return;
    controllerRef.current?.abort();
    onClose();
  };

  const send = async () => {
    if (sending || itemsRef.current.length === 0) return;
    setSending(true);
    setError("");
    const snapshotIds = itemsRef.current.map((item) => item.id);
    let captionPending = caption.trim();

    try {
      for (const id of snapshotIds) {
        const current = itemsRef.current.find((item) => item.id === id);
        if (!current) continue;
        const controller = new AbortController();
        controllerRef.current = controller;
        setProgress(0);
        setUploading(true);
        syncItems((prev) =>
          prev.map((item) => (item.id === id ? { ...item, status: "uploading" } : item)),
        );

        try {
          const result = await prepareAndUpload(
            current.file,
            chatId,
            user?.id ?? "",
            controller.signal,
            setProgress,
            { bucket: channelMode ? "channel-media" : "chat-media" },
          );
          if (controller.signal.aborted) {
            await cleanupUploads([result.upload, ...(result.thumbnail ? [result.thumbnail] : [])]);
            return;
          }
          setUploading(false);
          const itemContent = captionPending || null;
          try {
            await onSend({
              type: result.type,
              content: itemContent,
              file_upload_id: result.upload.id,
              media_thumbnail_upload_id: result.thumbnail?.id,
              upload: result.upload,
              thumbnail: result.thumbnail,
            });
          } catch {
            /* The failed optimistic message owns these uploads and its retry UUID. */
          }
          captionPending = "";
          URL.revokeObjectURL(current.url);
          syncItems((prev) => prev.filter((item) => item.id !== id));
        } catch (err) {
          setUploading(false);
          if (err instanceof DOMException && err.name === "AbortError") {
            syncItems((prev) =>
              prev.map((item) => (item.id === id ? { ...item, status: "queued" } : item)),
            );
            return;
          }
          syncItems((prev) =>
            prev.map((item) => (item.id === id ? { ...item, status: "failed" } : item)),
          );
          setError(say("Upload failed. Please try again.", "La carga falló. Inténtalo de nuevo."));
          return;
        } finally {
          controllerRef.current = null;
        }
      }
      onClose();
    } finally {
      setUploading(false);
      setSending(false);
    }
  };

  const activeItem = items.find((item) => item.id === activeId) ?? items[0];
  if (!activeItem) return null;

  const activeFile = activeItem.file;
  const fileType = resolveFileType({ filename: activeFile.name, mimeType: activeFile.type });
  const media =
    activeFile.type.startsWith("image/") || activeFile.type.startsWith("video/") || items.length > 1;

  return (
    <Modal
      title={say("Send attachment", "Enviar archivo")}
      className="media-preview messaging-dialog"
      onClose={close}
    >
      <div ref={bodyRef} className="media-preview-body">
        <button
          type="button"
          className="message-icon modal-close"
          disabled={sending && !uploading}
          aria-label={say("Close", "Cerrar")}
          onClick={close}
        >
          <X />
        </button>
        <div className="media-preview-stage">
          {activeFile.type.startsWith("image/") ? (
            <img src={activeItem.url} alt={activeFile.name} />
          ) : activeFile.type.startsWith("video/") ? (
            <video src={activeItem.url} controls playsInline preload="metadata">
              <track kind="captions" />
            </video>
          ) : (
            <div>
              <FileIconTile family={fileType.family} />
              <p>{activeFile.name}</p>
              <small>
                {formatBytes(activeFile.size, language)} ·{" "}
                {say(fileType.label[0], fileType.label[1])}
              </small>
            </div>
          )}
        </div>

        {items.length > 1 && (
          <section
            className="media-preview-strip"
            aria-label={say("Selected attachments", "Archivos seleccionados")}
          >
            {items.map((item, idx) => (
              <div
                key={item.id}
                className={`media-preview-strip-item${item.id === activeItem.id ? " is-active" : ""}`}
              >
                <button
                  type="button"
                  className="media-preview-strip-thumb"
                  aria-label={say(
                    `View ${item.file.name} (${idx + 1} of ${items.length})`,
                    `Ver ${item.file.name} (${idx + 1} de ${items.length})`,
                  )}
                  aria-pressed={item.id === activeItem.id}
                  onClick={() => setActiveId(item.id)}
                >
                  {item.file.type.startsWith("image/") ? (
                    <img src={item.url} alt="" />
                  ) : (
                    <span>{item.file.name}</span>
                  )}
                </button>
                <button
                  type="button"
                  className="media-preview-strip-remove"
                  disabled={sending}
                  aria-label={say(`Remove ${item.file.name}`, `Quitar ${item.file.name}`)}
                  onClick={() => removeItem(item.id)}
                >
                  <X size={12} aria-hidden="true" />
                </button>
              </div>
            ))}
            {items.length < MAX_CLIPBOARD_IMAGES_DEFAULT && (
              <button
                type="button"
                className="media-preview-strip-add"
                disabled={sending}
                aria-label={say("Add more images", "Añadir más imágenes")}
                onClick={() => pickerRef.current?.click()}
              >
                <Plus size={16} aria-hidden="true" />
              </button>
            )}
          </section>
        )}

        <input
          ref={pickerRef}
          type="file"
          accept="image/*"
          multiple
          hidden
          onChange={(event) => {
            const picked = Array.from(event.target.files ?? []);
            if (picked.length > 0) {
              const extraction = extractDataTransferMedia(
                { files: picked },
                {
                  maxCount: MAX_CLIPBOARD_IMAGES_DEFAULT,
                  existingCount: itemsRef.current.length,
                  strictImagesOnly: true,
                },
              );
              appendImages(extraction.images);
              const feedback = formatClipboardFeedback(extraction, language, {
                maxCount: MAX_CLIPBOARD_IMAGES_DEFAULT,
              });
              if (feedback) setError(feedback);
            }
            event.target.value = "";
          }}
        />

        <label>
          {say("Caption", "Descripción")}
          <textarea
            value={caption}
            disabled={sending}
            maxLength={media ? 500 : 200}
            onChange={(e) => setCaption(e.target.value)}
            rows={2}
          />
        </label>
        {sending && (
          <div role="status">
            <progress max={100} value={progress} />
            <span>{uploading ? `${Math.round(progress)}%` : say("Sending…", "Enviando…")}</span>
          </div>
        )}
        {error && <p role="alert">{error}</p>}
        <div className="modal-actions">
          <Button
            type="button"
            variant="outline"
            className="rounded-xl"
            disabled={sending && !uploading}
            onClick={close}
          >
            {say("Cancel", "Cancelar")}
          </Button>
          <Button type="button" className="rounded-xl" disabled={sending} onClick={() => void send()}>
            <ArrowUp size={18} />
            {items.length > 1
              ? say(`Send (${items.length})`, `Enviar (${items.length})`)
              : say("Send", "Enviar")}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
