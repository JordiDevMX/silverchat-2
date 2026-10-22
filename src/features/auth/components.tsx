import { useRouter } from "@tanstack/react-router";
import { MessageCircle, ShieldCheck } from "lucide-react";
import { type PropsWithChildren, useEffect, useRef } from "react";
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
export function AppSkeleton({ text = "Opening your space…" }: { text?: string }) {
  return (
    <main className="app-skeleton" aria-busy="true" aria-label={text}>
      <p role="status">{text}</p>
      <div className="skeleton-grid" aria-hidden="true">
        <div>
          <div className="skeleton h-12 mb-8" />
          {[1, 2, 3, 4, 5].map((n) => (
            <div className="skeleton h-16 mb-4" key={n} />
          ))}
        </div>
        <div className="skeleton min-h-96" />
      </div>
    </main>
  );
}
export function InlineError({ children }: PropsWithChildren) {
  return children ? (
    <p role="alert" className="form-error">
      {children}
    </p>
  ) : null;
}
export function Modal({
  title,
  children,
  onClose,
}: PropsWithChildren<{ title: string; onClose?: () => void }>) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = ref.current;
    dialog?.showModal();
    return () => dialog?.close();
  }, []);
  return (
    <dialog
      ref={ref}
      aria-label={title}
      onCancel={(event) => {
        event.preventDefault();
        onClose?.();
      }}
      className="auth-modal"
    >
      <h2>{title}</h2>
      {children}
    </dialog>
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
export function CodeInput({
  value,
  onChange,
  invalid = false,
}: {
  value: string;
  onChange: (value: string) => void;
  invalid?: boolean;
}) {
  const refs = useRef<(HTMLInputElement | null)[]>([]);
  const positions = [0, 1, 2, 3, 4, 5];
  return (
    <fieldset className="code-field">
      <legend>Authenticator code</legend>
      <div className="code-inputs">
        {positions.map((index) => (
          <input
            key={index}
            ref={(input) => {
              refs.current[index] = input;
            }}
            aria-label={`Digit ${index + 1}`}
            aria-invalid={invalid}
            inputMode="numeric"
            autoComplete={index === 0 ? "one-time-code" : "off"}
            value={value[index] ?? ""}
            maxLength={6}
            onChange={(event) => {
              const digits = event.target.value.replace(/\D/g, "");
              if (digits.length > 1) {
                onChange(digits.slice(0, 6));
                refs.current[Math.min(digits.length, 5)]?.focus();
                return;
              }
              const next = value.split("");
              next[index] = digits;
              onChange(next.join(""));
              if (digits) refs.current[index + 1]?.focus();
            }}
            onKeyDown={(event) => {
              if (event.key === "Backspace" && !value[index]) refs.current[index - 1]?.focus();
            }}
            onPaste={(event) => {
              event.preventDefault();
              const digits = event.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6);
              onChange(digits);
              refs.current[Math.min(digits.length, 5)]?.focus();
            }}
          />
        ))}
      </div>
    </fieldset>
  );
}
