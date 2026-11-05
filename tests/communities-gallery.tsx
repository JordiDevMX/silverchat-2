import {
  BellOff,
  ChevronLeft,
  Info,
  LogOut,
  MessageCircle,
  MoreVertical,
  Plus,
  Trash2,
  Users,
} from "lucide-react";
import { useId, useState } from "react";
import { Avatar } from "../src/components/ui/avatar";
import { Badge } from "../src/components/ui/badge";
import { Button } from "../src/components/ui/button";
import {
  CommunityCardSurface,
  CommunityChatRowContent,
} from "../src/components/ui/community-surfaces";
import { ConversationHeaderSurface } from "../src/components/ui/conversation-surface";
import { CardSurface, SettingsRow } from "../src/components/ui/settings-row";
import { CreationDialog } from "../src/features/communities/components/CreationDialog";

export function CommunitiesGallery() {
  const panel = useId();
  const nameId = useId();
  const descriptionId = useId();
  const [expanded, setExpanded] = useState(true);
  const [create, setCreate] = useState(false);
  const [name, setName] = useState("");
  const [notice, setNotice] = useState("Preview only — no community is created.");
  const rows = [
    {
      name: "General",
      preview: "See you at the trailhead!",
      timestamp: "10:42",
      status: <Badge variant="neon">12</Badge>,
    },
    {
      name: "Weekend plans",
      preview: "New route for Sunday",
      timestamp: "Yesterday",
      status: <span className="community-unread-dot" role="img" aria-label="Unread preview chat" />,
    },
    {
      name: "Photos",
      preview: "Alex shared a photo",
      timestamp: "Mon",
      status: <BellOff size={14} aria-label="Muted preview chat" />,
    },
  ];
  return (
    <section id="communities-gallery" className="communities-gallery">
      <h2>Communities</h2>
      <p>
        Real community presentation with local sample state. No membership, network requests or
        backend mutations. Toggle Weekend friends to preview the smooth reveal; reduced motion makes
        it instant.
      </p>
      <CommunityCardSurface
        name="Weekend friends"
        description="Walks, coffee and good company."
        members="24 members"
        avatar={<Avatar initials="WF" />}
        expanded={expanded}
        panelId={panel}
        onToggle={() => setExpanded(!expanded)}
      >
        {rows.map((row) => (
          <button
            type="button"
            className="community-chat-row"
            key={row.name}
            onClick={() => setNotice(`${row.name} selected locally.`)}
          >
            <CommunityChatRowContent {...row} />
          </button>
        ))}
        <button
          type="button"
          className="community-view-all"
          onClick={() => setNotice("All three preview chats are shown.")}
        >
          See all 3 chats →
        </button>
      </CommunityCardSurface>
      <div className="community-preview-columns">
        <aside className="community-sidebar">
          <header className="community-sidebar-header">
            <span className="text-sm text-primary">← Communities</span>
            <strong>Weekend friends</strong>
            <small>24 members</small>
          </header>
          <nav aria-label="Preview community chats">
            {rows.map((row, i) => (
              <button
                type="button"
                className="community-chat-row"
                key={row.name}
                aria-current={i === 0 ? "page" : undefined}
                onClick={() => setNotice(`${row.name} selected locally.`)}
              >
                <CommunityChatRowContent {...row} />
              </button>
            ))}
          </nav>
          <button type="button" className="community-new-chat" onClick={() => setCreate(true)}>
            <Plus size={18} />
            New preview chat
          </button>
          <footer className="community-sidebar-footer">
            <Info size={16} /> Community info
          </footer>
        </aside>
        <div className="community-preview-detail">
          <ConversationHeaderSurface className="community-conversation-header">
            <button
              type="button"
              className="message-icon"
              disabled
              aria-label="Preview back to community"
            >
              <ChevronLeft />
            </button>
            <span className="community-chat-icon">
              <MessageCircle size={20} />
            </span>
            <div className="conversation-identity">
              <span>
                <strong>General</strong>
                <small>Weekend friends</small>
              </span>
            </div>
            <button
              type="button"
              className="message-icon"
              disabled
              aria-label="Preview community chat options"
            >
              <MoreVertical />
            </button>
          </ConversationHeaderSurface>
          <div className="community-info">
            <div className="chat-settings-screen">
              <header>
                <h3>Community info</h3>
              </header>
              <div className="group-photo">
                <span className="community-empty-icon">
                  <Users size={32} />
                </span>
              </div>
              <h3>Weekend friends</h3>
              <p>Walks, coffee and good company.</p>
              <p className="text-sm text-muted-foreground">24 members</p>
              <CardSurface className="community-actions">
                <SettingsRow
                  label="View preview members"
                  icon={<Users />}
                  onClick={() => setNotice("Member preview: Alice, Sofia and Alex.")}
                />
                <SettingsRow
                  label="Mute preview community"
                  icon={<BellOff />}
                  onClick={() => setNotice("Mute preview selected.")}
                />
                <SettingsRow
                  label="Leave preview community"
                  icon={<LogOut />}
                  onClick={() => setNotice("Owners see a successor explanation before leaving.")}
                />
                <SettingsRow
                  label="Delete preview community"
                  icon={<Trash2 />}
                  className="text-destructive"
                  onClick={() =>
                    setNotice("Deletion requires the exact community name in the live app.")
                  }
                />
              </CardSurface>
            </div>
          </div>
        </div>
      </div>
      <Button onClick={() => setCreate(true)}>Open community creation preview</Button>
      <p className="community-preview-notice" role="status">
        {notice}
      </p>
      {create && (
        <CreationDialog title="Preview new community" onClose={() => setCreate(false)}>
          <form
            className="community-creation-form"
            onSubmit={(e) => {
              e.preventDefault();
              setNotice(`“${name}” created in preview only.`);
              setCreate(false);
            }}
          >
            <label className="field" htmlFor={nameId}>
              Preview community name
              <input
                id={nameId}
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                maxLength={100}
              />
            </label>
            <label className="field" htmlFor={descriptionId}>
              Preview description
              <textarea id={descriptionId} rows={3} maxLength={500} />
            </label>
            <div className="modal-actions">
              <Button variant="outline" onClick={() => setCreate(false)}>
                Cancel community preview
              </Button>
              <Button type="submit" disabled={!name.trim()}>
                Create preview community
              </Button>
            </div>
          </form>
        </CreationDialog>
      )}
    </section>
  );
}
