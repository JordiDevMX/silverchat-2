import { zodResolver } from "@hookform/resolvers/zod";
import { useBlocker } from "@tanstack/react-router";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { generateBackupCodes } from "@/features/auth/backup-codes";
import { totpSchema } from "@/features/auth/schemas";
import type { SessionPayload } from "@/features/auth/types";
import { refreshSession } from "@/lib/auth";
import { useAuth } from "@/lib/auth-provider";
import { supabase } from "@/lib/supabase";

type Action = "enroll" | "disable" | "replace_backups";
export function useSecuritySettings() {
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

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(codes.join("\n"));
      setNotice("Codes copied.");
    } catch {
      setNotice("Copy unavailable. Download the codes instead.");
    }
  };

  return {
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
  };
}
