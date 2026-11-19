import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createDraftWriter, readDrafts } from "@/features/chats/drafts";
import {
  type DataTransferLike,
  extractDataTransferMedia,
  formatClipboardFeedback,
  MAX_CLIPBOARD_IMAGES_DEFAULT,
} from "@/lib/clipboard-images";
import { useAuth } from "@/lib/auth-provider";
import type { ComposerAttachmentItem } from "../components/ComposerAttachmentTray";
import { useMessageText } from "../i18n";
import { cleanupUploads, prepareAndUpload } from "../lib/upload";
import type { ChatDetails, Member, SendInput } from "../types";
import { mentionIds, useMentions } from "./useMentions";
import { useVoiceRecorder } from "./useVoiceRecorder";
export function useComposerController({
  chat,
  onSend,
  replyToId,
}: {
  chat: ChatDetails;
  onSend: (input: SendInput) => Promise<void>;
  replyToId: string | null;
}) {
  const { user } = useAuth();
  const { say, language } = useMessageText();
  const recorder = useVoiceRecorder();
  const [recordMode, setRecordMode] = useState(false);
  const [text, setText] = useState(() => {
    try {
      return readDrafts(localStorage, user?.id ?? "").get(chat.id)?.text ?? "";
    } catch {
      return "";
    }
  });
  const [caret, setCaret] = useState(text.length);
  const [emoji, setEmoji] = useState(false);
  const [attach, setAttach] = useState(false);
  const [file, setFile] = useState<File>();
  const [extraFiles, setExtraFiles] = useState<File[]>([]);
  const [contacts, setContacts] = useState(false);
  const [error, setError] = useState("");
  const [attachments, setAttachments] = useState<ComposerAttachmentItem[]>([]);
  const [sendingAttachments, setSendingAttachments] = useState(false);
  const [attachmentAnnouncement, setAttachmentAnnouncement] = useState("");
  const [dragActive, setDragActive] = useState(false);
  const textarea = useRef<HTMLTextAreaElement>(null);
  const trayRef = useRef<HTMLDivElement>(null);
  const emojiBox = useRef<HTMLDivElement>(null);
  const selection = useRef({ start: text.length, end: text.length });
  const submitted = useRef<{ text: string; failed?: boolean; pending?: boolean } | null>(null);
  const attachmentsRef = useRef<ComposerAttachmentItem[]>([]);
  const controllersRef = useRef(new Map<string, AbortController>());
  const uploadingAttachmentsRef = useRef(false);
  const latestReply = useRef(replyToId);
  latestReply.current = replyToId;
  const latest = useRef(text);
  latest.current = text;
  const writer = useMemo(() => createDraftWriter(chat.id, user?.id ?? ""), [chat.id, user]);
  const mentionsEnabled = chat.type === "group" || chat.type === "community_chat";
  const mentions = useMentions(text, caret, chat.members, mentionsEnabled);

  const setAttachmentsSynced = useCallback(
    (updater: (prev: ComposerAttachmentItem[]) => ComposerAttachmentItem[]) => {
      const next = updater(attachmentsRef.current);
      attachmentsRef.current = next;
      setAttachments(next);
    },
    [],
  );

  const updateAttachment = useCallback(
    (id: string, patch: Partial<ComposerAttachmentItem>) => {
      setAttachmentsSynced((prev) =>
        prev.map((item) => (item.id === id ? { ...item, ...patch } : item)),
      );
    },
    [setAttachmentsSynced],
  );

  useEffect(() => {
    if (text.trim()) submitted.current = null;
    const draftText = text.trim() ? text : submitted.current?.text;
    writer.write(
      draftText || replyToId
        ? {
            text: draftText ?? "",
            mediaUrls: [],
            replyToId,
            updatedAt: new Date().toISOString(),
            ...(!text.trim()
              ? { failed: submitted.current?.failed, pending: submitted.current?.pending }
              : {}),
          }
        : null,
    );
    const el = textarea.current;
    if (el) {
      el.style.height = "auto";
      el.style.height = `${Math.min(120, el.scrollHeight)}px`;
    }
  }, [text, writer, replyToId]);
  useEffect(() => {
    const flush = () => writer.flush();
    window.addEventListener("pagehide", flush);
    return () => {
      window.removeEventListener("pagehide", flush);
      writer.flush();
    };
  }, [writer]);
  useEffect(
    () => () => {
      for (const controller of controllersRef.current.values()) {
        controller.abort();
      }
      controllersRef.current.clear();
      for (const item of attachmentsRef.current) {
        URL.revokeObjectURL(item.previewUrl);
      }
    },
    [],
  );
  useEffect(() => {
    if (!emoji) return;
    const click = (e: PointerEvent) => {
      if (!emojiBox.current?.contains(e.target as Node)) setEmoji(false);
    };
    const key = (e: KeyboardEvent) => {
      if (e.key === "Escape") setEmoji(false);
    };
    document.addEventListener("pointerdown", click);
    document.addEventListener("keydown", key);
    return () => {
      document.removeEventListener("pointerdown", click);
      document.removeEventListener("keydown", key);
    };
  }, [emoji]);

  const addAttachmentImages = useCallback(
    (files: File[]) => {
      if (files.length === 0) return;
      const available = Math.max(0, MAX_CLIPBOARD_IMAGES_DEFAULT - attachmentsRef.current.length);
      const accepted = files.slice(0, available);
      if (accepted.length === 0) return;
      const added: ComposerAttachmentItem[] = accepted.map((nextFile) => ({
        id: crypto.randomUUID(),
        file: nextFile,
        previewUrl: URL.createObjectURL(nextFile),
        status: "queued",
        progress: 0,
      }));
      setAttachmentsSynced((prev) => [...prev, ...added]);
      setError("");
      const total = attachmentsRef.current.length;
      setAttachmentAnnouncement(
        accepted.length === 1
          ? say(`Added 1 image. ${total} total.`, `Se añadió 1 imagen. ${total} en total.`)
          : say(
              `Added ${accepted.length} images. ${total} total.`,
              `Se añadieron ${accepted.length} imágenes. ${total} en total.`,
            ),
      );
    },
    [say, setAttachmentsSynced],
  );

  const addFromDataTransfer = useCallback(
    (dataTransfer: DataTransferLike | null | undefined) => {
      const extraction = extractDataTransferMedia(dataTransfer, {
        maxCount: MAX_CLIPBOARD_IMAGES_DEFAULT,
        existingCount: attachmentsRef.current.length,
        strictImagesOnly: true,
      });
      if (!extraction.hadMediaPayload) return false;
      if (extraction.images.length > 0) {
        addAttachmentImages(extraction.images);
      }
      const feedback = formatClipboardFeedback(extraction, language, {
        maxCount: MAX_CLIPBOARD_IMAGES_DEFAULT,
      });
      if (feedback) setError(feedback);
      return true;
    },
    [addAttachmentImages, language],
  );

  const removeAttachment = useCallback(
    (id: string) => {
      controllersRef.current.get(id)?.abort();
      controllersRef.current.delete(id);
      const existing = attachmentsRef.current.find((item) => item.id === id);
      if (existing) URL.revokeObjectURL(existing.previewUrl);
      setAttachmentsSynced((prev) => prev.filter((item) => item.id !== id));
      setAttachmentAnnouncement(say("Removed image.", "Imagen quitada."));
    },
    [say, setAttachmentsSynced],
  );

  const clearAttachments = useCallback(() => {
    for (const item of attachmentsRef.current) {
      controllersRef.current.get(item.id)?.abort();
      controllersRef.current.delete(item.id);
      URL.revokeObjectURL(item.previewUrl);
    }
    setAttachmentsSynced(() => []);
    setError("");
    setAttachmentAnnouncement(say("Cleared all pending images.", "Se quitaron todas las imágenes."));
  }, [say, setAttachmentsSynced]);

  const position = (next: string, at: number) => {
    setText(next);
    setCaret(at);
    selection.current = { start: at, end: at };
    requestAnimationFrame(() => {
      textarea.current?.focus();
      textarea.current?.setSelectionRange(at, at);
    });
  };
  const choose = (member: Member) => {
    const next = mentions.choose(member);
    position(next.text, next.caret);
  };

  const uploadAndSendIds = useCallback(
    async (targetIds: string[]) => {
      if (uploadingAttachmentsRef.current || targetIds.length === 0) return;
      if (typeof navigator !== "undefined" && navigator.onLine === false) {
        const offlineMsg = say(
          "You’re offline. Your images are kept — retry when connected.",
          "Estás sin conexión. Tus imágenes se conservan; reintenta al conectar.",
        );
        for (const id of targetIds) {
          updateAttachment(id, { status: "failed", progress: 0, error: offlineMsg });
        }
        setError(offlineMsg);
        return;
      }

      uploadingAttachmentsRef.current = true;
      setSendingAttachments(true);
      setError("");

      const captionSourceText = latest.current;
      let captionPending = captionSourceText.trim();
      let mentionsPending = mentionsEnabled ? mentionIds(captionSourceText, chat.members) : null;

      try {
        for (const id of targetIds) {
          const current = attachmentsRef.current.find((item) => item.id === id);
          if (!current) continue;
          const controller = new AbortController();
          controllersRef.current.set(id, controller);
          updateAttachment(id, { status: "uploading", progress: 0, error: undefined });

          try {
            const result = await prepareAndUpload(
              current.file,
              chat.id,
              user?.id ?? "",
              controller.signal,
              (progress) => updateAttachment(id, { progress }),
              { bucket: chat.channelMode ? "channel-media" : "chat-media" },
            );

            if (!attachmentsRef.current.some((item) => item.id === id)) {
              await cleanupUploads([result.upload, ...(result.thumbnail ? [result.thumbnail] : [])]);
              continue;
            }

            const itemContent = captionPending || null;
            const itemMentions = captionPending ? mentionsPending : null;
            try {
              await onSend({
                type: result.type,
                content: itemContent,
                mentions: itemMentions,
                file_upload_id: result.upload.id,
                media_thumbnail_upload_id: result.thumbnail?.id,
                upload: result.upload,
                thumbnail: result.thumbnail,
              });
            } catch {
              /* The failed optimistic message in the outbox owns this upload and retry UUID. */
            }

            if (captionPending) {
              captionPending = "";
              mentionsPending = null;
              if (latest.current === captionSourceText) {
                setText("");
                latest.current = "";
                setCaret(0);
                writer.write(
                  latestReply.current && latestReply.current !== replyToId
                    ? {
                        text: "",
                        mediaUrls: [],
                        replyToId: latestReply.current,
                        updatedAt: new Date().toISOString(),
                      }
                    : null,
                );
                writer.flush();
              }
            }

            URL.revokeObjectURL(current.previewUrl);
            setAttachmentsSynced((prev) => prev.filter((item) => item.id !== id));
          } catch (uploadError) {
            if (uploadError instanceof DOMException && uploadError.name === "AbortError") {
              if (attachmentsRef.current.some((item) => item.id === id)) {
                updateAttachment(id, { status: "queued", progress: 0, error: undefined });
              }
            } else {
              const offline = typeof navigator !== "undefined" && navigator.onLine === false;
              const message = offline
                ? say(
                    "Connection lost. Retry when online.",
                    "Se perdió la conexión. Reintenta al conectar.",
                  )
                : uploadError instanceof Error && uploadError.message
                  ? uploadError.message
                  : say("Upload failed. Please try again.", "La carga falló. Inténtalo de nuevo.");
              updateAttachment(id, { status: "failed", progress: 0, error: message });
              setError(message);
              break;
            }
          } finally {
            controllersRef.current.delete(id);
          }
        }
      } finally {
        uploadingAttachmentsRef.current = false;
        setSendingAttachments(false);
      }
    },
    [
      chat.channelMode,
      chat.id,
      chat.members,
      mentionsEnabled,
      onSend,
      replyToId,
      say,
      setAttachmentsSynced,
      updateAttachment,
      user?.id,
      writer,
    ],
  );

  const retryAttachment = useCallback(
    (id: string) => {
      void uploadAndSendIds([id]);
    },
    [uploadAndSendIds],
  );

  const send = async () => {
    if (attachmentsRef.current.length > 0) {
      const targetIds = attachmentsRef.current
        .filter((item) => item.status !== "uploading")
        .map((item) => item.id);
      if (targetIds.length > 0) {
        await uploadAndSendIds(targetIds);
      }
      return;
    }

    const content = latest.current;
    if (!content.trim()) return;
    // The outbox keeps a failed message and its retry UUID. Clearing on enqueue
    // lets the user compose the next message without a delayed response erasing it.
    submitted.current = { text: content, pending: true };
    setText("");
    latest.current = "";
    setCaret(0);
    writer.write({
      text: content,
      mediaUrls: [],
      replyToId,
      updatedAt: new Date().toISOString(),
      pending: true,
    });
    writer.flush();
    setError("");
    try {
      await onSend({
        type: "text",
        content: content.trim(),
        mentions: mentionsEnabled ? mentionIds(content, chat.members) : null,
      });
      if (submitted.current?.text === content) {
        submitted.current = null;
        if (!latest.current.trim()) {
          writer.write(
            latestReply.current && latestReply.current !== replyToId
              ? {
                  text: "",
                  mediaUrls: [],
                  replyToId: latestReply.current,
                  updatedAt: new Date().toISOString(),
                }
              : null,
          );
          writer.flush();
        }
      }
    } catch {
      if (submitted.current?.text === content && !latest.current.trim()) {
        submitted.current = { text: content, failed: true };
        writer.write({
          text: content,
          mediaUrls: [],
          replyToId,
          updatedAt: new Date().toISOString(),
          failed: true,
        });
        writer.flush();
      }
      setError(
        say(
          "Message failed to send. Tap its warning to retry.",
          "No se pudo enviar. Toca la advertencia del mensaje para reintentar.",
        ),
      );
    }
  };
  return {
    say,
    recorder,
    recordMode,
    setRecordMode,
    text,
    setText,
    setCaret,
    emoji,
    setEmoji,
    attach,
    setAttach,
    file,
    setFile,
    extraFiles,
    setExtraFiles,
    contacts,
    setContacts,
    error,
    setError,
    attachments,
    sendingAttachments,
    attachmentAnnouncement,
    dragActive,
    setDragActive,
    textarea,
    trayRef,
    emojiBox,
    selection,
    mentions,
    position,
    choose,
    send,
    addAttachmentImages,
    addFromDataTransfer,
    removeAttachment,
    retryAttachment,
    clearAttachments,
  };
}
