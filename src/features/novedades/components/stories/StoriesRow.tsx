import { useMessageText } from "@/features/messages/i18n";
import { useAuth } from "@/lib/auth-provider";
import { useStories } from "../../hooks/stories/useStories";
import { orderStoryGroups } from "../../lib/storyOrdering";
import { StoryCard } from "./StoryCard";
export function StoriesRow({
  onOpen,
  onCreate,
  search = "",
}: {
  onOpen: (userId: string) => void;
  onCreate: () => void;
  search?: string;
}) {
  const query = useStories();
  const { user } = useAuth();
  const { say } = useMessageText();
  const { mine, unwatched, watched } = orderStoryGroups(query.data ?? [], user?.id ?? "");
  return (
    <section aria-label={say("Stories", "Historias")}>
      <div className="stories-row">
        <StoryCard mine group={mine} onCreate={onCreate} onOpen={() => onOpen(user?.id ?? "")} />
        {[...unwatched, ...watched]
          .filter((g) =>
            `${g.profile?.display_name} ${g.profile?.username}`
              .toLowerCase()
              .includes(search.toLowerCase()),
          )
          .map((g) => (
            <StoryCard key={g.user_id} group={g} onOpen={() => onOpen(g.user_id)} />
          ))}
      </div>
      {query.isPending && <p role="status">{say("Loading stories…", "Cargando historias…")}</p>}
      {query.isError && (
        <button type="button" onClick={() => void query.refetch()}>
          {say("Retry stories", "Reintentar historias")}
        </button>
      )}
    </section>
  );
}
