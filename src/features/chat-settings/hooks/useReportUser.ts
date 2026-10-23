import { useMutation } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth-provider";
import { supabase } from "@/lib/supabase";
import { validReport } from "../lib/chatActions";
export type ReportReason = "spam" | "harassment" | "inappropriate" | "other";
export function useReportUser() {
  const { user } = useAuth();
  return useMutation({
    mutationFn: async ({
      userId,
      reason,
      description,
    }: {
      userId: string;
      reason: ReportReason;
      description: string;
    }) => {
      if (!validReport(reason, description)) throw new Error("Check the report details");
      const result = await supabase.from("reports").insert({
        reporter_id: user?.id ?? "",
        reported_user_id: userId,
        reason,
        description: description.trim() || null,
      });
      if (result.error) throw result.error;
    },
  });
}
