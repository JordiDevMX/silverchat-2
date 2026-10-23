import { useParams } from "@tanstack/react-router";
import { ChannelInfoScreen } from "@/features/novedades/components/channels/ChannelInfoScreen";
import "@/styles/novedades.css";
export function ChannelPage() {
  const { channelId } = useParams({ from: "/_authenticated/channels/$channelId/info" });
  return <ChannelInfoScreen channelId={channelId} />;
}
