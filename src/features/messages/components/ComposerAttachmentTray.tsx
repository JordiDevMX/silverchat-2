import { AlertCircle, Plus, RotateCw, Trash2, X } from "lucide-react";
import { type RefObject, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Modal } from "@/features/auth/components";
import { MAX_CLIPBOARD_IMAGES_DEFAULT } from "@/lib/clipboard-images";
import { useMessageText } from "../i18n";
import { formatBytes } from "../utils/formatMessageTime";

export interface ComposerAttachmentItem {
  id: string;
  file: File;
  previewUrl: string;
  status: "queued" | "uploading" | "failed";
  progress: number;
  error?: string;
}

export function ComposerAttachmentTray({
  items,
  trayRef,
  sending,
  maxCount = MAX_CLIPBOARD_IMAGES_DEFAULT,
  statusAnnouncement,
  onAddFiles,
  onRemove,
  onRetry,
  onClear,
  onFocusInput,
}: {
  items: ComposerAttachmentItem[];
  trayRef: RefObject<HTMLDivElement | null>;
  sending: boolean;
  maxCount?: number;
  statusAnnouncement?: string;
  onAddFiles: (files: File[]) => void;
  onRemove: (id: string) => void;
  onRetry: (id: string) => void;
  onClear: () => void;
  onFocusInput: () => void;
}) {
  const { say, language } = useMessageText();
  const pickerRef = useRef<HTMLInputElement>(null);
  const removeRefs = useRef<Map<string, HTMLButtonElement>>(new Map());
  const pendingFocusIndexRef = useRef<number | null>(null);
  const [inspectId, setInspectId] = useState<string | null>(null);

  const inspected = inspectId ? items.find((item) => item.id === inspectId) : undefined;

  useEffect(() => {
    if (inspectId && !inspected) setInspectId(null);
  }, [inspectId, inspected]);

  useEffect(() => {
    const targetIndex = pendingFocusIndexRef.current;
    if (targetIndex === null) return;
    pendingFocusIndexRef.current = null;
    if (items.length === 0) {
      onFocusInput();
      return;
    }
    const clamped = Math.min(targetIndex, items.length - 1);
    const nextId = items[clamped]?.id;
    if (nextId) {
      removeRefs.current.get(nextId)?.focus();
    }
  }, [items, onFocusInput]);

  if (items.length === 0) return null;

  const failedCount = items.filter((item) => item.status === "failed").length;
  const uploadingCount = items.filter((item) => item.status === "uploading").length;

  return (
    <section
      ref={trayRef}
      data-slot="composer-attachment-tray"
      className="composer-attachment-tray"
      aria-label={say(
        `Pending image attachments (${items.length})`,
        `Imágenes adjuntas pendientes (${items.length})`,
      )}
    >
      <div className="composer-attachment-header">
        <span className="composer-attachment-count">
          {items.length === 1
            ? say("1 image ready to send", "1 imagen lista para enviar")
            : say(
                `${items.length} images ready to send`,
                `${items.length} imágenes listas para enviar`,
              )}
          {uploadingCount > 0 && ` · ${say("Uploading…", "Subiendo…")}`}
          {failedCount > 0 && ` · ${say(`${failedCount} failed`, `${failedCount} con error`)}`}
        </span>
        {items.length > 1 && (
          <button
            type="button"
            className="composer-attachment-clear"
            disabled={sending}
            onClick={() => {
              pendingFocusIndexRef.current = 0;
              onClear();
            }}
          >
            <Trash2 size={13} aria-hidden="true" />
            {say("Clear all", "Quitar todas")}
          </button>
        )}
      </div>

      <ul className="composer-attachment-list">
        {items.map((item, index) => (
          <li
            key={item.id}
            data-slot="composer-attachment-item"
            data-status={item.status}
            className={`composer-attachment-card${item.status === "failed" ? " is-failed" : ""}`}
          >
            <button
              type="button"
              className="composer-attachment-thumb"
              aria-label={say(
                `Preview ${item.file.name} (${index + 1} of ${items.length})`,
                `Vista previa de ${item.file.name} (${index + 1} de ${items.length})`,
              )}
              onClick={() => setInspectId(item.id)}
            >
              <img src={item.previewUrl} alt="" />
            </button>

            <button
              ref={(node) => {
                if (node) removeRefs.current.set(item.id, node);
                else removeRefs.current.delete(item.id);
              }}
              type="button"
              className="composer-attachment-remove"
              aria-label={say(
                `Remove ${item.file.name} (${index + 1} of ${items.length})`,
                `Quitar ${item.file.name} (${index + 1} de ${items.length})`,
              )}
              onClick={() => {
                pendingFocusIndexRef.current = index;
                onRemove(item.id);
              }}
            >
              <X size={14} aria-hidden="true" />
            </button>

            {item.status === "uploading" && (
              <div className="composer-attachment-overlay" role="status">
                <progress
                  max={100}
                  value={item.progress}
                  aria-label={say(`Uploading ${item.file.name}`, `Subiendo ${item.file.name}`)}
                />
                <span>{Math.round(item.progress)}%</span>
              </div>
            )}

            {item.status === "failed" && (
              <div className="composer-attachment-failed-bar">
                <AlertCircle size={13} aria-hidden="true" />
                <button
                  type="button"
                  className="composer-attachment-retry"
                  aria-label={say(`Retry ${item.file.name}`, `Reintentar ${item.file.name}`)}
                  onClick={() => onRetry(item.id)}
                >
                  <RotateCw size={12} aria-hidden="true" />
                  {say("Retry", "Reintentar")}
                </button>
              </div>
            )}
          </li>
        ))}

        {items.length < maxCount && (
          <li className="composer-attachment-add-wrap">
            <button
              type="button"
              className="composer-attachment-add"
              disabled={sending}
              aria-label={say("Add more images", "Añadir más imágenes")}
              onClick={() => pickerRef.current?.click()}
            >
              <Plus size={18} aria-hidden="true" />
              <span>{say("Add", "Añadir")}</span>
            </button>
          </li>
        )}
      </ul>

      <input
        ref={pickerRef}
        type="file"
        accept="image/*"
        multiple
        hidden
        onChange={(event) => {
          const picked = Array.from(event.target.files ?? []);
          if (picked.length > 0) onAddFiles(picked);
          event.target.value = "";
        }}
      />

      {items.some((item) => item.status === "failed" && item.error) && (
        <p className="composer-attachment-error" role="alert">
          {items.find((item) => item.status === "failed" && item.error)?.error}
        </p>
      )}

      <div className="sr-only" aria-live="polite" aria-atomic="true">
        {statusAnnouncement}
      </div>

      {inspected && (
        <Modal
          title={inspected.file.name}
          className="media-preview messaging-dialog"
          onClose={() => setInspectId(null)}
        >
          <button
            type="button"
            className="message-icon modal-close"
            aria-label={say("Close", "Cerrar")}
            onClick={() => setInspectId(null)}
          >
            <X />
          </button>
          <div className="media-preview-stage">
            <img src={inspected.previewUrl} alt={inspected.file.name} />
          </div>
          <p className="composer-inspect-meta">
            {formatBytes(inspected.file.size, language)} · {inspected.file.type || "image"}
          </p>
          <div className="modal-actions">
            <Button
              type="button"
              variant="destructive"
              className="rounded-xl"
              onClick={() => {
                const idx = items.findIndex((item) => item.id === inspected.id);
                pendingFocusIndexRef.current = Math.max(0, idx);
                setInspectId(null);
                onRemove(inspected.id);
              }}
            >
              {say("Remove image", "Quitar imagen")}
            </Button>
            <Button type="button" className="rounded-xl" onClick={() => setInspectId(null)}>
              {say("Done", "Listo")}
            </Button>
          </div>
        </Modal>
      )}
    </section>
  );
}
