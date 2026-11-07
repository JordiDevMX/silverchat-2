import { defaultEmojiDataResolver, type EmojiPicker } from "frimousse";
export const resolveEmojiData: NonNullable<
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
