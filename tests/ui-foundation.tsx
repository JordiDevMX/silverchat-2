// Development-only review fixture. No app routes, auth, or remote services.
import "@fontsource-variable/inter";
import "./ui-foundation.css";
import "../src/styles/settings.css";
import "../src/styles/chats.css";
import "../src/styles/messages.css";
import "../src/styles/chat-settings.css";
import "../src/styles/communities.css";
import "../src/styles/novedades.css";
import { Bell, Shield } from "lucide-react";
import { StrictMode, useState } from "react";
import { createRoot } from "react-dom/client";
import { Avatar } from "../src/components/ui/avatar";
import { Badge } from "../src/components/ui/badge";
import { BubbleSurface } from "../src/components/ui/bubble-surface";
import { Button } from "../src/components/ui/button";
import { CodeInput } from "../src/components/ui/code-input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "../src/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "../src/components/ui/dropdown-menu";
import { HoverCard, HoverCardContent, HoverCardTrigger } from "../src/components/ui/hover-card";
import { InlineError } from "../src/components/ui/inline-error";
import { Input } from "../src/components/ui/input";
import { Modal } from "../src/components/ui/modal";
import { Popover, PopoverContent, PopoverTrigger } from "../src/components/ui/popover";
import { Separator } from "../src/components/ui/separator";
import { CardSurface, SectionHeading, SettingsRow } from "../src/components/ui/settings-row";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "../src/components/ui/sheet";
import { Skeleton } from "../src/components/ui/skeleton";
import { Switch } from "../src/components/ui/switch";
import { Textarea } from "../src/components/ui/textarea";

