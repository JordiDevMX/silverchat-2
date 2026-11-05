import { ChevronLeft, ChevronRight, Eye, MoreHorizontal, Pause, X } from "lucide-react";
import { useState } from "react";
import { Avatar } from "../src/components/ui/avatar";
import { Button } from "../src/components/ui/button";
import { StoryOverlay } from "../src/components/ui/story-overlay";
import {
  StoryCardSurface,
  StoryProgressSurface,
  StoryReplySurface,
  StoryStageSurface,
} from "../src/components/ui/story-surfaces";

export function StoriesGallery() {
  const [viewer, setViewer] = useState(false);
  const [sheet, setSheet] = useState(false);
  const [creator, setCreator] = useState(false);
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const [text, setText] = useState("");
  const [notice, setNotice] = useState("");
  const frame = (close?: () => void) => (
    <>
      <StoryProgressSurface count={3} index={index} progress={0.45} />
      <header className="story-viewer-header">
        <Avatar initials="SO" />
        <span>
          <strong>Sofia</strong>
          <small>Just now</small>
        </span>
        <button
          type="button"
          aria-label="Pause preview story"
          aria-pressed={paused}
          onClick={() => setPaused(!paused)}
        >
          <Pause size={18} />
        </button>
        {close ? (
          <button type="button" aria-label="Close preview story" onClick={close}>
            <X size={18} />
          </button>
        ) : (
          <MoreHorizontal size={20} />
        )}
      </header>
      <StoryStageSurface style={{ background: ["#345273", "#704682", "#356453"][index] }}>
        <p className="story-text">
          {["A little time outside.", "See you at sunset.", "Small moments, good company."][index]}
        </p>
      </StoryStageSurface>
      <p className="story-preview-status">
        {paused ? "Paused preview" : "Manually stepped preview — no autoplay"}
      </p>
      <nav className="story-controls">
        <button type="button" onClick={() => setIndex((index + 2) % 3)}>
          <ChevronLeft size={16} />
          Previous preview
        </button>
        <button type="button" onClick={() => setIndex((index + 1) % 3)}>
          Next preview
          <ChevronRight size={16} />
        </button>
      </nav>
      <StoryReplySurface
        text={text}
        onChange={setText}
        label="Preview story reply"
        placeholder="Reply to Sofia…"
        sendLabel="Send preview reply"
        onSubmit={(e) => {
          e.preventDefault();
          setText("");
          setNotice("Preview reply sent locally.");
        }}
      />
      <button type="button" className="story-owner-views" onClick={() => setSheet(true)}>
        <Eye size={16} />
        Preview viewers
      </button>
    </>
  );
  return (
    <section id="stories-gallery" className="stories-gallery">
      <h2>Stories</h2>
      <p>
        Seen and unseen stories, local overlays and manually stepped progress. No accounts, media
        playback or autoplay.
      </p>
      <div className="stories-row">
        <StoryCardSurface
          empty
          name="Add story"
          label="Preview add story"
          onOpen={() => setCreator(true)}
        />
        <StoryCardSurface
          unseen
          label="Preview unseen Sofia"
          name="Sofia"
          background="#345273"
          text="A little time outside."
          avatar={<Avatar initials="SO" />}
          onOpen={() => setViewer(true)}
        />
        <StoryCardSurface
          label="Preview seen Alex"
          name="Alex"
          background="#704682"
          text="See you at sunset."
          avatar={<Avatar initials="AL" />}
          onOpen={() => setViewer(true)}
        />
        <StoryCardSurface
          unseen
          label="Preview my story"
          name="My story"
          background="#356453"
          avatar={<Avatar initials="ME" />}
          onOpen={() => setViewer(true)}
          onCreate={() => setCreator(true)}
          addLabel="Preview another story"
        />
      </div>
      <div className="story-preview-frame story-overlay">
        <div className="story-overlay-body">{frame()}</div>
      </div>
      <p role="status">{notice}</p>
      {viewer && (
        <StoryOverlay
          title="Preview story"
          className="story-viewer"
          onClose={() => setViewer(false)}
        >
          {(close) => frame(close)}
        </StoryOverlay>
      )}
      {sheet && (
        <StoryOverlay
          title="Preview viewed by 2"
          className="story-viewers-sheet"
          onClose={() => setSheet(false)}
        >
          {(close) => (
            <>
              {["Alex", "Marina"].map((name) => (
                <div className="story-viewer-person" key={name}>
                  <Avatar initials={name.slice(0, 2)} />
                  <span>
                    <strong>{name}</strong>
                    <small>Just now</small>
                  </span>
                </div>
              ))}
              <Button variant="outline" onClick={close}>
                Close preview viewers
              </Button>
            </>
          )}
        </StoryOverlay>
      )}
      {creator && (
        <StoryOverlay
          title="Preview create story"
          className="story-creator"
          onClose={() => setCreator(false)}
        >
          {(close) => (
            <>
              <div className="story-text-editor" style={{ background: "#345273" }}>
                <textarea
                  aria-label="Preview story text"
                  maxLength={200}
                  placeholder="What’s on your mind?"
                />
                <small>Text story preview</small>
              </div>
              <div className="modal-actions">
                <Button variant="outline" onClick={close}>
                  Cancel preview story
                </Button>
                <Button
                  onClick={() => {
                    setNotice("Preview story saved locally.");
                    close();
                  }}
                >
                  Save preview story
                </Button>
              </div>
            </>
          )}
        </StoryOverlay>
      )}
    </section>
  );
}
