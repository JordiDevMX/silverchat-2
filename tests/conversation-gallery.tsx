import {
  ArrowDown,
  CheckCheck,
  ChevronLeft,
  Download,
  MapPin,
  MoreVertical,
  Phone,
  Pin,
  Play,
  Search,
  Video,
} from "lucide-react";
import type { ReactNode } from "react";
import { Avatar } from "../src/components/ui/avatar";
import { Badge } from "../src/components/ui/badge";
import {
  ConversationHeaderSurface,
  MessageSurface,
  ReactionChip,
  TimelineDate,
  TimelineUnread,
} from "../src/components/ui/conversation-surface";
import { FileIconTile } from "../src/components/ui/file-icon-tile";
import { LinkifiedText } from "../src/features/messages/utils/linkifyText";
import { resolveFileType } from "../src/lib/file-type";

function Sample({
  own = false,
  kind,
  children,
  reactions = false,
}: {
  own?: boolean;
  kind: string;
  children: ReactNode;
  reactions?: boolean;
}) {
  return (
    <div className={`message-row ${own ? "own" : "incoming"}`} data-gallery-message={kind}>
      <div className="message-stack">
        <MessageSurface own={own} sticker={kind === "sticker"}>
          {children}
          {kind !== "deleted" && kind !== "sticker" && (
            <div className="message-meta">
              <time>10:42</time>
              {own && <CheckCheck size={13} aria-label="Read" />}
            </div>
          )}
        </MessageSurface>
        {reactions && (
          <div className="message-reactions">
            <ReactionChip aria-label="Heart, 2 reactions" aria-pressed={true}>
              ❤️ 2
            </ReactionChip>
            <ReactionChip aria-label="Sparkles, 1 reaction" aria-pressed={false}>
              ✨ 1
            </ReactionChip>
          </div>
        )}
      </div>
    </div>
  );
}

const fileSamples = [
  { filename: "Q3_Financial_Report.pdf", mimeType: "application/pdf" },
  {
    filename: "Project budget.xlsx",
    mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  },
  {
    filename: "Project brief.docx",
    mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  },
  {
    filename: "Team update.pptx",
    mimeType: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  },
  { filename: "Meeting notes.txt", mimeType: "text/plain" },
  { filename: "Backup.custom", mimeType: "application/x-custom" },
  // Deliberate mismatch: stored MIME wins over the misleading PDF filename.
  { filename: "Renamed spreadsheet.pdf", mimeType: "application/vnd.ms-excel" },
];

