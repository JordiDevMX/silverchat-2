import { useState } from "react";
import type { useGroupMembers } from "./useGroupMembers";
export function useMemberConfirmation(run: ReturnType<typeof useGroupMembers>["run"]) {
  const [confirm, setConfirm] = useState<{
    action: "promote" | "demote" | "remove";
    userId: string;
    name: string;
  }>();
  const [error, setError] = useState(false);

  const apply = async () => {
    if (!confirm) return;
    try {
      await run(confirm);
      setConfirm(undefined);
    } catch {
      setError(true);
    }
  };
  return { confirm, setConfirm, error, setError, apply };
}
