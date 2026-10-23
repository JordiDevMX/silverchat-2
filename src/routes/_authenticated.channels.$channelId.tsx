import { useParams } from "@tanstack/react-router";
import { ChannelView } from "@/features/novedades/components/channels/ChannelView";
import "@/styles/novedades.css";
export function ChannelPage() {
  const { channelId } = useParams({ from: "/_authenticated/channels/$channelId" });
  return <ChannelView channelId={channelId} />;
}
