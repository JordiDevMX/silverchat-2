import {
  ArrowUp,
  Camera,
  ChevronDown,
  ChevronUp,
  Copy,
  Download,
  FileText,
  Forward,
  Image,
  Mic,
  Pause,
  Pencil,
  Pin,
  Play,
  Plus,
  Reply,
  Smile,
  Trash2,
  UserRound,
  X,
} from "lucide-react";
import { useState } from "react";
import { Button } from "../src/components/ui/button";
import { Input } from "../src/components/ui/input";
import {
  ComposerDock,
  QuickReactions,
  ReplySurface,
  VoiceWaveform,
} from "../src/components/ui/messaging";
import { Modal } from "../src/components/ui/modal";
import { Textarea } from "../src/components/ui/textarea";

const peaks = Array.from({ length: 40 }, (_, i) => 12 + ((i * 19) % 82));

/** Local interaction samples: never send messages, fetch emoji or mount native media. */
export function InteractiveGallery() {
  const [text, setText] = useState("The updated files look great.");
  const [reply, setReply] = useState(true);
  const [tools, setTools] = useState(true);
  const [playing, setPlaying] = useState(false);
  const [position, setPosition] = useState(6);
  const [recording, setRecording] = useState(false);
  const [reaction, setReaction] = useState("❤️");
  const [notice, setNotice] = useState("Local preview only — nothing is sent.");
  const [edit, setEdit] = useState(false);
  const [search, setSearch] = useState("files");
  const [result, setResult] = useState(1);
  return (
    <section id="interactive-gallery" className="interactive-gallery">
      <h2>Interactive messaging</h2>
      <p>
        Try the controls below. These previews use local state, with no session, microphone, media
        playback or downloads.
      </p>
      <div className="interactive-preview">
        <h3>Composer & reply</h3>
        <ComposerDock>
          {reply && (
            <ReplySurface
              bar
              label="Replying to Sofia Reyes"
              onClear={() => setReply(false)}
              clearLabel="Preview cancel reply"
            >
              Can you check the files?
            </ReplySurface>
          )}
          <div className="composer-row">
            <button
              type="button"
              className="message-icon composer-attach"
              aria-label="Preview attachments"
              aria-expanded={tools}
              onClick={() => setTools(!tools)}
            >
              <Plus />
            </button>
            <div className="composer-input">
              <textarea
                aria-label="Preview message"
                rows={1}
                value={text}
                onChange={(e) => setText(e.target.value)}
              />
              <button
                type="button"
                className="message-icon emoji-toggle"
                aria-label="Preview insert emoji"
                onClick={() => setText(`${text} 😀`)}
              >
                <Smile size={21} />
              </button>
            </div>
            <button
              type="button"
              className="composer-send"
              aria-label="Preview send message"
              onClick={() => {
                setNotice("Preview message sent locally.");
                setText("");
              }}
            >
              <ArrowUp size={22} />
            </button>
          </div>
        </ComposerDock>
        {tools && (
          <div className="attachment-options">
            {[
              { Icon: Image, label: "Photo / Video" },
              { Icon: Camera, label: "Camera" },
              { Icon: FileText, label: "File" },
              { Icon: UserRound, label: "Contact" },
            ].map(({ Icon, label }) => (
              <button
                type="button"
                key={label}
                onClick={() => setNotice(`${label} selected in preview.`)}
              >
                <Icon />
                <span>{label}</span>
              </button>
            ))}
          </div>
        )}
        <p className="preview-notice" role="status">
          {notice}
        </p>
      </div>
      <div className="interactive-columns">
        <div className="interactive-preview">
          <h3>Emoji & mentions</h3>
          <div className="emoji-popover preview-popover">
            <div className="emoji-panel">
              <Input aria-label="Preview emoji search" placeholder="Search emoji…" readOnly />
              <div className="emoji-category">Frequently used</div>
              <div className="emoji-row">
                {["😀", "❤️", "👍", "🎉", "☕"].map((emoji) => (
                  <button
                    type="button"
                    className="emoji-choice"
                    key={emoji}
                    aria-label={`Preview ${emoji}`}
                    onClick={() => setText(text + emoji)}
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            </div>
          </div>
          <div className="mention-menu preview-popover">
            {["Sofia Reyes", "Alex Moreno"].map((name, i) => (
              <button
                type="button"
                key={name}
                data-preview-selected={i === 0}
                onClick={() => setText(`${text} @${name.split(" ")[0]?.toLowerCase()} `)}
              >
                <strong>{name}</strong>
                <small>@{name.split(" ")[0]?.toLowerCase()}</small>
              </button>
            ))}
          </div>
        </div>
        <div className="interactive-preview">
          <h3>Voice playback & recording</h3>
          <div className="voice-player">
            <button
              type="button"
              className="message-icon voice-toggle"
              aria-label={playing ? "Preview pause audio" : "Preview play audio"}
              onClick={() => setPlaying(!playing)}
            >
              {playing ? <Pause /> : <Play />}
            </button>
            <div className="voice-track">
              <VoiceWaveform peaks={peaks} progress={position / 18} />
              <input
                type="range"
                aria-label="Preview audio position"
                min={0}
                max={18}
                value={position}
                onChange={(e) => setPosition(Number(e.target.value))}
              />
            </div>
            <small>0:{String(position).padStart(2, "0")} / 0:18</small>
          </div>
          <div className="voice-recorder">
            {recording ? (
              <>
                <span className="recording-dot" />
                <time>0:12</time>
                <VoiceWaveform live peaks={peaks} />
                <Button className="rounded-xl" onClick={() => setRecording(false)}>
                  Preview stop recording
                </Button>
                <small>Slide left to cancel · 5 minute limit</small>
              </>
            ) : (
              <>
                <Mic size={20} />
                <span>Ready to record</span>
                <Button className="rounded-xl" onClick={() => setRecording(true)}>
                  Preview start recording
                </Button>
              </>
            )}
          </div>
        </div>
        <div className="interactive-preview">
          <h3>Actions & reactions</h3>
          <QuickReactions
            mine={reaction}
            onSelect={(value) => setReaction(value === reaction ? "" : value)}
          />
          <div className="message-context-menu preview-menu">
            {[
              { Icon: Reply, label: "Reply" },
              { Icon: Copy, label: "Copy text" },
              { Icon: Forward, label: "Forward" },
              { Icon: Pin, label: "Pin" },
              { Icon: Pencil, label: "Edit" },
              { Icon: Trash2, label: "Delete" },
            ].map(({ Icon, label }) => (
              <button
                type="button"
                key={label}
                className={label === "Delete" ? "danger" : undefined}
                onClick={() => {
                  if (label === "Edit") setEdit(true);
                  else if (label === "Reply") setReply(true);
                  else setNotice(`${label} selected in preview.`);
                }}
              >
                <Icon size={17} />
                {label}
              </button>
            ))}
          </div>
        </div>
        <div className="interactive-preview">
          <h3>Search & media viewer</h3>
          <div className="in-chat-search bg-gradient-silver">
            <div>
              <Input
                type="search"
                aria-label="Preview search messages"
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setResult(1);
                }}
              />
              <span role="status">{search ? `${result}/2` : "No results"}</span>
              <button
                type="button"
                className="message-icon"
                aria-label="Preview previous result"
                onClick={() => setResult(result === 1 ? 2 : 1)}
              >
                <ChevronUp />
              </button>
              <button
                type="button"
                className="message-icon"
                aria-label="Preview next result"
                onClick={() => setResult(result === 1 ? 2 : 1)}
              >
                <ChevronDown />
              </button>
            </div>
            <small>Search covers loaded messages only.</small>
          </div>
          <div className="media-lightbox preview-lightbox">
            <div className="lightbox-toolbar">
              <strong className="lightbox-filename">SilverChat.svg</strong>
              <button
                type="button"
                className="message-icon"
                aria-label="Preview download media"
                disabled
              >
                <Download size={18} />
              </button>
              <button
                type="button"
                className="message-icon"
                aria-label="Preview close viewer"
                disabled
              >
                <X />
              </button>
            </div>
            <div className="lightbox-content">
              <img src="/favicon.svg" alt="Local SilverChat mark" />
            </div>
            <p className="lightbox-caption">A quiet frame for the media.</p>
          </div>
        </div>
      </div>
      {edit && (
        <Modal
          title="Preview edit message"
          className="messaging-dialog"
          onClose={() => setEdit(false)}
        >
          <Textarea
            aria-label="Preview edited message"
            value={text}
            onChange={(e) => setText(e.target.value)}
          />
          <div className="modal-actions">
            <Button variant="outline" onClick={() => setEdit(false)}>
              Cancel preview edit
            </Button>
            <Button
              onClick={() => {
                setEdit(false);
                setNotice("Preview edit saved locally.");
              }}
            >
              Save preview edit
            </Button>
          </div>
        </Modal>
      )}
    </section>
  );
}
