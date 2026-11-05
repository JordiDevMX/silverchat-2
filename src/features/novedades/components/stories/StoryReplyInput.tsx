import { StoryReplySurface } from "@/components/ui/story-surfaces";
import { useStoryReply } from "../../hooks/stories/useStoryReply";
import type { Story } from "../../types";
export function StoryReplyInput({
  story,
  onFocusChange,
}: {
  story: Story;
  onFocusChange: (open: boolean) => void;
}) {
  const { say, text, setText, busy, error, submit } = useStoryReply(story, onFocusChange);
  return (
    <StoryReplySurface
      text={text}
      onChange={setText}
      onSubmit={submit}
      busy={busy}
      label={say("Reply to story", "Responder a historia")}
      placeholder={say(
        `Reply to ${story.profile?.display_name ?? ""}…`,
        `Responder a ${story.profile?.display_name ?? ""}…`,
      )}
      sendLabel={say("Send", "Enviar")}
      onFocus={() => onFocusChange(true)}
      onBlur={() => {
        if (!busy && !text.trim()) onFocusChange(false);
      }}
      error={
        error ? say("Reply failed. Try again.", "No se pudo responder. Reinténtalo.") : undefined
      }
    />
  );
}
