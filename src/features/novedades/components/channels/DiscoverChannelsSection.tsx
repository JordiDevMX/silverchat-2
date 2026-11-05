import { ChannelFollowButton, ChannelRowContent } from "@/components/ui/channel-surfaces";
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
    <section className="channels-section">
      <h2>{say("Find channels to follow", "Encuentra canales para seguir")}</h2>
      <QueryState loading={q.isPending} error={q.error} retry={() => void q.refetch()} />
      {follow.isError && (
        <p role="alert">{say("Unable to follow. Try again.", "No se pudo seguir. Reinténtalo.")}</p>
      )}
      {data?.map((c) => (
        <div className="discover-channel channel-row-reveal" key={c.id}>
          <NavLink href={`/channels/${c.id}`} className="channel-discovery-link">
            <ChannelRowContent
              avatar={
                <Avatar
                  profile={{ id: c.id, display_name: c.name, avatar_url: c.avatar_url }}
                  size="small"
                />
              }
              name={c.name}
              verified={c.is_verified}
              verifiedLabel={say("Verified", "Verificado")}
              detail={
                <>
                  {c.follower_count} {say("followers", "seguidores")}
                </>
              }
              description={c.description}
            />
          </NavLink>
          <ChannelFollowButton
            busy={follow.isPending}
            label={say("Follow", "Seguir")}
            onClick={() => follow.mutate(c.id)}
          />
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
