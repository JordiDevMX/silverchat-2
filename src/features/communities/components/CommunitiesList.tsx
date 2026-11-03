import { Users } from "lucide-react";
import { useState } from "react";
import { FloatingActionButton } from "@/components/ui/floating-action-button";
import { useMessageText } from "@/features/messages/i18n";
import { QueryState } from "@/features/settings/components/shared";
import { useCommunities } from "../hooks/useCommunities";
import { CommunityCard } from "./CommunityCard";
import { CreateCommunityModal } from "./CreateCommunityModal";
export function CommunitiesList() {
  const query = useCommunities();
  const { say } = useMessageText();
  const [search, setSearch] = useState("");
  const [create, setCreate] = useState(false);
  const visible =
    query.data?.filter((c) =>
      c.name.toLocaleLowerCase().includes(search.toLocaleLowerCase().trim()),
    ) ?? [];
  return (
    <main id="main" className="mx-auto w-full max-w-4xl space-y-5 p-4 pb-28 lg:p-8">
      <h1 className="text-2xl font-semibold">{say("Communities", "Comunidades")}</h1>
      <input
        type="search"
        className="input w-full"
        aria-label={say("Search communities", "Buscar comunidades")}
        placeholder={say("Search communities…", "Buscar comunidades…")}
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />
      <h2 className="text-sm text-muted-foreground">
        {say(
          `Your communities (${query.data?.length ?? 0})`,
          `Tus comunidades (${query.data?.length ?? 0})`,
        )}
      </h2>
      <QueryState
        loading={query.isPending}
        error={query.error}
        retry={() => void query.refetch()}
      />
      {query.isSuccess && !visible.length && (
        <div className="space-y-3 py-12 text-center text-muted-foreground">
          <Users className="mx-auto" size={40} />
          <p>
            {query.data?.length
              ? say("No matching communities.", "No hay comunidades que coincidan.")
              : say(
                  "You're not in any communities yet. Ask a friend for an invite or create one.",
                  "Aún no estás en ninguna comunidad. Pide a un amigo que te añada o crea una.",
                )}
          </p>
        </div>
      )}
      <div className="space-y-4">
        {visible.map((community) => (
          <CommunityCard key={community.id} community={community} />
        ))}
      </div>
      <FloatingActionButton
        kind="communities"
        className="new-chat-fab"
        type="button"
        aria-label={say("New community", "Nueva comunidad")}
        onClick={() => setCreate(true)}
      />
      {create && <CreateCommunityModal onClose={() => setCreate(false)} />}
    </main>
  );
}
