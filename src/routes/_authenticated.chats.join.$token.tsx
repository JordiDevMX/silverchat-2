import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useParams, useRouter } from "@tanstack/react-router";
import { ArrowLeft, Users } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { CardSurface } from "@/components/ui/settings-row";
import { useAuth } from "@/lib/auth-provider";
import { supabase } from "@/lib/supabase";

export function JoinGroupInvitePage() {
  const { token } = useParams({ strict: false }) as { token?: string };
  const router = useRouter();
  const { user } = useAuth();
  const cache = useQueryClient();
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const joinMutation = useMutation({
    mutationFn: async () => {
      if (!token) throw new Error("Invite token is missing.");
      const { data, error } = await supabase.rpc("join_group_via_invite", { p_token: token });
      if (error) throw error;
      return data;
    },
    onSuccess: async (result) => {
      const parsed =
        typeof result === "string"
          ? (() => {
              try {
                return JSON.parse(result) as { status?: string; chat_id?: string };
              } catch {
                return { chat_id: result, status: "joined" };
              }
            })()
          : (result as { status?: string; chat_id?: string } | null);
      if (user?.id) {
        void cache.invalidateQueries({ queryKey: ["chats", user.id] });
      }
      if (parsed?.status === "pending_approval") {
        setStatusMessage("Join request sent. An admin will review your request.");
        return;
      }
      if (parsed?.chat_id) {
        await router.navigate({ href: `/chats/${parsed.chat_id}` });
        return;
      }
      setStatusMessage("Group invite processed.");
    },
    onError: (err) => {
      setErrorMessage(
        err instanceof Error ? err.message : "This invite link is invalid or has been revoked.",
      );
    },
  });

  return (
    <main id="main" className="chats-page flex min-h-dvh items-center justify-center p-4">
      <CardSurface className="flex w-full max-w-md flex-col gap-4 p-6">
        <div className="flex items-center gap-3">
          <span className="flex h-11 w-11 items-center justify-center rounded-full bg-muted">
            <Users size={22} />
          </span>
          <div>
            <h1 className="text-lg font-semibold">Group invitation</h1>
            <p className="text-sm text-muted-foreground">
              Join this SilverChat group using the invite link.
            </p>
          </div>
        </div>

        {statusMessage && (
          <p role="status" className="rounded-md bg-muted px-3 py-2 text-sm">
            {statusMessage}
          </p>
        )}
        {errorMessage && (
          <p role="alert" className="text-sm text-destructive">
            {errorMessage}
          </p>
        )}

        <div className="flex flex-wrap justify-between gap-2 pt-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => void router.navigate({ href: "/chats" })}
          >
            <ArrowLeft size={16} />
            Back to chats
          </Button>
          {!statusMessage && (
            <Button
              type="button"
              disabled={joinMutation.isPending || !token}
              onClick={() => {
                setErrorMessage(null);
                joinMutation.mutate();
              }}
            >
              {joinMutation.isPending ? "Joining…" : "Join group"}
            </Button>
          )}
        </div>
      </CardSurface>
    </main>
  );
}
