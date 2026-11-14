import { ArrowRight, Fingerprint, MessageCircle, ShieldCheck } from "lucide-react";
import { Fragment, type PropsWithChildren, type ReactNode } from "react";
import { BrandMark } from "./brand-lockup";
import { Button } from "./button";
import { Card } from "./card";

/** Copy of the shared chrome around every public form. */
export type AuthSurfaceCopy = {
  brandLabel: string;
  asideTitle: string[];
  asideBody: string[];
  asideTagline: string;
  footer: string;
};

/** Copy of the public landing page. */
export type LandingSurfaceCopy = {
  brandLabel: string;
  logIn: string;
  heading: string[];
  body: string[];
  getStarted: string;
  startNote: string;
  artLabel: string;
  bubbles: string[];
  artCaption: string;
  footer: string;
};

function lines(items: string[]) {
  return items.map((line, index) => (
    <Fragment key={line}>
      {index > 0 && <br />}
      {line}
    </Fragment>
  ));
}

export function PublicBrand({
  href = "/",
  label = "SilverChat home",
}: {
  href?: string;
  label?: string;
}) {
  return (
    <a href={href} className="public-brand" aria-label={label}>
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
  copy,
  children,
}: PropsWithChildren<{ title: string; subtitle?: string; copy: AuthSurfaceCopy }>) {
  return (
    <div className="auth-shell public-surface bg-ambient-glow">
      <header className="public-header">
        <PublicBrand label={copy.brandLabel} />
      </header>
      <main id="main" className="auth-layout">
        <aside className="auth-aside public-aside">
          <ShieldCheck size={36} strokeWidth={1.5} aria-hidden="true" />
          <h2>{lines(copy.asideTitle)}</h2>
          <p>{lines(copy.asideBody)}</p>
          <span>{copy.asideTagline}</span>
        </aside>
        <AuthCard title={title} subtitle={subtitle}>
          {children}
        </AuthCard>
      </main>
      <footer>{copy.footer}</footer>
    </div>
  );
}

export function LandingSurface({
  copy,
  preview = false,
}: {
  copy: LandingSurfaceCopy;
  preview?: boolean;
}) {
  const Heading = preview ? "h2" : "h1";
  const Content = preview ? "div" : "main";
  return (
    <div className="landing public-surface bg-ambient-glow">
      <header className="public-header">
        <PublicBrand href={preview ? "#auth-gallery" : "/"} label={copy.brandLabel} />
        <Button asChild variant="outline">
          <a href={preview ? "#auth-gallery" : "/auth/login"}>{copy.logIn}</a>
        </Button>
      </header>
      <Content id={preview ? undefined : "main"} className="landing-main">
        <div className="landing-copy">
          <Fingerprint size={40} strokeWidth={1.5} aria-hidden="true" />
          <Heading>{lines(copy.heading)}</Heading>
          <p>{lines(copy.body)}</p>
          <div className="landing-actions">
            <Button asChild size="lg">
              <a href={preview ? "#auth-gallery" : "/auth/signup"}>
                {copy.getStarted} <ArrowRight size={18} aria-hidden="true" />
              </a>
            </Button>
            <Button asChild variant="ghost">
              <a href={preview ? "#auth-gallery" : "/auth/login"}>{copy.logIn}</a>
            </Button>
          </div>
          <p className="quiet-note">{copy.startNote}</p>
        </div>
        <div className="conversation-art public-conversation" role="img" aria-label={copy.artLabel}>
          <MessageCircle size={40} strokeWidth={1.5} aria-hidden="true" />
          {copy.bubbles.map((bubble, index) => (
            <div className={`public-bubble${index === 1 ? " public-bubble-own" : ""}`} key={bubble}>
              {bubble}
            </div>
          ))}
          <span>{copy.artCaption}</span>
        </div>
      </Content>
      <footer>{copy.footer}</footer>
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
