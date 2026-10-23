import { useMessageText } from "@/features/messages/i18n";
import { QueryState } from "@/features/settings/components/shared";
import { useChannels } from "../../hooks/channels/useChannels";
import { ChannelListItem } from "./ChannelListItem";
export function ChannelsSection({ search = "" }: { search?: string }) {
  const q = useChannels();
  const { say } = useMessageText();
  const data = q.data?.filter((c) =>
    `${c.name} ${c.slug}`.toLowerCase().includes(search.toLowerCase()),
  );
  return (
    <section>
      <h2>{say("Channels", "Canales")}</h2>
      <QueryState loading={q.isPending} error={q.error} retry={() => void q.refetch()} />
      {data?.map((c) => (
        <ChannelListItem key={c.id} channel={c} />
      ))}
      {data?.length === 0 && (
        <p className="novedades-empty">
          {say(
            "No channels here yet. Discover one below.",
            "Aún no hay canales aquí. Descubre uno abajo.",
          )}
        </p>
      )}
    </section>
  );
}
