import { ChevronDown, ChevronUp, X } from "lucide-react";
import { useEffect, useRef } from "react";
import type { useInChatSearch } from "../hooks/useInChatSearch";
import { useMessageText } from "../i18n";
export function InChatSearch({
  search,
  onClose,
}: {
  search: ReturnType<typeof useInChatSearch>;
  onClose: () => void;
}) {
  const { say } = useMessageText();
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => {
    input.current?.focus();
  }, []);
  return (
    <header className="in-chat-search glass-surface">
      <div>
        <input
          type="search"
          ref={input}
          aria-label={say("Search in conversation", "Buscar en conversación")}
          placeholder={say("Search messages…", "Buscar mensajes…")}
          value={search.text}
          onChange={(e) => search.setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Escape") onClose();
            if (e.key === "Enter") search.move(e.shiftKey ? -1 : 1);
          }}
        />
        <span role="status">
          {search.results.length
            ? `${search.index + 1}/${search.results.length}`
            : say("No results", "Sin resultados")}
        </span>
        <button
          type="button"
          className="message-icon"
          aria-label={say("Previous result", "Resultado anterior")}
          disabled={!search.results.length}
          onClick={() => search.move(-1)}
        >
          <ChevronUp />
        </button>
        <button
          type="button"
          className="message-icon"
          aria-label={say("Next result", "Resultado siguiente")}
          disabled={!search.results.length}
          onClick={() => search.move(1)}
        >
          <ChevronDown />
        </button>
        <button
          type="button"
          className="message-icon"
          aria-label={say("Close search", "Cerrar búsqueda")}
          onClick={onClose}
        >
          <X />
        </button>
      </div>
      <small>
        {say(
          "Search covers loaded messages only. Scroll up to load more.",
          "La búsqueda incluye solo mensajes cargados. Desplázate arriba para cargar más.",
        )}
      </small>
    </header>
  );
}
