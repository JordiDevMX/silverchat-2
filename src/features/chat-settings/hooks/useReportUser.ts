import { useMutation, useQueryClient } from "@tanstack/react-query";
import { refreshNovedades } from "@/features/novedades/lib/cache";
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

export type ReportSubmissionResult = {
  blocked: boolean;
  blockFailed: boolean;
  unfollowed: boolean;
  unfollowFailed: boolean;
};

export function useSubmitReport() {
  const { user } = useAuth();
  const cache = useQueryClient();
  return useMutation({
    mutationFn: async ({
      target,
      reason,
      description,
      alsoBlock,
      alsoUnfollow,
    }: {
      target: ReportTarget;
      reason: ReportReason;
      description: string;
      alsoBlock: boolean;
      alsoUnfollow: boolean;
    }): Promise<ReportSubmissionResult> => {
      if (!user || !validReport(reason, description)) throw new Error("Check the report details");
      const result = await supabase
        .from("reports")
        .insert(buildReportPayload(user.id, target, reason, description));
      if (result.error) throw result.error;

      let unfollowed = false;
      let unfollowFailed = false;
      if (alsoUnfollow && target.kind === "channel" && target.following) {
        try {
          const r = await supabase.rpc("unfollow_channel", { p_channel_id: target.channelId });
          if (r.error) throw r.error;
          await refreshNovedades(cache, user.id);
          unfollowed = true;
        } catch {
          unfollowFailed = true;
        }
      }

      let blocked = false;
      let blockFailed = false;
      if (alsoBlock && target.blockUserId && target.blockUserId !== user.id) {
        try {
          await blockUser(target.blockUserId, user.id);
          await Promise.all(
            ["blocked", "contacts", "public-profile", "avatar-url", "chats"].map((key) =>
              cache.invalidateQueries({ queryKey: [key] }),
            ),
          );
          blocked = true;
        } catch {
          blockFailed = true;
        }
      }

      return { blocked, blockFailed, unfollowed, unfollowFailed };
    },
  });
}
