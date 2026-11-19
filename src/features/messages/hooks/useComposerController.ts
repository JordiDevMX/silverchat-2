import { useEffect, useMemo, useRef, useState } from "react";
import { createDraftWriter, readDrafts } from "@/features/chats/drafts";
import { useAuth } from "@/lib/auth-provider";
import { useMessageText } from "../i18n";
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
  const latest = useRef(text);
  latest.current = text;
  const writer = useMemo(() => createDraftWriter(chat.id, user?.id ?? ""), [chat.id, user]);
  const mentionsEnabled = chat.type === "group" || chat.type === "community_chat";
  const mentions = useMentions(text, caret, chat.members, mentionsEnabled);
  useEffect(() => {
    writer.write(
      text.trim() || replyToId
        ? {
            text: text.trim() ? text : "",
            mediaUrls: [],
            replyToId,
            updatedAt: new Date().toISOString(),
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
    setText("");
    latest.current = "";
    setCaret(0);
    writer.write(null);
    writer.flush();
    setError("");
    try {
      await onSend({
        type: "text",
        content: content.trim(),
        mentions: mentionsEnabled ? mentionIds(content, chat.members) : null,
      });
    } catch {
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
    caret,
    setCaret,
    emoji,
    setEmoji,
    attach,
    setAttach,
    file,
    setFile,
    contacts,
    setContacts,
    error,
    textarea,
    emojiBox,
    selection,
    mentions,
    position,
    choose,
    send,
  };
}
