import { BadgeCheck } from "lucide-react";
import { useMessageText } from "@/features/messages/i18n";
import { Avatar, NavLink, QueryState } from "@/features/settings/components/shared";
import { useDiscoverChannels } from "../../hooks/channels/useDiscoverChannels";
import { useFollowChannel } from "../../hooks/channels/useFollowChannel";
export function DiscoverChannelsSection({ search = "" }: { search?: string }) {
  const q = useDiscoverChannels();
  const follow = useFollowChannel();
  const { say } = useMessageText();
  const data = q.data?.filter((c) =>
    `${c.name} ${c.slug}`.toLowerCase().includes(search.toLowerCase()),
  );
  return (
    <section>
      <h2>{say("Find channels to follow", "Encuentra canales para seguir")}</h2>
      <QueryState loading={q.isPending} error={q.error} retry={() => void q.refetch()} />
      {follow.isError && (
        <p role="alert">{say("Unable to follow. Try again.", "No se pudo seguir. Reinténtalo.")}</p>
      )}
      {data?.map((c) => (
        <div className="discover-channel" key={c.id}>
          <NavLink href={`/channels/${c.id}`} className="channel-discovery-link">
            <Avatar
              profile={{ id: c.id, display_name: c.name, avatar_url: c.avatar_url }}
              size="small"
            />
            <span>
              <strong>
                {c.name}
                {c.is_verified && (
                  <BadgeCheck size={16} aria-label={say("Verified", "Verificado")} />
                )}
              </strong>
              <small>
                {c.follower_count} {say("followers", "seguidores")}
              </small>
              <p>{c.description}</p>
            </span>
          </NavLink>
          <button
            type="button"
            className="button secondary"
            disabled={follow.isPending}
            onClick={() => follow.mutate(c.id)}
          >
            {say("Follow", "Seguir")}
          </button>
        </div>
      ))}
      {data?.length === 0 && (
        <p className="novedades-empty">
          {say("No more channels to discover.", "No hay más canales por descubrir.")}
        </p>
      )}
    </section>
  );
}
