import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { loadDraftMedia, readMemoryDraftMedia, saveDraftMedia } from "@/features/chats/draftMedia";
import { createDraftWriter, readDrafts } from "@/features/chats/drafts";
import { useAuth } from "@/lib/auth-provider";
import {
  type DataTransferLike,
  extractDataTransferMedia,
  formatClipboardFeedback,
  MAX_CLIPBOARD_IMAGES_DEFAULT,
} from "@/lib/clipboard-images";
import type { ComposerAttachmentItem } from "../components/ComposerAttachmentTray";
import { useMessageText } from "../i18n";
import { cleanupUploads, prepareAndUpload } from "../lib/upload";
import type { ChatDetails, Member, SendInput } from "../types";
import { mentionIds, useMentions } from "./useMentions";
import { useVoiceRecorder } from "./useVoiceRecorder";

interface AttachmentDraftState {
  hydrated: boolean;
  items: ComposerAttachmentItem[];
}

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
  const ownerId = user?.id ?? "";
  const { say, language } = useMessageText();
  const recorder = useVoiceRecorder();
  const [recordMode, setRecordMode] = useState(false);
  const initialDraft = useMemo(() => {
    try {
      return readDrafts(localStorage, ownerId).get(chat.id);
    } catch {
      return undefined;
    }
  }, [chat.id, ownerId]);
  const initialMediaIdsRef = useRef(initialDraft?.mediaUrls ?? []);
  const prevMediaSignatureRef = useRef((initialDraft?.mediaUrls ?? []).join(","));

  const [text, setText] = useState(() => initialDraft?.text ?? "");
  const [caret, setCaret] = useState(text.length);
  const [emoji, setEmoji] = useState(false);
  const [attach, setAttach] = useState(false);
  const [file, setFile] = useState<File>();
  const [extraFiles, setExtraFiles] = useState<File[]>([]);
  const [contacts, setContacts] = useState(false);
  const [error, setError] = useState("");
  const [attachmentState, setAttachmentState] = useState<AttachmentDraftState>(() => {
    const ids = initialDraft?.mediaUrls;
    if (!ids?.length) return { hydrated: true, items: [] };
    const cached = readMemoryDraftMedia(ownerId, chat.id, ids);
    if (!cached) return { hydrated: false, items: [] };
    return {
      hydrated: true,
      items: cached.map(({ id, file: cachedFile }) => ({
        id,
        file: cachedFile,
        status: "queued",
        progress: 0,
      })),
    };
  });
  const [sendingAttachments, setSendingAttachments] = useState(false);
  const [attachmentAnnouncement, setAttachmentAnnouncement] = useState("");
  const [dragActive, setDragActive] = useState(false);
  const textarea = useRef<HTMLTextAreaElement>(null);
  const trayRef = useRef<HTMLDivElement>(null);
  const emojiBox = useRef<HTMLDivElement>(null);
  const selection = useRef({ start: text.length, end: text.length });
  const submitted = useRef<{ text: string; failed?: boolean; pending?: boolean } | null>(null);
  const attachmentsRef = useRef<ComposerAttachmentItem[]>(attachmentState.items);
  attachmentsRef.current = attachmentState.items;
  const controllersRef = useRef(new Map<string, AbortController>());
  const uploadingAttachmentsRef = useRef(false);
  const latestReply = useRef(replyToId);
  latestReply.current = replyToId;
  const latest = useRef(text);
  latest.current = text;
  const writer = useMemo(() => createDraftWriter(chat.id, ownerId), [chat.id, ownerId]);
  const mentionsEnabled = chat.type === "group" || chat.type === "community_chat";
  const mentions = useMentions(text, caret, chat.members, mentionsEnabled);

  const setAttachmentsSynced = useCallback(
    (
      updater: (prev: ComposerAttachmentItem[]) => ComposerAttachmentItem[],
      options?: { persist?: boolean },
    ) => {
      const next = updater(attachmentsRef.current);
      attachmentsRef.current = next;
      setAttachmentState({ hydrated: true, items: next });
      if (options?.persist !== false) {
        void saveDraftMedia(
          ownerId,
          chat.id,
          next.map((item) => ({ id: item.id, file: item.file })),
        );
      }
    },
    [chat.id, ownerId],
  );

  const updateAttachment = useCallback(
    (id: string, patch: Partial<ComposerAttachmentItem>) => {
      setAttachmentsSynced(
        (prev) => prev.map((item) => (item.id === id ? { ...item, ...patch } : item)),
        { persist: false },
      );
    },
    [setAttachmentsSynced],
  );

  useEffect(() => {
    const ids = initialMediaIdsRef.current;
    if (!ids.length) return;
    if (readMemoryDraftMedia(ownerId, chat.id, ids)) return;

    let active = true;
    void loadDraftMedia(ownerId, chat.id, ids).then((loaded) => {
      if (!active) return;
      const existingIds = new Set(attachmentsRef.current.map((item) => item.id));
      const restored: ComposerAttachmentItem[] = loaded
        .filter((entry) => !existingIds.has(entry.id))
        .map(({ id, file: loadedFile }) => ({
          id,
          file: loadedFile,
          status: "queued",
          progress: 0,
        }));
      const merged = [...restored, ...attachmentsRef.current].slice(
        0,
        MAX_CLIPBOARD_IMAGES_DEFAULT,
      );
      attachmentsRef.current = merged;
      setAttachmentState({ hydrated: true, items: merged });
      if (merged.length !== restored.length) {
        void saveDraftMedia(
          ownerId,
          chat.id,
          merged.map((item) => ({ id: item.id, file: item.file })),
        );
      }
    });
    return () => {
      active = false;
    };
  }, [chat.id, ownerId]);

  useEffect(() => {
    if (text.trim()) submitted.current = null;
    const draftText = text.trim() ? text : submitted.current?.text;
    const mediaIds = attachmentState.hydrated
      ? attachmentState.items.map((item) => item.id)
      : initialMediaIdsRef.current;
    const mediaSignature = mediaIds.join(",");
    const mediaChanged = mediaSignature !== prevMediaSignatureRef.current;
    prevMediaSignatureRef.current = mediaSignature;

    writer.write(
      draftText || replyToId || mediaIds.length > 0
        ? {
            text: draftText ?? "",
            mediaUrls: mediaIds,
            replyToId,
            updatedAt: new Date().toISOString(),
            ...(!text.trim() && mediaIds.length === 0
              ? { failed: submitted.current?.failed, pending: submitted.current?.pending }
              : {}),
          }
        : null,
    );
    if (mediaChanged) {
      writer.flush();
    }
    const el = textarea.current;
    if (el) {
      el.style.height = "auto";
      el.style.height = `${Math.min(120, el.scrollHeight)}px`;
    }
  }, [text, writer, replyToId, attachmentState]);
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
      setAttachmentsSynced((prev) => prev.filter((item) => item.id !== id));
      setAttachmentAnnouncement(say("Removed image.", "Imagen quitada."));
    },
    [say, setAttachmentsSynced],
  );

  const clearAttachments = useCallback(() => {
    for (const item of attachmentsRef.current) {
      controllersRef.current.get(item.id)?.abort();
      controllersRef.current.delete(item.id);
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
              ownerId,
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
                const remainingIds = attachmentsRef.current
                  .filter((item) => item.id !== id)
                  .map((item) => item.id);
                setText("");
                latest.current = "";
                setCaret(0);
                writer.write(
                  remainingIds.length > 0 ||
                    (latestReply.current && latestReply.current !== replyToId)
                    ? {
                        text: "",
                        mediaUrls: remainingIds,
                        replyToId:
                          latestReply.current && latestReply.current !== replyToId
                            ? latestReply.current
                            : null,
                        updatedAt: new Date().toISOString(),
                      }
                    : null,
                );
                writer.flush();
              }
            }

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
      ownerId,
      replyToId,
      say,
      setAttachmentsSynced,
      updateAttachment,
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
    attachments: attachmentState.items,
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
