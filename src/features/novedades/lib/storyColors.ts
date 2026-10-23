import { AVATAR_GRADIENTS, getCSSGradient } from "@/lib/avatar";
export const STORY_COLORS = AVATAR_GRADIENTS.slice(0, 8).map(getCSSGradient);
export function safeStoryColor(value: string | null) {
  return value && (/^#[\da-f]{6}$/i.test(value) || STORY_COLORS.includes(value))
    ? value
    : STORY_COLORS[0];
}
