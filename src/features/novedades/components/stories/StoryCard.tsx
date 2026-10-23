import { Camera, Plus } from "lucide-react";
import { useMessageText } from "@/features/messages/i18n";
import { useMediaUrl } from "@/features/messages/lib/media";
import { Avatar, useAvatarGradient } from "@/features/settings/components/shared";
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
  const story = group?.stories.at(-1);
  const media = useMediaUrl(story?.media_type === "video" ? story.thumbnail : story?.upload);
  const gradient = useAvatarGradient(group?.user_id ?? "mine");
  return (
    <div className="story-card-wrap">
      <button
        type="button"
        className={`story-card ${group?.has_unwatched ? "unwatched" : ""} ${!story ? "empty" : ""}`}
        style={{
          background: !story
            ? undefined
            : story.media_type === "text"
              ? safeStoryColor(story.background_color)
              : gradient.data,
        }}
        onClick={story ? onOpen : onCreate}
        aria-label={
          mine
            ? say("My story", "Mi historia")
            : (group?.profile?.display_name ?? say("Story", "Historia"))
        }
      >
        {media.data && <img className="story-card-preview" src={media.data} alt="" />}
        {story?.media_type === "text" && (
          <span className="story-card-text">{story.text_content}</span>
        )}
        {!story ? (
          <Camera size={30} />
        ) : (
          <Avatar profile={group?.profile ?? { id: group?.user_id }} size="small" />
        )}
        <strong>
          {mine
            ? story
              ? say("My story", "Mi historia")
              : say("Add story", "Añadir historia")
            : group?.profile?.display_name}
        </strong>
      </button>
      {mine && story && (
        <button
          type="button"
          className="story-add"
          aria-label={say("Add story", "Añadir historia")}
          onClick={onCreate}
        >
          <Plus size={18} />
        </button>
      )}
    </div>
  );
}
