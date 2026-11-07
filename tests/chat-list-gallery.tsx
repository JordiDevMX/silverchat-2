import { useState } from "react";
import { Avatar } from "../src/components/ui/avatar";
import { Button } from "../src/components/ui/button";
import { ChatFiltersSurface } from "../src/features/chats/components/ChatFilters";
import { ChatListItemSurface } from "../src/features/chats/components/ChatListItemSurface";
import {
  ChatContactRow,
  ChatListSkeleton,
} from "../src/features/chats/components/ChatPickerSurfaces";
import { ChatsEmptyStateSurface } from "../src/features/chats/components/ChatsEmptyState";
import { DeleteChatModalSurface } from "../src/features/chats/components/DeleteChatModal";
import { MultiSelectToolbarSurface } from "../src/features/chats/components/MultiSelectToolbar";
import { NewChatDialogSurface } from "../src/features/chats/components/NewChatDialogSurface";
import type { Chat, Draft, FilterKey } from "../src/features/chats/types";
import { applyFilter } from "../src/features/chats/utils/computeChatDisplay";

const t = (text: string) => text;
const base: Chat = {
  id: "preview-unread",
  type: "direct",
  displayName: "Sofia Reyes",
  avatarUrl: null,
  memberNames: [],
  senderName: "Sofia",
  lastMessageAt: "2026-11-06T15:30:00Z",
  lastMessagePreview: "See you tomorrow — the final details are ready.",
  lastMessageType: "text",
  lastMessageStatus: null,
  deletedForEveryone: false,
  isMyLastMessage: false,
  unreadCount: 128,
  manuallyUnread: false,
  pinnedAt: null,
  favoritedAt: null,
  archivedAt: null,
  mutedUntil: null,
  isBlocked: false,
  isLastAdmin: false,
};
const rows: Chat[] = [
  base,
  {
    ...base,
    id: "preview-muted",
    displayName: "Design team",
    type: "group",
    unreadCount: 9,
    mutedUntil: "9999-12-31T00:00:00Z",
    pinnedAt: "2026-11-05",
    lastMessageType: "file",
    lastMessagePreview: "Brand guidelines.pdf",
  },
  {
    ...base,
    id: "preview-draft",
    displayName: "Mateo Cruz",
    unreadCount: 0,
    favoritedAt: "2026-11-05",
  },
  {
    ...base,
    id: "preview-read",
    displayName: "Alexandra Montgomery with a long display name",
    unreadCount: 0,
    isMyLastMessage: true,
    lastMessageStatus: "read",
    lastMessageType: "image",
    lastMessagePreview: "Photo",
  },
  {
    ...base,
    id: "preview-manual",
    displayName: "Weekend plans",
    unreadCount: 0,
    manuallyUnread: true,
  },
  {
    ...base,
    id: "preview-archived",
    displayName: "Archived project",
    unreadCount: 0,
    archivedAt: "2026-11-05",
  },
];
const draft: Draft = {
  text: "A thought to finish later…",
  mediaUrls: [],
  replyToId: null,
  updatedAt: "2099-01-01",
};

