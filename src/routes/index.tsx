import { useRouter } from "@tanstack/react-router";
import { ArrowRight, Fingerprint, MessageCircle } from "lucide-react";
import { useEffect } from "react";
import { Brand } from "@/features/auth/components";
import { nextDestination } from "@/features/auth/navigation";
import { useAuth } from "@/lib/auth-provider";
export function LandingPage() {
  const auth = useAuth();
  const router = useRouter();
  useEffect(() => {
    if (auth.user)
      void router.navigate({
        href: auth.mfaRequired
          ? "/auth/2fa-verify"
          : nextDestination(auth.profile?.username, "/chats"),
        replace: true,
      });
  }, [auth.user, auth.mfaRequired, auth.profile?.username, router]);
  return (
    <div className="landing">
      <header>
        <Brand />
        <a className="button secondary" href="/auth/login">
          Log in
        </a>
      </header>
      <main id="main" className="landing-main">
        <div className="landing-copy">
          <Fingerprint size={40} strokeWidth={1.75} aria-hidden="true" />
          <h1>
            Good conversations
            <br />
            need their own space.
          </h1>
          <p>
            SilverChat — Privacy-first messaging.
            <br />A place to catch up, share a moment, and feel closer to your people.
          </p>
          <div className="landing-actions">
            <a className="button primary" href="/auth/signup">
              Get started <ArrowRight size={18} aria-hidden="true" />
            </a>
            <a className="text-link" href="/auth/login">
              Log in
            </a>
          </div>
          <p className="quiet-note">Your email is all you need to begin.</p>
        </div>
        <div
          className="conversation-art"
          role="img"
          aria-label="An illustration of a private conversation"
        >
          <MessageCircle size={56} strokeWidth={1.25} aria-hidden="true" />
          <div className="sample-message other">Got a minute?</div>
          <div className="sample-message self">For you? Always.</div>
          <div className="sample-message other">Let’s catch up.</div>
          <span>A little closer, wherever you are.</span>
        </div>
      </main>
      <footer>Made for the conversations that matter.</footer>
    </div>
  );
}
