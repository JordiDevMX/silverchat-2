import { useRouter, useSearch } from "@tanstack/react-router";
import { useState } from "react";
import { useMessageText } from "@/features/messages/i18n";
import { ChannelsSection } from "@/features/novedades/components/channels/ChannelsSection";
import { CreateChannelModal } from "@/features/novedades/components/channels/CreateChannelModal";
import { DiscoverChannelsSection } from "@/features/novedades/components/channels/DiscoverChannelsSection";
import { StoriesRow } from "@/features/novedades/components/stories/StoriesRow";
import { StoryCreator } from "@/features/novedades/components/stories/StoryCreator";
import { StoryViewer } from "@/features/novedades/components/stories/StoryViewer";
import { NavLink } from "@/features/settings/components/shared";
import "@/styles/novedades.css";
export function NovedadesPage() {
  const { say } = useMessageText();
  const router = useRouter();
  const search = useSearch({ from: "/_authenticated/novedades" });
  const [text, setText] = useState("");
  const [creator, setCreator] = useState(false);
  const [viewer, setViewer] = useState<string>();
  return (
    <main id="main" className="novedades-page">
      <header className="novedades-header">
        <p className="eyebrow">SILVERCHAT</p>
        <h1>{say("Updates", "Novedades")}</h1>
        <input
          type="search"
          aria-label={say("Search stories and channels", "Buscar historias y canales")}
          placeholder={say("Search stories and channels…", "Buscar historias y canales…")}
          value={text}
          onChange={(e) => setText(e.target.value)}
        />
      </header>
      <StoriesRow search={text} onOpen={setViewer} onCreate={() => setCreator(true)} />
      <ChannelsSection search={text} />
      <DiscoverChannelsSection search={text} />
      <footer className="novedades-bottom">
        <NavLink href="/novedades/explore" className="button secondary">
          {say("Explore more", "Explorar más")}
        </NavLink>
        <button
          type="button"
          className="button primary"
          onClick={() => void router.navigate({ to: "/novedades", search: { create: true } })}
        >
          {say("Create channel", "Crear canal")}
        </button>
      </footer>
      {creator && <StoryCreator onClose={() => setCreator(false)} />}{" "}
      {viewer && <StoryViewer userId={viewer} onClose={() => setViewer(undefined)} />}{" "}
      {search.create && (
        <CreateChannelModal
          onClose={() =>
            void router.navigate({ to: "/novedades", search: { create: undefined }, replace: true })
          }
        />
      )}
    </main>
  );
}
export function ExploreChannelsPage() {
  const { say } = useMessageText();
  return (
    <main id="main" className="novedades-page">
      <NavLink href="/novedades">← {say("Back", "Volver")}</NavLink>
      <h1>{say("Explore channels", "Explorar canales")}</h1>
      <DiscoverChannelsSection />
    </main>
  );
}
