import { zodResolver } from "@hookform/resolvers/zod";
import { useBlocker } from "@tanstack/react-router";
import { Copy, Download, ShieldCheck } from "lucide-react";
import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { generateBackupCodes } from "@/features/auth/backup-codes";
import { AuthFrame, CodeInput, InlineError, Modal } from "@/features/auth/components";
import { totpSchema } from "@/features/auth/schemas";
import type { SessionPayload } from "@/features/auth/types";
import { refreshSession } from "@/lib/auth";
import { useAuth } from "@/lib/auth-provider";
import { supabase } from "@/lib/supabase";

type Action = "enroll" | "disable" | "replace_backups";
export function SecurityPage() {
  const auth = useAuth();
  const verifiedFactor = auth.user?.factors?.find(
    (factor) => factor.factor_type === "totp" && factor.status === "verified",
  );
  const [enrollment, setEnrollment] = useState<SessionPayload["enrollment"]>();
  const [action, setAction] = useState<Action | null>(null);
  const [codes, setCodes] = useState<string[]>([]);
  const [saved, setSaved] = useState(false);
  useBlocker({ shouldBlockFn: () => codes.length > 0, enableBeforeUnload: codes.length > 0 });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const {
    control,
    handleSubmit,
    reset,
    setError: setFormError,
    formState: { errors, isSubmitting },
  } = useForm({ resolver: zodResolver(totpSchema), defaultValues: { code: "" } });
  const begin = async () => {
    setBusy(true);
    setError("");
    try {
      const result = await refreshSession({ action: "enroll" });
      if (!result.enrollment) throw new Error();
      setEnrollment(result.enrollment);
      setAction("enroll");
      reset();
    } catch {
      setError("We couldn’t start setup. Please try again.");
    } finally {
      setBusy(false);
    }
  };
  const submit = handleSubmit(async ({ code }) => {
    const factorId = action === "enroll" ? enrollment?.id : verifiedFactor?.id;
    if (!factorId || !auth.user || !action) return;
    try {
      if (action === "enroll") {
        const result = await refreshSession({ totp_code: code, factor_id: factorId });
        if (result.aal !== "aal2") throw new Error();
        const generated = await generateBackupCodes();
        const inserted = await supabase
          .from("two_factor_backup_codes")
          .insert(
            generated.hashes.map((code_hash) => ({ user_id: auth.user?.id ?? "", code_hash })),
          );
        if (inserted.error) {
          // TOTP is already enabled; expose recovery through the regenerate flow.
          setAction(null);
          setEnrollment(undefined);
          setError(
            "2FA is enabled, but backup codes couldn’t be saved. Use Regenerate backup codes to try again.",
          );
          await auth.refreshUser();
          return;
        }
        setCodes(generated.codes);
        setSaved(false);
      } else if (action === "replace_backups") {
        const generated = await generateBackupCodes();
        await refreshSession({
          action,
          totp_code: code,
          factor_id: factorId,
          backup_hashes: generated.hashes,
        });
        setCodes(generated.codes);
        setSaved(false);
      } else {
        await refreshSession({ action, totp_code: code, factor_id: factorId });
        setNotice("Two-factor authentication is disabled.");
      }
      setAction(null);
      setEnrollment(undefined);
      reset();
      await auth.refreshUser();
    } catch {
      setFormError("root", {
        message: "We couldn’t complete that change. Check your code and try again.",
      });
    }
  });
  const download = () => {
    const url = URL.createObjectURL(
      new Blob(
        [
          `SilverChat backup codes\nKeep these private. Each code works once.\n\n${codes.join("\n")}\n`,
        ],
        { type: "text/plain" },
      ),
    );
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "silverchat-backup-codes.txt";
    anchor.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  return (
    <AuthFrame title="Security" subtitle="Keep your account in your hands.">
      <a href="/chats">Back to chats</a>
      <div className="security-heading">
        <ShieldCheck size={28} strokeWidth={1.75} aria-hidden="true" />
        <h2>Two-factor authentication</h2>
      </div>
      {verifiedFactor ? (
        <>
          <p className="status-badge">✓ Enabled</p>
          <p>{verifiedFactor.friendly_name || "Authenticator app"}</p>
          <button
            className="button secondary"
            type="button"
            onClick={() => {
              reset();
              setAction("replace_backups");
            }}
          >
            Regenerate backup codes
          </button>
          <button
            className="button danger"
            type="button"
            onClick={() => {
              reset();
              setAction("disable");
            }}
          >
            Disable 2FA
          </button>
        </>
      ) : (
        <>
          <p>Add a code from your authenticator app when signing in.</p>
          <button className="button primary" type="button" onClick={begin} disabled={busy}>
            {busy ? "Starting setup…" : "Enable 2FA"}
          </button>
        </>
      )}
      <InlineError>{error}</InlineError>
      <p role="status">{notice}</p>
      {action && (
        <Modal
          title={
            action === "enroll"
              ? "Set up your authenticator"
              : action === "disable"
                ? "Disable two-factor authentication?"
                : "Regenerate backup codes?"
          }
          onClose={isSubmitting ? undefined : () => setAction(null)}
        >
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
                <CodeInput value={field.value} onChange={field.onChange} invalid={!!errors.code} />
              )}
            />
            <InlineError>{errors.code?.message || errors.root?.message}</InlineError>
            <button className="button primary" disabled={isSubmitting} type="submit">
              {isSubmitting ? "Verifying…" : "Verify and continue"}
            </button>
          </form>
          <button
            className="button secondary"
            type="button"
            disabled={isSubmitting}
            onClick={() => setAction(null)}
          >
            Cancel
          </button>
        </Modal>
      )}
      {codes.length > 0 && (
        <Modal title="Save your backup codes">
          <p>
            Save these codes somewhere safe. You won’t see them again. Each code can be used once.
          </p>
          <div className="backup-grid">
            {codes.map((code) => (
              <code key={code}>{code}</code>
            ))}
          </div>
          <div className="button-row">
            <button className="button secondary" type="button" onClick={download}>
              <Download size={18} aria-hidden="true" /> Download .txt
            </button>
            <button
              className="button secondary"
              type="button"
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(codes.join("\n"));
                  setNotice("Codes copied.");
                } catch {
                  setNotice("Copy unavailable. Download the codes instead.");
                }
              }}
            >
              <Copy size={18} aria-hidden="true" /> Copy all
            </button>
          </div>
          <p role="status">{notice}</p>
          <label className="checkbox-label">
            <input
              type="checkbox"
              checked={saved}
              onChange={(event) => setSaved(event.target.checked)}
            />
            I’ve saved these codes
          </label>
          <button
            className="button primary"
            type="button"
            disabled={!saved}
            onClick={() => {
              setCodes([]);
              setNotice("Your account is protected with 2FA.");
            }}
          >
            Done
          </button>
        </Modal>
      )}
    </AuthFrame>
  );
}