function FoundationReview() {
  const [native, setNative] = useState(false);
  const [nested, setNested] = useState(false);
  const [busy, setBusy] = useState(false);
  const [enabled, setEnabled] = useState(true);
  const [code, setCode] = useState("");
  const [sent, setSent] = useState(0);
  const [notice, setNotice] = useState("");
  const [photo, setPhoto] = useState("/foundation-missing-avatar.png");
  return (
    <main className="review-shell">
      <style>{`
        .review-shell { max-width: 1120px; margin: auto; padding: 32px 20px; }
        .review-header { display: flex; justify-content: space-between; flex-wrap: wrap; gap: 20px; margin-bottom: 32px; }
        .review-header h1 { font-size: 28px; font-weight: 650; letter-spacing: -.04em; }
        .review-header p { color: var(--muted-foreground); }
        .review-grid { display: grid; grid-template-columns: repeat(auto-fit,minmax(min(100%,300px),1fr)); gap: 24px; }
        .review-stack { display: grid; gap: 16px; padding: 20px; min-width: 0; }
        .review-actions { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; }
        .review-swatches { display: grid; grid-template-columns: repeat(3,1fr); gap: 8px; }
        .review-swatch { border: 1px solid var(--border); padding: 20px 8px; border-radius: var(--radius); font-size: 12px; text-align: center; }
      `}</style>
      <div className="review-header">
        <div>
          <h1>SilverChat</h1>
          <p>Design system foundation</p>
        </div>
        <div className="review-actions">
          <Button
            onClick={() => {
              document.documentElement.dataset.theme = "light";
            }}
          >
            Light
          </Button>
          <Button
            variant="secondary"
            onClick={() => {
              document.documentElement.dataset.theme = "dark";
            }}
          >
            Dark
          </Button>
        </div>
      </div>
      <section
        className="mb-8 rounded-3xl border border-border bg-ambient-glow p-6"
        aria-label="Neon identity"
      >
        <SectionHeading>Light, built in</SectionHeading>
        <p className="mb-5 text-sm text-muted-foreground">
          Primary actions, unread messages, and active controls share the same accent light.
        </p>
        <div className="review-actions">
          <Button>Follow</Button>
          <Button variant="neon-outline">Create channel</Button>
          <Button variant="neon-outline" asChild>
            <a href="#review-name">Install preview</a>
          </Button>
          <Badge variant="neon" aria-label="12 unread messages">
            12
          </Badge>
          <Switch aria-label="Glow enabled" defaultChecked />
          <Button disabled>Disabled primary</Button>
        </div>
      </section>
      <section className="mb-8 flex flex-wrap items-start gap-6 p-4" aria-label="Bubble surfaces">
        <BubbleSurface>See you in a moment.</BubbleSurface>
        <BubbleSurface own>On my way. See you soon!</BubbleSurface>
      </section>
      <div className="review-grid">
        <CardSurface>
          <div className="review-stack settings-form">
            <SectionHeading>Controls</SectionHeading>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                setSent((n) => n + 1);
              }}
            >
              <label htmlFor="review-name">Display name</label>
              <Input id="review-name" defaultValue="Alex Rivera" className="h-11" />
              <label htmlFor="review-bio">About you</label>
              <Textarea id="review-bio" defaultValue="A little more space for your people." />
              <div className="review-actions">
                <Button>Default button</Button>
                <Button type="submit">Save changes</Button>
                <Button variant="outline" disabled>
                  Unavailable
                </Button>
              </div>
              <output aria-label="Submissions">{sent}</output>
            </form>
            <CodeInput value={code} onChange={setCode} invalid={false} />
            <InlineError>Choose a name before continuing.</InlineError>
            <Skeleton style={{ height: 12, width: "70%" }} />
          </div>
        </CardSurface>
        <div>
          <SectionHeading>People and preferences</SectionHeading>
          <CardSurface>
            <SettingsRow
              icon={<Bell />}
              label="Message notifications"
              subtitle="Keep up with your conversations"
              right={
                <Switch
                  aria-label="Message notifications"
                  checked={enabled}
                  onCheckedChange={setEnabled}
                />
              }
            />
            <SettingsRow
              icon={<Shield />}
              label="Privacy"
              subtitle="Choose what you share"
              onClick={() => setNotice("Privacy selected")}
            />
            <div className="review-stack">
              <div className="review-actions">
                <Avatar initials="AR" aria-label="Alex Rivera" />
                <Avatar
                  initials="JL"
                  size="lg"
                  gradient="linear-gradient(135deg, #0c4a6e, #0369a1)"
                />
                <Avatar initials="FP" src={photo} aria-label="Photo fallback" />
              </div>
              <Button
                variant="ghost"
                onClick={() =>
                  setPhoto(
                    "data:image/svg+xml," +
                      encodeURIComponent(
                        '<svg xmlns="http://www.w3.org/2000/svg" width="44" height="44"><rect width="44" height="44" fill="steelblue"/></svg>',
                      ),
                  )
                }
              >
                Replace photo
              </Button>
              <Separator />
              <div className="review-swatches">
                {["card", "popover", "bubble-self", "bubble-other", "sidebar", "primary"].map(
                  (token) => (
                    <div
                      key={token}
                      className={`review-swatch ${token === "bubble-self" ? "bubble-self" : ""}`}
                      data-token={token}
                      style={{
                        background: token === "bubble-self" ? undefined : `var(--${token})`,
                        color:
                          token === "bubble-self"
                            ? "var(--bubble-self-foreground)"
                            : token === "primary"
                              ? "var(--primary-foreground)"
                              : "var(--foreground)",
                      }}
                    >
                      {token}
                    </div>
                  ),
                )}
              </div>
            </div>
          </CardSurface>
        </div>
        <CardSurface>
          <div className="review-stack">
            <SectionHeading>Overlays and actions</SectionHeading>
            <Button onClick={() => setNative(true)}>Existing modal</Button>
            <Dialog>
              <DialogTrigger asChild>
                <Button variant="outline">New dialog</Button>
              </DialogTrigger>
              <DialogContent closeLabel="Dismiss dialog">
                <DialogHeader>
                  <DialogTitle>Start a conversation</DialogTitle>
                  <DialogDescription>Dialog primitive with focus restoration.</DialogDescription>
                </DialogHeader>
                <Input aria-label="Conversation name" />
                <Button>Dialog action</Button>
              </DialogContent>
            </Dialog>
            <Sheet>
              <SheetTrigger asChild>
                <Button variant="secondary">Preferences sheet</Button>
              </SheetTrigger>
              <SheetContent closeLabel="Dismiss preferences">
                <SheetHeader>
                  <SheetTitle>Preferences</SheetTitle>
                  <SheetDescription>Reference sheet with semantic colors.</SheetDescription>
                </SheetHeader>
                <SettingsRow
                  label="Messages"
                  right={<Switch aria-label="Sheet messages" defaultChecked />}
                />
              </SheetContent>
            </Sheet>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline">Profile popover</Button>
              </PopoverTrigger>
              <PopoverContent>Profile details</PopoverContent>
            </Popover>
            <HoverCard openDelay={0}>
              <HoverCardTrigger asChild>
                <a href="#member">Member details</a>
              </HoverCardTrigger>
              <HoverCardContent>Community member</HoverCardContent>
            </HoverCard>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline">Chat actions</Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent>
                <DropdownMenuItem onSelect={() => setNotice("Muted")}>Mute</DropdownMenuItem>
                <DropdownMenuItem disabled>Delete</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <p role="status">{notice}</p>
          </div>
        </CardSurface>
      </div>
      {native && (
        <Modal title="Existing modal" onClose={busy ? undefined : () => setNative(false)}>
          <label>
            <input type="checkbox" checked={busy} onChange={(e) => setBusy(e.target.checked)} />
            Prevent dismissal
          </label>
          <Button onClick={() => setNested(true)}>Nested modal</Button>
          <Button onClick={() => setNative(false)} disabled={busy}>
            Close existing
          </Button>
          {nested && (
            <Modal title="Nested modal" onClose={() => setNested(false)}>
              <Input aria-label="Nested field" />
              <Button onClick={() => setNested(false)}>Close nested</Button>
            </Modal>
          )}
        </Modal>
      )}
    </main>
  );
}

const root = document.getElementById("root");
if (!root) throw new Error("Foundation fixture root is missing");
createRoot(root).render(
  <StrictMode>
    <FoundationReview />
  </StrictMode>,
);
