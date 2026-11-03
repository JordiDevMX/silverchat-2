import { useRouter } from "@tanstack/react-router";
import { MessageCircle, ShieldCheck } from "lucide-react";
import type { PropsWithChildren } from "react";
import { Modal } from "@/components/ui/modal";

export { AppSkeleton } from "@/components/ui/app-skeleton";
export { CodeInput } from "@/components/ui/code-input";
export { InlineError } from "@/components/ui/inline-error";
export { Modal } from "@/components/ui/modal";

import { useAuth } from "@/lib/auth-provider";

export function Brand() {
  return (
    <a href="/" className="brand">
      <MessageCircle aria-hidden="true" size={28} strokeWidth={1.75} />
      SilverChat
    </a>
  );
}
export function AuthFrame({
  title,
  subtitle,
  children,
}: PropsWithChildren<{ title: string; subtitle?: string }>) {
  return (
    <div className="auth-shell">
      <header>
        <Brand />
      </header>
      <main id="main" className="auth-layout">
        <aside className="auth-aside">
          <ShieldCheck size={40} strokeWidth={1.75} aria-hidden="true" />
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
        <section className="auth-card">
          <h1>{title}</h1>
          {subtitle && <p className="subtitle">{subtitle}</p>}
          {children}
        </section>
      </main>
      <footer>Your conversations. Your space.</footer>
    </div>
  );
}
export function SessionExpiredModal() {
  const auth = useAuth();
  const router = useRouter();
  if (!auth.sessionExpired) return null;
  return (
    <Modal title="Your session has expired">
      <p>Please log in again to continue.</p>
      <button
        className="button primary"
        type="button"
        onClick={() => {
          window.location.assign(
            `/auth/login?${new URLSearchParams({ redirect: router.state.location.href })}`,
          );
        }}
      >
        Log in
      </button>
    </Modal>
  );
}