export function ChatListGallery() {
  const [filter, setFilter] = useState<FilterKey>("all");
  const [selecting, setSelecting] = useState(false);
  const [selected, setSelected] = useState<string[]>([]);
  const [dialog, setDialog] = useState<"new" | "delete" | null>(null);
  const [feedback, setFeedback] = useState("Preview ready");
  const [member, setMember] = useState(false);
  const visible = applyFilter(rows, filter);
  return (
    <section
      id="chat-list-gallery"
      className="chat-list-gallery"
      aria-labelledby="chat-list-gallery-title"
    >
      <h2 id="chat-list-gallery-title">Chat list & creation</h2>
      <p>
        Local previews of the live list, filters, pickers and dialogs. On a touch viewport, swipe a
        row to reveal its actions.
      </p>
      <div className="chat-list-gallery-controls">
        <Button variant="outline" onClick={() => setSelecting(!selecting)}>
          Preview selection
        </Button>
        <Button variant="outline" onClick={() => setDialog("new")}>
          Preview new chat
        </Button>
        <Button variant="outline" onClick={() => setDialog("delete")}>
          Preview deletion
        </Button>
      </div>
      <p role="status" className="chat-list-gallery-feedback">
        {feedback}
      </p>
      <div className="chats-surface">
        {selecting && (
          <MultiSelectToolbarSurface
            t={t}
            count={selected.length}
            all={selected.length === visible.length}
            busy={false}
            onClose={() => setSelecting(false)}
            onAll={() =>
              setSelected(selected.length === visible.length ? [] : visible.map((c) => c.id))
            }
            onAction={(action) => setFeedback(`Bulk ${action}: ${selected.length}`)}
          />
        )}
        <ChatFiltersSurface t={t} value={filter} onChange={setFilter} />
        {visible.length ? (
          <ul className="chat-list">
            {visible.map((chat) => (
              <ChatListItemSurface
                key={chat.id}
                t={t}
                language="en"
                chat={chat}
                draft={chat.id === "preview-draft" ? draft : undefined}
                avatar={
                  <Avatar
                    initials={chat.displayName
                      .split(" ")
                      .slice(0, 2)
                      .map((v) => v[0])
                      .join("")}
                    size="lg"
                  />
                }
                selecting={selecting}
                selected={selected.includes(chat.id)}
                busy={false}
                onOpen={() => setFeedback(`Open ${chat.displayName}`)}
                onSelect={() =>
                  setSelected((prev) =>
                    prev.includes(chat.id)
                      ? prev.filter((id) => id !== chat.id)
                      : [...prev, chat.id],
                  )
                }
                onMenu={() => setFeedback(`Menu ${chat.displayName}`)}
                onAction={(action) => setFeedback(`${action}: ${chat.displayName}`)}
              />
            ))}
          </ul>
        ) : (
          <ChatsEmptyStateSurface t={t} filter={filter} query="" onNew={() => setDialog("new")} />
        )}
      </div>
      <div className="chat-list-gallery-pickers">
        <div className="chats-surface new-chat-surface">
          <h3 className="new-chat-section-title">Contact & group picker rows</h3>
          <ul className="new-chat-user-list">
            <ChatContactRow
              avatar={<Avatar initials="SR" size="lg" />}
              name="Sofia Reyes"
              username="sofia"
              bio="Design, music and long conversations"
              disabled={false}
              onSelect={() => setFeedback("Message Sofia")}
              actionLabel="Message"
            />
            <ChatContactRow
              avatar={<Avatar initials="MC" size="lg" />}
              name="Mateo Cruz"
              username="mateo"
              disabled={false}
              checked={member}
              onSelect={() => setMember(!member)}
            />
          </ul>
          <ChatListSkeleton label="Preview loading contacts" />
        </div>
        <div className="chats-surface">
          <ChatsEmptyStateSurface t={t} filter="all" query="" onNew={() => setDialog("new")} />
        </div>
      </div>
      {dialog === "new" && (
        <NewChatDialogSurface
          t={t}
          busy={false}
          feedback={<p>Local creation preview</p>}
          go={(href) => {
            setFeedback(`Navigate ${href}`);
            setDialog(null);
          }}
          createSelf={() => {
            setFeedback("Create self chat");
            setDialog(null);
          }}
          onClose={() => setDialog(null)}
        />
      )}
      {dialog === "delete" && (
        <DeleteChatModalSurface
          t={t}
          chats={[
            base,
            {
              ...base,
              id: "preview-group",
              type: "group",
              displayName: "Design team",
              isLastAdmin: true,
            },
          ]}
          busy={false}
          error=""
          onClose={() => setDialog(null)}
          onConfirm={() => {
            setFeedback("Deletion confirmed locally");
            setDialog(null);
          }}
        />
      )}
    </section>
  );
}
