import { useMutation, useQueryClient } from "@tanstack/react-query";
import { blockUser } from "@/features/settings/hooks";
import { useAuth } from "@/lib/auth-provider";
import { supabase } from "@/lib/supabase";
import {
  buildReportPayload,
  type ReportReason,
  type ReportTarget,
  validReport,
} from "../lib/chatActions";

export type { ReportReason, ReportTarget };

export function useSubmitReport() {
  const { user } = useAuth();
  const cache = useQueryClient();
  return useMutation({
    mutationFn: async ({
      target,
      reason,
      description,
      alsoBlock,
    }: {
      target: ReportTarget;
      reason: ReportReason;
      description: string;
      alsoBlock: boolean;
    }): Promise<{ blocked: boolean; blockFailed: boolean }> => {
      if (!user || !validReport(reason, description)) throw new Error("Check the report details");
      const result = await supabase
        .from("reports")
        .insert(buildReportPayload(user.id, target, reason, description));
      if (result.error) throw result.error;

      if (!alsoBlock || !target.blockUserId || target.blockUserId === user.id) {
        return { blocked: false, blockFailed: false };
      }

      try {
        await blockUser(target.blockUserId, user.id);
        await Promise.all(
          ["blocked", "contacts", "public-profile", "avatar-url", "chats"].map((key) =>
            cache.invalidateQueries({ queryKey: [key] }),
          ),
        );
        return { blocked: true, blockFailed: false };
      } catch {
        return { blocked: false, blockFailed: true };
      }
    },
  });
}
