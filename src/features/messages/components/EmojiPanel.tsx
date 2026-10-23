import { defaultEmojiDataResolver, EmojiPicker } from "frimousse";
import { useMessageText } from "../i18n";

const resolveEmojiData: NonNullable<
  React.ComponentProps<typeof EmojiPicker.Root>["resolveEmojiData"]
> = async (locale, options) => {
  try {
    return await defaultEmojiDataResolver(locale, {
      ...options,
      signal: AbortSignal.any([
        ...(options.signal ? [options.signal] : []),
        AbortSignal.timeout(8000),
      ]),
    });
  } catch {
    // Keep the picker usable when the emoji CDN is unavailable or offline.
    return {
      locale,
      emojis: [
        ["😀", "Smile"],
        ["❤️", "Heart"],
        ["👍", "Thumbs up"],
        ["🎉", "Celebrate"],
        ["☕", "Coffee"],
      ].map(([emoji, label]) => ({
        emoji: emoji ?? "",
        label: label ?? "",
        tags: [],
        version: 1,
        category: 0,
      })),
      categories: [{ index: 0, label: locale === "es" ? "Emojis" : "Emoji" }],
      skinTones: {
        light: "Light",
        "medium-light": "Medium light",
        medium: "Medium",
        "medium-dark": "Medium dark",
        dark: "Dark",
      },
    };
  }
};
const pickerComponents: React.ComponentProps<typeof EmojiPicker.List>["components"] = {
  CategoryHeader: ({ category, ...props }) => (
    <div {...props} className="emoji-category">
      {category.label}
    </div>
  ),
  Row: ({ children, ...props }) => (
    <div {...props} className="emoji-row">
      {children}
    </div>
  ),
  Emoji: ({ emoji, ...props }) => (
    <button {...props} className="emoji-choice">
      {emoji.emoji}
    </button>
  ),
};
export default function EmojiPanel({ onSelect }: { onSelect: (emoji: string) => void }) {
  const { say, language } = useMessageText();
  return (
    <EmojiPicker.Root
      locale={language}
      columns={7}
      resolveEmojiData={resolveEmojiData}
      className="emoji-panel"
      onEmojiSelect={({ emoji }) => onSelect(emoji)}
    >
      <EmojiPicker.Search
        aria-label={say("Search emoji", "Buscar emoji")}
        placeholder={say("Search emoji…", "Buscar emoji…")}
      />
      <EmojiPicker.Viewport className="emoji-viewport">
        <EmojiPicker.Loading>{say("Loading emoji…", "Cargando emojis…")}</EmojiPicker.Loading>
        <EmojiPicker.Empty>{say("No emoji found", "No se encontraron emojis")}</EmojiPicker.Empty>
        <EmojiPicker.List className="emoji-list" components={pickerComponents} />
      </EmojiPicker.Viewport>
    </EmojiPicker.Root>
  );
}
