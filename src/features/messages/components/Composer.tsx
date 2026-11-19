import { ArrowUp, Mic, Plus, Smile, X } from "lucide-react";
import { lazy, Suspense, useCallback } from "react";
import { ComposerDock } from "@/components/ui/messaging";
import { MAX_CLIPBOARD_IMAGES_DEFAULT } from "@/lib/clipboard-images";
import { useClipboardImageTarget } from "@/lib/clipboard-paste";
import { useComposerController } from "../hooks/useComposerController";
import type { ChatDetails, Message, SendInput } from "../types";
import { AttachmentMenu } from "./AttachmentMenu";
import { ComposerAttachmentTray } from "./ComposerAttachmentTray";
import { ContactPicker } from "./ContactPicker";
import { MediaPreviewModal } from "./MediaPreviewModal";
import { MentionAutocomplete } from "./MentionAutocomplete";
import { ReplyPreview } from "./ReplyPreview";
import { VoiceRecorder } from "./VoiceRecorder";

const EmojiPanel = lazy(() => import("./EmojiPanel"));
export function Composer({
  chat,
  onSend,
  replyTo,
  replyToId,
  onClearReply,
}: {
  chat: ChatDetails;
  replyTo?: Message;
  replyToId: string | null;
  onClearReply: () => void;
  onSend: (input: SendInput) => Promise<void>;
}) {
  const {
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
  } = useComposerController({ chat, onSend, replyToId });

  const handleClipboardFeedback = useCallback(
    (message: string) => {
      setError(message);
    },
    [setError],
  );

  useClipboardImageTarget({
    ref: textarea,
    kind: "images",
    disabled: recordMode,
    maxCount: MAX_CLIPBOARD_IMAGES_DEFAULT,
    existingCount: attachments.length,
    onImages: addAttachmentImages,
    onFeedback: handleClipboardFeedback,
  });

  useClipboardImageTarget({
    ref: trayRef,
    kind: "images",
    disabled: recordMode,
    maxCount: MAX_CLIPBOARD_IMAGES_DEFAULT,
    existingCount: attachments.length,
    onImages: addAttachmentImages,
    onFeedback: handleClipboardFeedback,
  });

  const canSend = Boolean(text.trim() || attachments.length > 0);
  const focusTextarea = useCallback(() => {
    requestAnimationFrame(() => textarea.current?.focus());
  }, [textarea]);

  return (
    <ComposerDock
      data-drag-active={dragActive || undefined}
      onDragOver={(e) => {
        if (recordMode) return;
        if (e.dataTransfer?.types && Array.from(e.dataTransfer.types).includes("Files")) {
          e.preventDefault();
          if (!dragActive) setDragActive(true);
        }
      }}
      onDragLeave={(e) => {
        if (dragActive && !e.currentTarget.contains(e.relatedTarget as Node | null)) {
          setDragActive(false);
        }
      }}
      onDrop={(e) => {
        setDragActive(false);
        if (recordMode) return;
        if (e.dataTransfer?.files?.length) {
          e.preventDefault();
          addFromDataTransfer(e.dataTransfer);
        }
      }}
    >
      {replyToId && <ReplyPreview mode="bar" message={replyTo} onClear={onClearReply} />}
      {recordMode ? (
        <VoiceRecorder
          recorder={recorder}
          chatId={chat.id}
          channelMode={chat.channelMode}
          onSend={onSend}
          onClose={() => setRecordMode(false)}
        />
      ) : (
        <>
          <ComposerAttachmentTray
            items={attachments}
            trayRef={trayRef}
            sending={sendingAttachments}
            statusAnnouncement={attachmentAnnouncement}
            onAddFiles={(picked) => {
              addFromDataTransfer({ files: picked });
            }}
            onRemove={removeAttachment}
            onRetry={retryAttachment}
            onClear={clearAttachments}
            onFocusInput={focusTextarea}
          />
          <div className="composer-row">
            <button
              type="button"
              className="message-icon composer-attach"
              aria-label={say("Attach", "Adjuntar")}
              onClick={() => setAttach(true)}
            >
              <Plus />
            </button>
            <div className="composer-input">
              <textarea
                ref={textarea}
                aria-label={say("Message", "Mensaje")}
                placeholder={
                  attachments.length > 0
                    ? say("Add a caption…", "Añadir descripción…")
                    : say("Message…", "Mensaje…")
                }
                enterKeyHint="send"
                rows={1}
                value={text}
                aria-controls={mentions.options.length ? "mention-options" : undefined}
                aria-activedescendant={
                  mentions.options[mentions.index]
                    ? `mention-${mentions.options[mentions.index]?.user_id}`
                    : undefined
                }
                onChange={(e) => {
                  setText(e.target.value);
                  setCaret(e.target.selectionStart);
                }}
                onSelect={(e) => {
                  const el = e.currentTarget;
                  selection.current = { start: el.selectionStart, end: el.selectionEnd };
                  setCaret(el.selectionStart);
                }}
                onKeyDown={(e) => {
                  if (e.nativeEvent.isComposing) return;
                  if (mentions.options.length) {
                    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
                      e.preventDefault();
                      mentions.move(e.key === "ArrowDown" ? 1 : -1);
                      return;
                    }
                    if (e.key === "Escape") {
                      mentions.dismiss();
                      return;
                    }
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      const member = mentions.options[mentions.index];
                      if (member) choose(member);
                      return;
                    }
                  }
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    void send();
                  }
                }}
              />
              <div ref={emojiBox}>
                <button
                  type="button"
                  className="message-icon emoji-toggle"
                  aria-label={say("Emoji", "Emoji")}
                  aria-expanded={emoji}
                  onClick={() => {
                    if (!emoji && textarea.current)
                      selection.current = {
                        start: textarea.current.selectionStart,
                        end: textarea.current.selectionEnd,
                      };
                    setEmoji(!emoji);
                  }}
                >
                  <Smile size={21} />
                </button>
                {emoji && (
                  <div className="emoji-popover">
                    <button
                      type="button"
                      className="message-icon"
                      aria-label={say("Close emoji picker", "Cerrar emojis")}
                      onClick={() => setEmoji(false)}
                    >
                      <X size={16} />
                    </button>
                    <Suspense fallback={<p>{say("Loading…", "Cargando…")}</p>}>
                      <EmojiPanel
                        onSelect={(value) => {
                          const { start, end } = selection.current;
                          position(
                            text.slice(0, start) + value + text.slice(end),
                            start + value.length,
                          );
                          setEmoji(false);
                        }}
                      />
                    </Suspense>
                  </div>
                )}
              </div>
              {mentions.options.length > 0 && (
                <MentionAutocomplete
                  members={mentions.options}
                  index={mentions.index}
                  onChoose={choose}
                />
              )}
            </div>
            <button
              type="button"
              className="composer-send"
              disabled={false}
              aria-label={
                canSend
                  ? say("Send message", "Enviar mensaje")
                  : say("Record voice note", "Grabar nota de voz")
              }
              onClick={() => {
                if (canSend) void send();
                else {
                  setRecordMode(true);
                  void recorder.start();
                }
              }}
            >
              {canSend ? <ArrowUp size={22} /> : <Mic size={22} />}
            </button>
          </div>
        </>
      )}
      {error && (
        <p className="composer-error" role="alert">
          {error}
        </p>
      )}
      {attach && (
        <AttachmentMenu
          onClose={() => setAttach(false)}
          onFile={(next) => {
            setAttach(false);
            setExtraFiles([]);
            setFile(next);
          }}
          onFiles={(picked) => {
            setAttach(false);
            setFile(picked[0]);
            setExtraFiles(picked.slice(1));
          }}
          onContact={() => {
            setAttach(false);
            setContacts(true);
          }}
        />
      )}
      {file && (
        <MediaPreviewModal
          file={file}
          extraFiles={extraFiles}
          chatId={chat.id}
          channelMode={chat.channelMode}
          onSend={onSend}
          onClose={() => {
            setFile(undefined);
            setExtraFiles([]);
          }}
        />
      )}{" "}
      {contacts && <ContactPicker onSend={onSend} onClose={() => setContacts(false)} />}
    </ComposerDock>
  );
}