/** Static fixture only: no session, data providers, remote media, or audio playback. */
export function ConversationGallery() {
  return (
    <section
      id="conversation-gallery"
      aria-labelledby="conversation-gallery-title"
      className="mt-10"
    >
      <h2 id="conversation-gallery-title" className="mb-2 text-xl font-semibold">
        Conversation timeline
      </h2>
      <p className="mb-4 text-sm text-muted-foreground">
        Read-only preview. Audio waveforms and header controls are static; the composer and action
        dialogs follow in Module 2B.
      </p>
      <div
        className="overflow-hidden rounded-2xl border border-border bg-background"
        data-slot="conversation-gallery"
      >
        <ConversationHeaderSurface>
          <button
            type="button"
            disabled
            className="message-icon conversation-back"
            aria-label="Preview back"
          >
            <ChevronLeft />
          </button>
          <div className="conversation-identity min-w-0 flex-1">
            <Avatar initials="SR" size="sm" />
            <span>
              <strong>Sofia Reyes</strong>
              <small>
                <i className="presence-dot" />
                Online
              </small>
            </span>
          </div>
          <div className="conversation-actions">
            {[
              { Icon: Search, label: "search" },
              { Icon: Phone, label: "call" },
              { Icon: Video, label: "video" },
              { Icon: MoreVertical, label: "options" },
            ].map(({ Icon, label }) => (
              <button
                key={label}
                type="button"
                disabled
                className={`message-icon ${label === "search" ? "conversation-search-trigger" : ""}`}
                aria-label={`Preview ${label}`}
              >
                <Icon size={20} />
              </button>
            ))}
          </div>
        </ConversationHeaderSurface>
        <aside className="pinned-messages" aria-label="Preview pinned messages">
          <div className="pinned-toggle">
            <Pin size={14} /> Pinned messages · 1
          </div>
          <div>
            <span>Saturday at the studio, 10:30.</span>
          </div>
        </aside>
        <div className="message-list-shell">
          <div className="message-list" data-slot="gallery-timeline" style={{ height: "auto" }}>
            <TimelineDate>Today</TimelineDate>
            <Sample kind="text">
              <p className="message-text">
                <LinkifiedText
                  text={"Morning! I saved the notes at example.com.\nShall we meet at the studio?"}
                  mentions={null}
                  members={[]}
                />
              </p>
            </Sample>
            <Sample own kind="text" reactions>
              <p className="message-text">Yes, 10:30 works. I’ll bring the first sketches.</p>
            </Sample>
            <TimelineUnread>Unread messages</TimelineUnread>
            {[false, true].map((own) => (
              <Sample key={String(own)} own={own} kind="image">
                <div className="message-image aspect-[4/3] bg-gradient-silver">
                  <img
                    src="/favicon.svg"
                    alt="SilverChat brand sketch"
                    style={{ objectFit: "contain", padding: 40 }}
                  />
                </div>
                <p className="message-text">The new brand sketch.</p>
              </Sample>
            ))}
            <Sample kind="video">
              <div className="message-image message-video aspect-video bg-gradient-silver">
                <span className="video-play">
                  <Play size={28} />
                </span>
              </div>
              <p className="message-text">A quick studio tour.</p>
            </Sample>
            {[false, true].map((own) => (
              <Sample key={String(own)} own={own} kind="audio">
                <div className="voice-player" role="img" aria-label="Static voice note, 18 seconds">
                  <span className="message-icon">
                    <Play size={20} />
                  </span>
                  <div className="voice-track">
                    <svg viewBox="0 0 160 40" aria-hidden="true">
                      {Array.from({ length: 40 }, (_, i) => (
                        <rect
                          // biome-ignore lint/suspicious/noArrayIndexKey: Static waveform positions never reorder.
                          key={`bar-${i * 4}`}
                          x={i * 4}
                          y={20 - (6 + ((i * 13) % 30)) / 2}
                          width="2.5"
                          height={6 + ((i * 13) % 30)}
                          rx="1"
                        />
                      ))}
                    </svg>
                  </div>
                  <small>0:18</small>
                </div>
              </Sample>
            ))}
            {fileSamples.flatMap((file) =>
              [false, true].map((own) => {
                const fileType = resolveFileType(file);
                return (
                  <Sample key={file.filename + own} own={own} kind="file">
                    <div className="message-file" data-file-sample={file.filename}>
                      <FileIconTile family={fileType.family} />
                      <div>
                        <strong title={file.filename}>{file.filename}</strong>
                        <small>248 KB · {fileType.label[0]}</small>
                      </div>
                      <button
                        type="button"
                        className="message-icon"
                        disabled
                        aria-label="Download attachment (preview only)"
                      >
                        <Download size={18} />
                      </button>
                    </div>
                  </Sample>
                );
              }),
            )}
            <Sample kind="contact">
              <div className="message-contact">
                <Avatar initials="AM" size="sm" />
                <div>
                  <strong>Alex Moreno</strong>
                  <small>@alex</small>
                </div>
              </div>
            </Sample>
            <Sample own kind="location">
              <div className="message-location">
                <MapPin size={36} />
                <span>19.4326, −99.1332</span>
              </div>
              <p className="message-text">Meet here.</p>
            </Sample>
            <Sample kind="sticker">
              <span
                className="inline-grid size-32 place-items-center text-7xl"
                role="img"
                aria-label="Waving hand sticker"
              >
                👋
              </span>
            </Sample>
            <p className="message-system" data-gallery-message="system">
              Sofia updated the conversation name
            </p>
            {[false, true].map((own) => (
              <Sample key={String(own)} own={own} kind="deleted">
                <p className="message-deleted">This message was deleted</p>
              </Sample>
            ))}
            <div className="message-highlight">
              <Sample kind="highlight">
                <p className="message-text">Saturday at the studio, 10:30.</p>
              </Sample>
            </div>
          </div>
          <button
            type="button"
            className="message-scroll-bottom"
            aria-label="Preview latest messages"
            onClick={(event) =>
              event.currentTarget
                .closest("section")
                ?.querySelector('[data-gallery-message="highlight"]')
                ?.scrollIntoView({ block: "center" })
            }
          >
            <ArrowDown />
            <Badge variant="neon">3</Badge>
          </button>
        </div>
      </div>
    </section>
  );
}
