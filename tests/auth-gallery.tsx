import { Mail, ShieldCheck, WifiOff } from "lucide-react";
import { useState } from "react";
import { AuthCard, InfrastructureNotice, LandingSurface } from "../src/components/ui/auth-surfaces";
import { Button } from "../src/components/ui/button";
import { CodeInput } from "../src/components/ui/code-input";
import { InlineError } from "../src/components/ui/inline-error";
import { Input } from "../src/components/ui/input";
import { Modal } from "../src/components/ui/modal";
import { Skeleton } from "../src/components/ui/skeleton";

/** Local presentation samples only: no router, auth provider, CAPTCHA or remote requests. */
export function AuthGallery() {
  const [notice, setNotice] = useState("");
  const [code, setCode] = useState("");
  const [invalid, setInvalid] = useState(false);
  const [backup, setBackup] = useState(false);
  const [username, setUsername] = useState("");
  const [pending, setPending] = useState(false);
  const [expired, setExpired] = useState(false);
  const [theme, setTheme] = useState("system");
  const [accent, setAccent] = useState("blue");
  return (
    <section id="auth-gallery" className="auth-gallery" aria-labelledby="auth-gallery-title">
      <h2 id="auth-gallery-title">Auth, onboarding & infrastructure</h2>
      <p>
        Local previews only. Live sign-in, email delivery and account setup require the normal app
        backend.
      </p>
      <div className="auth-landing-preview">
        <LandingSurface preview />
      </div>
      <p role="status" className="auth-preview-notice">
        {notice}
      </p>
      <label className="checkbox-label">
        <input type="checkbox" checked={pending} onChange={(e) => setPending(e.target.checked)} />
        Preview pending request
      </label>
      <div className="auth-gallery-grid">
        {[false, true].map((signup) => (
          <AuthCard
            key={String(signup)}
            headingAs="h2"
            title={signup ? "Preview signup" : "Preview login"}
            subtitle="We’ll send you a magic link — no password needed."
          >
            <form
              onSubmit={(event) => {
                event.preventDefault();
                setNotice("Preview link sent. No email was sent.");
              }}
            >
              <label htmlFor={`preview-email-${signup}`}>Email address</label>
              <div className="input-with-icon">
                <Mail size={18} aria-hidden="true" />
                <Input
                  id={`preview-email-${signup}`}
                  type="email"
                  required
                  placeholder="you@example.test"
                />
              </div>
              {signup && (
                <InfrastructureNotice>
                  CAPTCHA remains required in the live signup flow.
                </InfrastructureNotice>
              )}
              <Button type="submit" disabled={pending}>
                {pending
                  ? "Sending preview…"
                  : signup
                    ? "Preview create account"
                    : "Preview send link"}
              </Button>
            </form>
          </AuthCard>
        ))}
        <AuthCard
          headingAs="h2"
          title="Preview two-factor authentication"
          subtitle={
            backup ? "Use a saved backup code." : "Enter the six digits from your authenticator."
          }
        >
          <ShieldCheck className="feature-icon" aria-hidden="true" />
          {backup ? (
            <>
              <label htmlFor="preview-backup">Backup code</label>
              <Input id="preview-backup" maxLength={10} autoComplete="off" />
            </>
          ) : (
            <CodeInput value={code} onChange={setCode} invalid={invalid} />
          )}
          <InlineError>
            {invalid ? "Preview: that code couldn’t be verified. Try again." : null}
          </InlineError>
          <Button disabled={pending} onClick={() => setNotice("Preview code accepted locally.")}>
            Preview verify
          </Button>
          <Button variant="outline" onClick={() => setInvalid(!invalid)}>
            Toggle code error
          </Button>
          <Button
            variant="ghost"
            disabled={pending}
            onClick={() => {
              setBackup(!backup);
              setCode("");
            }}
          >
            {backup ? "Preview use authenticator" : "Preview use backup code"}
          </Button>
        </AuthCard>
        <AuthCard headingAs="h2" title="Preview check email">
          <Mail className="feature-icon" aria-hidden="true" />
          <p>Check your inbox for the magic link. Open it in the same browser.</p>
          <Button disabled>Resend in 60s</Button>
          <p className="quiet-note">The live cooldown remains 60 seconds.</p>
        </AuthCard>
        <AuthCard headingAs="h2" title="Preview expired link">
          <InfrastructureNotice role="alert">
            This link has expired. Request a new magic link to continue.
          </InfrastructureNotice>
          <Button onClick={() => setNotice("Preview recovery selected.")}>
            Preview request new link
          </Button>
        </AuthCard>
        <AuthCard
          headingAs="h2"
          title="Preview pick username"
          subtitle="This is how others will find you."
        >
          <label htmlFor="preview-username">Preview username</label>
          <div className="input-with-icon">
            <span aria-hidden="true">@</span>
            <Input
              id="preview-username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
            />
          </div>
          <p className="quiet-note">Your handle: @{username || "your_name"}</p>
          <Button
            disabled={pending}
            onClick={() => setNotice("Preview username selected. No profile was saved.")}
          >
            Preview continue
          </Button>
        </AuthCard>
        <AuthCard
          headingAs="h2"
          title="Preview welcome"
          subtitle="Make this space feel like yours."
        >
          <label htmlFor="preview-welcome-theme">Preview appearance</label>
          <select
            id="preview-welcome-theme"
            value={theme}
            onChange={(e) => setTheme(e.target.value)}
          >
            <option value="system">System</option>
            <option value="light">Light</option>
            <option value="dark">Dark</option>
          </select>
          <fieldset className="accent-options">
            <legend>Preview accent preference</legend>
            {["blue", "purple", "red", "orange", "yellow", "green"].map((value) => (
              <Button
                key={value}
                variant={accent === value ? "default" : "outline"}
                aria-pressed={accent === value}
                className="accent-choice"
                onClick={() => setAccent(value)}
              >
                {value}
              </Button>
            ))}
          </fieldset>
          <Button
            disabled={pending}
            onClick={() =>
              setNotice(`Preview preferences: ${theme}, ${accent}. Nothing persisted.`)
            }
          >
            Preview get started
          </Button>
          <Button
            variant="ghost"
            disabled={pending}
            onClick={() => setNotice("Preview preferences skipped.")}
          >
            Preview skip
          </Button>
        </AuthCard>
        <AuthCard headingAs="h2" title="Preview infrastructure states">
          <InfrastructureNotice role="alert" icon={<WifiOff size={18} />}>
            Connection issues — some content may be unavailable. Retrying…
          </InfrastructureNotice>
          <div role="status" aria-busy="true">
            Opening your space…
            <Skeleton className="h-4 w-full mt-3" />
          </div>
          <InfrastructureNotice>
            This profile is unavailable or hidden by privacy settings.
          </InfrastructureNotice>
          <Button variant="outline" onClick={() => setNotice("Preview retry selected.")}>
            Preview retry
          </Button>
          <Button variant="outline" onClick={() => setExpired(true)}>
            Preview session expired
          </Button>
        </AuthCard>
        <AuthCard headingAs="h2" title="Preview page not found">
          <p>This page could not be found.</p>
          <Button onClick={() => setNotice("Preview home selected.")}>Preview return home</Button>
        </AuthCard>
        <AuthCard
          headingAs="h2"
          title="Preview account destination"
          subtitle="Your SilverChat account is ready."
        >
          <p>Calls and the profile destination retain their existing placeholder behavior.</p>
          <Button onClick={() => setNotice("Preview settings selected.")}>Preview settings</Button>
          <Button
            variant="outline"
            disabled={pending}
            onClick={() => setNotice("Preview sign out selected. No session exists here.")}
          >
            Preview sign out
          </Button>
        </AuthCard>
      </div>
      {expired && (
        <Modal title="Preview session has expired" className="session-expired-dialog">
          <p>Please log in again to continue.</p>
          <Button onClick={() => setExpired(false)}>Preview return to login</Button>
        </Modal>
      )}
    </section>
  );
}
