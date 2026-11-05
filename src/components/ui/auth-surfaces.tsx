import { ArrowRight, Fingerprint, MessageCircle, ShieldCheck } from "lucide-react";
import type { PropsWithChildren, ReactNode } from "react";
import { BrandMark } from "./brand-lockup";
import { Button } from "./button";
import { Card } from "./card";

export function PublicBrand({ href = "/" }: { href?: string }) {
  return (
    <a href={href} className="public-brand" aria-label="SilverChat home">
      <BrandMark />
      <span>
        Silver<span className="text-neon">Chat</span>
      </span>
    </a>
  );
}

export function AuthCard({
  title,
  subtitle,
  children,
  headingAs: Heading = "h1",
}: PropsWithChildren<{ title: string; subtitle?: string; headingAs?: "h1" | "h2" }>) {
  return (
    <Card className="auth-card auth-card-v2">
      <Heading>{title}</Heading>
      {subtitle && <p className="subtitle">{subtitle}</p>}
      {children}
    </Card>
  );
}

export function AuthSurface({
  title,
  subtitle,
  children,
}: PropsWithChildren<{ title: string; subtitle?: string }>) {
  return (
    <div className="auth-shell public-surface bg-ambient-glow">
      <header className="public-header">
        <PublicBrand />
      </header>
      <main id="main" className="auth-layout">
        <aside className="auth-aside public-aside">
          <ShieldCheck size={36} strokeWidth={1.5} aria-hidden="true" />
          <h2>
            A little more space
            <br />
            for your people.
          </h2>
          <p>
            Conversations that belong to you.
            <br />
            Start with your email. Stay for the connection.
          </p>
          <span>Privacy-first messaging</span>
        </aside>
        <AuthCard title={title} subtitle={subtitle}>
          {children}
        </AuthCard>
      </main>
      <footer>Your conversations. Your space.</footer>
    </div>
  );
}

export function LandingSurface({ preview = false }: { preview?: boolean }) {
  const Heading = preview ? "h2" : "h1";
  const Content = preview ? "div" : "main";
  return (
    <div className="landing public-surface bg-ambient-glow">
      <header className="public-header">
        <PublicBrand href={preview ? "#auth-gallery" : "/"} />
        <Button asChild variant="outline">
          <a href={preview ? "#auth-gallery" : "/auth/login"}>Log in</a>
        </Button>
      </header>
      <Content id={preview ? undefined : "main"} className="landing-main">
        <div className="landing-copy">
          <Fingerprint size={40} strokeWidth={1.5} aria-hidden="true" />
          <Heading>
            Good conversations
            <br />
            need their own space.
          </Heading>
          <p>
            SilverChat — Privacy-first messaging.
            <br />A place to catch up, share a moment, and feel closer to your people.
          </p>
          <div className="landing-actions">
            <Button asChild size="lg">
              <a href={preview ? "#auth-gallery" : "/auth/signup"}>
                Get started <ArrowRight size={18} aria-hidden="true" />
              </a>
            </Button>
            <Button asChild variant="ghost">
              <a href={preview ? "#auth-gallery" : "/auth/login"}>Log in</a>
            </Button>
          </div>
          <p className="quiet-note">Your email is all you need to begin.</p>
        </div>
        <div
          className="conversation-art public-conversation"
          role="img"
          aria-label="An illustration of a private conversation"
        >
          <MessageCircle size={40} strokeWidth={1.5} aria-hidden="true" />
          <div className="public-bubble">Got a minute?</div>
          <div className="public-bubble public-bubble-own">For you? Always.</div>
          <div className="public-bubble">Let’s catch up.</div>
          <span>A little closer, wherever you are.</span>
        </div>
      </Content>
      <footer>Made for the conversations that matter.</footer>
    </div>
  );
}

export function InfrastructureNotice({
  children,
  icon,
  role = "status",
}: PropsWithChildren<{ icon?: ReactNode; role?: "status" | "alert" }>) {
  return (
    <div className="infrastructure-notice" role={role}>
      {icon && <span aria-hidden="true">{icon}</span>}
      <div>{children}</div>
    </div>
  );
}
