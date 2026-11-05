import {
  BellOff,
  Download,
  Info,
  LogOut,
  Mail,
  MoreHorizontal,
  Pin,
  Play,
  Trash2,
  Users,
} from "lucide-react";
import { useState } from "react";
import { Avatar } from "../src/components/ui/avatar";
import { Button } from "../src/components/ui/button";
import { ChatMenuSurface } from "../src/components/ui/chat-menu-surface";
import {
  ChatSettingsDialog,
  ChatSettingsScreenSurface,
  MemberRowSurface,
  SharedFileRowSurface,
  SharedMediaTileSurface,
} from "../src/components/ui/chat-settings-surfaces";
import { FileIconTile } from "../src/components/ui/file-icon-tile";
import { PublicProfileSurface } from "../src/components/ui/public-profile-surface";
import { CardSurface } from "../src/components/ui/settings-row";
import { resolveFileType } from "../src/lib/file-type";

const files = [
  { name: "weekend-plans.pdf", mime: "application/pdf" },
  {
    name: "notes.txt",
    mime: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  },
  {
    name: "budget.xlsx",
    mime: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  },
  {
    name: "slides.pptx",
    mime: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  },
  { name: "photos.zip", mime: "application/zip" },
  { name: "readme.md", mime: "text/markdown" },
];
type PreviewDialog = "contact" | "add" | "clear" | "leave" | "report" | "mute" | "media";
const titles: Record<PreviewDialog, string> = {
  contact: "Preview contact profile",
  add: "Preview add members",
  clear: "Preview clear chat",
  leave: "Preview leave group",
  report: "Preview report",
  mute: "Preview mute notifications",
  media: "Preview shared image",
};
export function ChatSettingsGallery() {
  const [dialog, setDialog] = useState<PreviewDialog | null>(null);
  const [menu, setMenu] = useState<{ x: number; y: number } | null>(null);
  const [tab, setTab] = useState<"media" | "files">("media");
  const [busy, setBusy] = useState(false);
  const [selected, setSelected] = useState(false);
  const [reason, setReason] = useState("spam");
  const [description, setDescription] = useState("");
  const [notice, setNotice] = useState("");
  const open = (next: PreviewDialog) => {
    setBusy(false);
    setSelected(false);
    setDialog(next);
  };
  const done = (text: string) => {
    setNotice(text);
    setDialog(null);
  };
  return (
    <section id="chat-settings-gallery" className="chat-settings-gallery">
      <h2>Chat settings &amp; info</h2>
      <p>
        Real presentation surfaces with local-only controls. No account, media or membership
        requests.
      </p>
      <div className="chat-settings-gallery-columns">
        <ChatSettingsScreenSurface
          as="section"
          id="preview-chat-info"
          header={
            <>
              <h1>Weekend crew</h1>
              <Button
                variant="ghost"
                size="icon"
                aria-label="Preview chat options"
                onClick={(e) => {
                  const b = e.currentTarget.getBoundingClientRect();
                  setMenu({ x: b.right, y: b.bottom });
                }}
              >
                <MoreHorizontal />
              </Button>
            </>
          }
        >
          <div className="group-photo">
            <span className="group-avatar-placeholder">
              <Users size={42} />
            </span>
          </div>
          <CardSurface className="chat-info-card">
            <label className="field">
              Preview group name
              <input
                defaultValue="Weekend crew"
                maxLength={100}
                onBlur={() => setNotice("Group details saved locally.")}
              />
            </label>
            <label className="field">
              Preview description
              <textarea
                rows={3}
                defaultValue="Planning our next adventure, together."
                maxLength={500}
              />
            </label>
            <p>Created on November 5, 2026</p>
            <p>3 members</p>
          </CardSurface>
          <section className="chat-member-section">
            <h2>Members</h2>
            {[
              { name: "Alice Rivera", initials: "AR", role: "Creator · Admin" },
              { name: "Sofia Reyes", initials: "SR", role: "Member" },
              { name: "Dave Park", initials: "DP", role: "Member" },
            ].map((member) => (
              <MemberRowSurface key={member.name}>
                <Button variant="ghost" className="member-identity" onClick={() => open("contact")}>
                  <Avatar initials={member.initials} />
                  <span>
                    <strong>{member.name}</strong>
                    <small>{member.role}</small>
                  </span>
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label={`Preview member actions: ${member.name}`}
                  onClick={() => setNotice(`Member action preview for ${member.name}.`)}
                >
                  <MoreHorizontal />
                </Button>
              </MemberRowSurface>
            ))}
          </section>
          <div className="contact-actions">
            <Button onClick={() => open("add")}>Preview add members</Button>
            <Button variant="destructive" onClick={() => open("leave")}>
              Preview leave group
            </Button>
          </div>
        </ChatSettingsScreenSurface>
        <ChatSettingsScreenSurface
          as="section"
          id="preview-chat-media"
          header={<h1>Shared content preview</h1>}
        >
          <div className="shared-tabs" role="tablist" aria-label="Preview shared content">
            {(["media", "files"] as const).map((value) => (
              <button
                type="button"
                role="tab"
                id={`preview-shared-${value}`}
                aria-selected={tab === value}
                aria-controls="preview-shared-panel"
                key={value}
                onClick={() => setTab(value)}
                onKeyDown={(e) => {
                  if (["ArrowLeft", "ArrowRight"].includes(e.key)) {
                    e.preventDefault();
                    const next = value === "media" ? "files" : "media";
                    setTab(next);
                    document.getElementById(`preview-shared-${next}`)?.focus();
                  }
                }}
              >
                {value === "media" ? "Preview media" : "Preview files"}
              </button>
            ))}
          </div>
          <section
            key={tab}
            className="shared-content-panel"
            id="preview-shared-panel"
            role="tabpanel"
            aria-labelledby={`preview-shared-${tab}`}
          >
            {tab === "media" ? (
              <div className="shared-media-grid">
                {[0, 1, 2, 3, 4, 5].map((i) => (
                  <SharedMediaTileSurface
                    key={i}
                    className={`preview-shared-art preview-shared-art-${i % 3}`}
                    aria-label={i === 2 ? "Preview open video" : "Preview open image"}
                    onClick={() => open("media")}
                  >
                    <span>
                      {i === 2 ? "Video" : "Image"} {i + 1}
                    </span>
                    {i === 2 && <Play size={24} />}
                  </SharedMediaTileSurface>
                ))}
              </div>
            ) : (
              <div className="shared-files">
                {files.map((file) => {
                  const type = resolveFileType({ filename: file.name, mimeType: file.mime });
                  return (
                    <SharedFileRowSurface
                      key={file.name}
                      icon={<FileIconTile family={type.family} />}
                      name={file.name}
                      details={`124 KB · ${type.label[0]} · Nov 5, 2026`}
                      action={
                        <Button
                          variant="ghost"
                          size="icon"
                          aria-label={`Preview download ${file.name}`}
                          onClick={() => setNotice("Download preview — no file fetched.")}
                        >
                          <Download />
                        </Button>
                      }
                    />
                  );
                })}
              </div>
            )}
          </section>
          <div className="chat-gallery-contact">
            <PublicProfileSurface
              headingAs="h2"
              avatar={<Avatar initials="SR" size="xl" />}
              name="Sofia Reyes"
              username="sofia"
              bio="Making room for good conversations."
            >
              <div className="social-pills">
                <span>Portfolio</span>
              </div>
              <Button onClick={() => open("contact")}>Preview contact card</Button>
            </PublicProfileSurface>
          </div>
          <div className="contact-actions">
            <Button variant="outline" onClick={() => open("mute")}>
              Preview mute
            </Button>
            <Button variant="outline" onClick={() => open("report")}>
              Preview report
            </Button>
            <Button variant="destructive" onClick={() => open("clear")}>
              Preview clear chat
            </Button>
          </div>
        </ChatSettingsScreenSurface>
      </div>
      <p role="status">{notice}</p>
      {menu && (
        <ChatMenuSurface
          label="Preview chat options"
          point={menu}
          onClose={() => setMenu(null)}
          items={[
            {
              key: "info",
              label: "Preview group info",
              icon: <Info />,
              onSelect: () => {
                setMenu(null);
                setNotice("Group info preview selected.");
              },
            },
            {
              key: "mute",
              label: "Preview mute",
              icon: <BellOff />,
              onSelect: () => {
                setMenu(null);
                open("mute");
              },
            },
            {
              key: "pin",
              label: "Preview pin",
              icon: <Pin />,
              onSelect: () => {
                setMenu(null);
                setNotice("Chat pinned locally.");
              },
            },
            {
              key: "unread",
              label: "Preview mark unread",
              icon: <Mail />,
              onSelect: () => {
                setMenu(null);
                setNotice("Chat marked unread locally.");
              },
            },
            {
              key: "clear",
              label: "Preview clear chat",
              icon: <Trash2 />,
              destructive: true,
              separator: true,
              onSelect: () => {
                setMenu(null);
                open("clear");
              },
            },
            {
              key: "leave",
              label: "Preview leave group",
              icon: <LogOut />,
              destructive: true,
              onSelect: () => {
                setMenu(null);
                open("leave");
              },
            },
          ]}
        />
      )}
      {dialog && (
        <ChatSettingsDialog
          title={titles[dialog]}
          onClose={() => setDialog(null)}
          canClose={!busy}
          className={dialog === "contact" ? "contact-profile-dialog" : ""}
        >
          {(dismiss) => (
            <>
              {dialog === "contact" && (
                <PublicProfileSurface
                  headingAs="h2"
                  avatar={<Avatar initials="SR" size="xl" />}
                  name="Sofia Reyes"
                  username="sofia"
                  bio="Making room for good conversations."
                >
                  <div className="contact-actions">
                    <Button disabled={busy} onClick={() => done("Message preview — nothing sent.")}>
                      Preview message
                    </Button>
                    <Button variant="outline" disabled title="Calls coming soon">
                      Call
                    </Button>
                    <Button variant="outline" disabled title="Calls coming soon">
                      Video
                    </Button>
                  </div>
                </PublicProfileSurface>
              )}
              {dialog === "add" && (
                <>
                  <input
                    type="search"
                    aria-label="Preview member search"
                    placeholder="Search by name or @username"
                  />
                  <p>{selected ? 1 : 0}/50 selected</p>
                  <div className="member-candidates">
                    <h3>Contacts</h3>
                    <label className="member-choice">
                      <input
                        type="checkbox"
                        checked={selected}
                        disabled={busy}
                        onChange={(e) => setSelected(e.target.checked)}
                      />
                      <Avatar initials="DP" />
                      <span>
                        Dave Park<small>@dave</small>
                      </span>
                    </label>
                  </div>
                </>
              )}
              {dialog === "clear" && (
                <p>
                  Messages will be removed from your view. Other participants will still see them.
                </p>
              )}
              {dialog === "leave" && (
                <p>You’re the last admin. The oldest member will be promoted automatically.</p>
              )}
              {dialog === "mute" && (
                <div className="mute-options">
                  {["1 hour", "8 hours", "1 day", "1 week", "Always"].map((label) => (
                    <Button
                      key={label}
                      variant="outline"
                      disabled={busy}
                      onClick={() => done(`Muted locally: ${label}.`)}
                    >
                      {label}
                    </Button>
                  ))}
                </div>
              )}
              {dialog === "report" && (
                <>
                  <fieldset>
                    <legend>Why are you reporting this user?</legend>
                    {["spam", "other"].map((value) => (
                      <label className="report-reason" key={value}>
                        <input
                          type="radio"
                          name="preview-report-reason"
                          checked={reason === value}
                          onChange={() => setReason(value)}
                        />
                        {value === "spam" ? "Spam" : "Other"}
                      </label>
                    ))}
                  </fieldset>
                  <label className="field">
                    Preview report description
                    <textarea
                      rows={3}
                      maxLength={500}
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                    />
                  </label>
                  <small>{description.length}/500</small>
                </>
              )}
              {dialog === "media" && (
                <div className="preview-shared-art preview-shared-lightbox">
                  <span>Local lightbox frame — no media request</span>
                </div>
              )}
              <label className="checkbox-label">
                <input type="checkbox" checked={busy} onChange={(e) => setBusy(e.target.checked)} />
                Preview pending action
              </label>
              <div className="modal-actions">
                <Button variant="outline" disabled={busy} onClick={dismiss}>
                  Cancel chat preview
                </Button>
                {["add", "clear", "leave", "report"].includes(dialog) && (
                  <Button
                    variant={dialog === "clear" || dialog === "leave" ? "destructive" : "default"}
                    disabled={
                      busy ||
                      (dialog === "add" && !selected) ||
                      (dialog === "report" && reason === "other" && !description.trim())
                    }
                    onClick={() => done(`${titles[dialog]} confirmed locally.`)}
                  >
                    Confirm chat preview
                  </Button>
                )}
              </div>
            </>
          )}
        </ChatSettingsDialog>
      )}
    </section>
  );
}
