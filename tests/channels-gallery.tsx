import { BellOff, ChevronLeft, MoreVertical, Pencil, Trash2 } from "lucide-react";
import { useState } from "react";
import { Avatar } from "../src/components/ui/avatar";
import { Badge } from "../src/components/ui/badge";
import { Button } from "../src/components/ui/button";
import {
  ChannelFollowButton,
  ChannelInfoSurface,
  ChannelRowContent,
} from "../src/components/ui/channel-surfaces";
import { ConversationHeaderSurface } from "../src/components/ui/conversation-surface";
import { MotionOverlay } from "../src/components/ui/motion-overlay";
import { SettingsRow } from "../src/components/ui/settings-row";

export function ChannelsGallery() {
  const [following, setFollowing] = useState(false);
  const [owner, setOwner] = useState(false);
  const [dialog, setDialog] = useState<"create" | "edit" | "delete" | null>(null);
  const [notice, setNotice] = useState("");
  const avatar = <Avatar initials="SC" />;
  return (
    <section id="channels-gallery" className="channels-gallery">
      <h2>Broadcast channels</h2>
      <p>
        Independent broadcasts: subscribed rows, discovery, header, owner/follower info and local
        dialogs.
      </p>
      <div className="channels-section">
        <h3>Subscribed channels</h3>
        <a href="#channels-gallery" className="channel-list-item channel-row-reveal">
          <ChannelRowContent
            avatar={avatar}
            name="SilverChat announcements"
            verified
            verifiedLabel="Verified preview channel"
            detail="A quieter way to keep up."
            meta={
              <>
                <span>10:42</span>
                <Badge variant="neon">12</Badge>
              </>
            }
          />
        </a>
        <a href="#channels-gallery" className="channel-list-item channel-row-reveal">
          <ChannelRowContent
            avatar={<Avatar initials="DS" />}
            name="Design studio"
            verifiedLabel="Verified preview channel"
            detail="A new collection is here."
            meta={
              <>
                <span>Yesterday</span>
                <BellOff size={15} aria-label="Muted preview channel" />
              </>
            }
          />
        </a>
        <h3>Discover channels</h3>
        <div className="discover-channel channel-row-reveal">
          <a href="#channels-gallery" className="channel-discovery-link">
            <ChannelRowContent
              avatar={<Avatar initials="OF" />}
              name="Outside frame"
              verified
              verifiedLabel="Verified preview channel"
              detail="2,408 followers"
              description="Photography, small discoveries and a little time outdoors."
            />
          </a>
          <ChannelFollowButton
            following={following}
            label={following ? "Following preview" : "Follow preview"}
            onClick={() => setFollowing(!following)}
          />
        </div>
      </div>
      <div className="channel-preview-frame">
        <ConversationHeaderSurface className="channel-header">
          <Button
            variant="ghost"
            size="icon"
            aria-label="Preview back"
            onClick={() => setNotice("Preview navigation stays local.")}
          >
            <ChevronLeft />
          </Button>
          <span className="channel-header-identity">
            {avatar}
            <span>
              <strong>SilverChat announcements</strong>
              <small>1,280 followers</small>
            </span>
          </span>
          <Button
            variant="ghost"
            size="icon"
            aria-label="Preview channel options"
            onClick={() => setNotice("Use the account toggle below to review permissions.")}
          >
            <MoreVertical />
          </Button>
        </ConversationHeaderSurface>
        <Button variant="outline" aria-pressed={owner} onClick={() => setOwner(!owner)}>
          Preview owner account
        </Button>
        <ChannelInfoSurface
          avatar={<Avatar initials="SC" size="large" />}
          title="SilverChat announcements"
          meta="@silverchat · 1,280 followers"
          description="Product news, thoughtful updates and occasional behind-the-scenes notes."
          created="Created October 12, 2026"
        >
          <ChannelFollowButton
            following={following}
            label={following ? "Unfollow preview info" : "Follow preview info"}
            onClick={() => setFollowing(!following)}
          />
          {following && (
            <SettingsRow
              icon={<BellOff />}
              label="Mute preview notifications"
              onClick={() => setNotice("Preview notifications muted locally.")}
            />
          )}
          {owner && (
            <>
              <SettingsRow
                icon={<Pencil />}
                label="Edit preview channel"
                onClick={() => setDialog("edit")}
              />
              <SettingsRow
                icon={<Trash2 />}
                label="Delete preview channel"
                onClick={() => setDialog("delete")}
              />
            </>
          )}
        </ChannelInfoSurface>
      </div>
      <Button variant="neon-outline" onClick={() => setDialog("create")}>
        Create preview channel
      </Button>
      <p role="status">{notice}</p>
      {dialog && (
        <MotionOverlay
          title={
            dialog === "create"
              ? "Create preview channel"
              : dialog === "edit"
                ? "Edit preview channel"
                : "Delete preview channel"
          }
          className="channel-overlay channel-create-modal"
          onClose={() => setDialog(null)}
        >
          {(close) => (
            <form
              className="channel-form"
              onSubmit={(event) => {
                event.preventDefault();
                setNotice("Preview action completed locally.");
                setDialog(null);
              }}
            >
              {dialog === "delete" ? (
                <p>Preview deletion confirmation. No data is removed.</p>
              ) : (
                <>
                  <label className="field">
                    Name
                    <input
                      required
                      defaultValue={dialog === "edit" ? "SilverChat announcements" : ""}
                      maxLength={100}
                    />
                  </label>
                  <label className="field">
                    Slug
                    <input
                      required
                      pattern="[a-z0-9-]{3,50}"
                      defaultValue={dialog === "edit" ? "silverchat" : ""}
                    />
                  </label>
                  <label className="field">
                    Description
                    <textarea maxLength={500} />
                  </label>
                  <small role="status">Preview availability — local form only.</small>
                </>
              )}
              <div className="modal-actions">
                <Button variant="outline" onClick={close}>
                  Cancel preview channel
                </Button>
                <Button type="submit" variant={dialog === "delete" ? "destructive" : "default"}>
                  Confirm preview channel
                </Button>
              </div>
            </form>
          )}
        </MotionOverlay>
      )}
    </section>
  );
}
