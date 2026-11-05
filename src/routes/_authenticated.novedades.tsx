import { useRouter, useSearch } from "@tanstack/react-router";
import { Compass, Megaphone, Search } from "lucide-react";
import { useState } from "react";
import { BrandLockup } from "@/components/ui/brand-lockup";
import { Button } from "@/components/ui/button";
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
        <BrandLockup />
        <h1>{say("Updates", "Novedades")}</h1>
        <label className="novedades-search">
          <Search aria-hidden="true" size={18} />
          <input
            type="search"
            aria-label={say("Search stories and channels", "Buscar historias y canales")}
            placeholder={say("Search stories and channels…", "Buscar historias y canales…")}
            value={text}
            onChange={(e) => setText(e.target.value)}
          />
        </label>
      </header>
      <StoriesRow search={text} onOpen={setViewer} onCreate={() => setCreator(true)} />
      <ChannelsSection search={text} />
      <DiscoverChannelsSection search={text} />
      <footer className="novedades-bottom">
        <Button asChild variant="outline">
          <NavLink href="/novedades/explore">
            <Compass size={17} />
            {say("Explore more", "Explorar más")}
          </NavLink>
        </Button>
        <Button
          type="button"
          variant="neon-outline"
          onClick={() => void router.navigate({ to: "/novedades", search: { create: true } })}
        >
          <Megaphone size={17} />
          {say("Create channel", "Crear canal")}
        </Button>
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
      <Button asChild variant="ghost">
        <NavLink href="/novedades">← {say("Back", "Volver")}</NavLink>
      </Button>
      <h1>{say("Explore channels", "Explorar canales")}</h1>
      <DiscoverChannelsSection />
    </main>
  );
}
