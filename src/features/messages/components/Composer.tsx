import { ArrowUp, Mic, Plus, Smile, X } from "lucide-react";
import { lazy, Suspense, useEffect, useMemo, useRef, useState } from "react";
import { createDraftWriter, readDrafts } from "@/features/chats/drafts";
import { useAuth } from "@/lib/auth-provider";
import { mentionIds, useMentions } from "../hooks/useMentions";
import { useVoiceRecorder } from "../hooks/useVoiceRecorder";
import { useMessageText } from "../i18n";
import type { ChatDetails, Member, Message, SendInput } from "../types";
import { AttachmentMenu } from "./AttachmentMenu";
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
  const { user } = useAuth();
  const { say } = useMessageText();
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
  const [contacts, setContacts] = useState(false);
  const [error, setError] = useState("");
  const textarea = useRef<HTMLTextAreaElement>(null);
  const emojiBox = useRef<HTMLDivElement>(null);
  const selection = useRef({ start: text.length, end: text.length });
  const submitted = useRef<{ text: string; failed?: boolean; pending?: boolean } | null>(null);
  const latestReply = useRef(replyToId);
  latestReply.current = replyToId;
  const latest = useRef(text);
  latest.current = text;
  const writer = useMemo(() => createDraftWriter(chat.id, user?.id ?? ""), [chat.id, user]);
  const mentionsEnabled = chat.type === "group" || chat.type === "community_chat";
  const mentions = useMentions(text, caret, chat.members, mentionsEnabled);
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
  const send = async () => {
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
  return (
    <div className="conversation-composer">
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
        <div className="composer-row">
          <button
            type="button"
            className="message-icon"
            aria-label={say("Attach", "Adjuntar")}
            onClick={() => setAttach(true)}
          >
            <Plus />
          </button>
          <div className="composer-input">
            <textarea
              ref={textarea}
              aria-label={say("Message", "Mensaje")}
              placeholder={say("Message…", "Mensaje…")}
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
              text.trim()
                ? say("Send message", "Enviar mensaje")
                : say("Record voice note", "Grabar nota de voz")
            }
            onClick={() => {
              if (text.trim()) void send();
              else {
                setRecordMode(true);
                void recorder.start();
              }
            }}
          >
            {text.trim() ? <ArrowUp size={22} /> : <Mic size={22} />}
          </button>
        </div>
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
            setFile(next);
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
          chatId={chat.id}
          channelMode={chat.channelMode}
          onSend={onSend}
          onClose={() => setFile(undefined)}
        />
      )}{" "}
      {contacts && <ContactPicker onSend={onSend} onClose={() => setContacts(false)} />}
    </div>
  );
}
