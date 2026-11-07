import { useRef } from "react";
import { StoryCardSurface } from "@/components/ui/story-surfaces";
import { useMessageText } from "@/features/messages/i18n";
import { useMediaUrl } from "@/features/messages/lib/media";
import { Avatar, useAvatarGradient } from "@/features/settings/components/shared";
import { useInView } from "@/hooks/useInView";
import { isStorageOutage } from "@/lib/storage-health";
import { safeStoryColor } from "../../lib/storyColors";
import type { StoryGroup } from "../../types";

export function StoryCard({
  group,
  mine,
  onOpen,
  onCreate,
}: {
  group?: StoryGroup | null;
  mine?: boolean;
  onOpen: () => void;
  onCreate?: () => void;
}) {
  const { say } = useMessageText();
  const ref = useRef<HTMLDivElement>(null);
  const isInView = useInView(ref, { rootMargin: "100px" });
  const story = group?.stories.at(-1);
  const media = useMediaUrl(story?.media_type === "video" ? story.thumbnail : story?.upload, {
    enabled: isInView,
  });
  const gradient = useAvatarGradient(group?.user_id ?? "mine");
  const showOutagePlaceholder =
    !!story && story.media_type !== "text" && !media.data && (media.isError || isStorageOutage());
  return (
    <StoryCardSurface
      containerRef={ref}
      unseen={group?.has_unwatched}
      empty={!story}
      label={
        mine
          ? say("My story", "Mi historia")
          : (group?.profile?.display_name ?? say("Story", "Historia"))
      }
      name={
        mine
          ? story
            ? say("My story", "Mi historia")
            : say("Add story", "Añadir historia")
          : (group?.profile?.display_name ?? "")
      }
      background={
        !story
          ? undefined
          : story.media_type === "text"
            ? safeStoryColor(story.background_color)
            : showOutagePlaceholder
              ? undefined
              : gradient.data
      }
      preview={
        media.data ? (
          <img className="story-card-preview" src={media.data} alt="" />
        ) : showOutagePlaceholder ? (
          <span className="story-card-placeholder" aria-hidden="true" />
        ) : null
      }
      text={story?.media_type === "text" ? story.text_content : undefined}
      avatar={
        story ? (
          <Avatar
            profile={group?.profile ?? { id: group?.user_id }}
            size="small"
            enabled={isInView}
          />
        ) : undefined
      }
      onOpen={story ? onOpen : onCreate}
      onCreate={mine && story ? onCreate : undefined}
      addLabel={say("Add story", "Añadir historia")}
    />
  );
}
