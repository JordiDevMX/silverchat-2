import { ShieldCheck } from "lucide-react";
import { Controller } from "react-hook-form";
import { BackupCodesSurface } from "@/components/ui/backup-codes-surface";
import { Button } from "@/components/ui/button";
import { SettingsDialog } from "@/components/ui/settings-surfaces";
import { CodeInput, InlineError } from "@/features/auth/components";
import { SettingsPage } from "@/features/settings/components/presentation";
import { useSecuritySettings } from "@/features/settings/hooks/useSecuritySettings";
export function SecurityPage() {
  const {
    verifiedFactor,
    enrollment,
    action,
    setAction,
    codes,
    setCodes,
    saved,
    setSaved,
    busy,
    error,
    notice,
    setNotice,
    control,
    reset,
    errors,
    isSubmitting,
    begin,
    submit,
    download,
    copy,
  } = useSecuritySettings();
  return (
    <SettingsPage title="Security" description="Keep your account in your hands.">
      <div className="settings-card settings-card-body security-card">
        <div className="security-heading">
          <ShieldCheck size={28} strokeWidth={1.75} aria-hidden="true" />
          <h2>Two-factor authentication</h2>
        </div>
        {verifiedFactor ? (
          <>
            <p className="status-badge">✓ Enabled</p>
            <p>{verifiedFactor.friendly_name || "Authenticator app"}</p>
            <Button
              variant="outline"
              type="button"
              onClick={() => {
                reset();
                setAction("replace_backups");
              }}
            >
              Regenerate backup codes
            </Button>
            <Button
              variant="destructive"
              type="button"
              onClick={() => {
                reset();
                setAction("disable");
              }}
            >
              Disable 2FA
            </Button>
          </>
        ) : (
          <>
            <p>Add a code from your authenticator app when signing in.</p>
            <Button type="button" onClick={begin} disabled={busy}>
              {busy ? "Starting setup…" : "Enable 2FA"}
            </Button>
          </>
        )}
        <InlineError>{error}</InlineError>
        <p role="status">{notice}</p>
      </div>
      {action && (
        <SettingsDialog
          title={
            action === "enroll"
              ? "Set up your authenticator"
              : action === "disable"
                ? "Disable two-factor authentication?"
                : "Regenerate backup codes?"
          }
          onClose={() => setAction(null)}
          canClose={!isSubmitting}
        >
          {(close) => (
            <>
              {action === "enroll" && enrollment ? (
                <>
                  <p>Scan this code with your authenticator app, then enter the six-digit code.</p>
                  <img
                    className="qr-code"
                    src={
                      enrollment.totp.qr_code.startsWith("data:")
                        ? enrollment.totp.qr_code
                        : `data:image/svg+xml;utf8,${encodeURIComponent(enrollment.totp.qr_code)}`
                    }
                    alt="Authenticator enrollment QR code"
                  />
                  <p>Or enter this setup key:</p>
                  <code className="setup-key">{enrollment.totp.secret}</code>
                </>
              ) : (
                <p>
                  {action === "disable"
                    ? "This will remove 2FA from your account. Anyone with access to your email will be able to sign in."
                    : "This will invalidate all existing backup codes."}
                </p>
              )}
              <form onSubmit={submit} noValidate>
                <Controller
                  control={control}
                  name="code"
                  render={({ field }) => (
                    <CodeInput
                      value={field.value}
                      onChange={field.onChange}
                      invalid={!!errors.code}
                    />
                  )}
                />
                <InlineError>{errors.code?.message || errors.root?.message}</InlineError>
                <Button disabled={isSubmitting} type="submit">
                  {isSubmitting ? "Verifying…" : "Verify and continue"}
                </Button>
              </form>
              <Button variant="outline" type="button" disabled={isSubmitting} onClick={close}>
                Cancel
              </Button>
            </>
          )}
        </SettingsDialog>
      )}
      {codes.length > 0 && (
        <SettingsDialog title="Save your backup codes" onClose={() => {}} canClose={false}>
          {() => (
            <>
              <p className="settings-security-lock" role="note">
                Navigation stays locked until you confirm these codes are saved and select Done.
              </p>
              <p>
                Save these codes somewhere safe. You won’t see them again. Each code can be used
                once.
              </p>
              <BackupCodesSurface codes={codes} onDownload={download} onCopy={copy} />
              <p role="status">{notice}</p>
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  checked={saved}
                  onChange={(event) => setSaved(event.target.checked)}
                />
                I’ve saved these codes
              </label>
              <Button
                type="button"
                disabled={!saved}
                onClick={() => {
                  setCodes([]);
                  setNotice("Your account is protected with 2FA.");
                }}
              >
                Done
              </Button>
            </>
          )}
        </SettingsDialog>
      )}
    </SettingsPage>
  );
}
