import { Button } from "@/components/ui/button";
import { ChatSettingsDialog } from "@/components/ui/chat-settings-surfaces";
import { PublicProfileSurface } from "@/components/ui/public-profile-surface";
import type { ChatDetails } from "@/features/messages/types";
import { Avatar, QueryState } from "@/features/settings/components/shared";
import { socialHref } from "@/lib/social-links";
import { useContactProfileActions } from "../hooks/useContactProfileActions";
export function ContactProfileModal({ userId, chat }: { userId: string; chat: ChatDetails }) {
  const {
    query,
    p,
    say,
    language,
    ui,
    action,
    user,
    gradient,
    links,
    last,
    active,
    sendMessage,
    viewFullProfile,
  } = useContactProfileActions(userId, chat);
  return (
    <ChatSettingsDialog
      title={say("Contact profile", "Perfil del contacto")}
      className="contact-profile-dialog"
      onClose={ui.close}
      canClose={!action.busy}
    >
      {(dismiss) => (
        <>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="contact-close"
            disabled={action.busy}
            aria-label={say("Close", "Cerrar")}
            onClick={dismiss}
          >
            ×
          </Button>
          <QueryState
            loading={query.isPending}
            error={query.error}
            retry={() => void query.refetch()}
          />
          {!query.isPending && !query.error && !p && (
            <p>{say("Profile unavailable", "Perfil no disponible")}</p>
          )}
          {p && (
            <PublicProfileSurface
              headingAs="h2"
              gradient={gradient.data}
              avatar={<Avatar profile={p} size="large" />}
              name={p.display_name ?? ""}
              username={p.username ?? ""}
              bio={p.bio}
            >
              <p>
                {last && (
                  <small>
                    {" "}
                    ·{" "}
                    {Date.now() - Date.parse(last) < 120000
                      ? say("Online", "En línea")
                      : `${say("Last seen", "Última conexión")} ${new Intl.DateTimeFormat(language, { dateStyle: "short", timeStyle: "short" }).format(new Date(last))}`}
                  </small>
                )}
              </p>
              <div className="social-pills">
                {links.map((link) => {
                  const href = socialHref(link.url);
                  return href ? (
                    <a
                      key={`${link.label}:${link.url}`}
                      href={href}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      {link.label || link.url}
                    </a>
                  ) : null;
                })}
              </div>
              <div className="contact-actions">
                <Button type="button" disabled={action.busy} onClick={() => void sendMessage()}>
                  {say("Message", "Mensaje")}
                </Button>
                {[say("Call", "Llamar"), say("Video", "Video")].map((label) => (
                  <Button
                    type="button"
                    variant="outline"
                    key={label}
                    disabled
                    title={
                      active
                        ? say("Calls coming soon", "Llamadas próximamente")
                        : say(
                            "Accept the chat request first",
                            "Acepta la solicitud del chat primero",
                          )
                    }
                  >
                    {label}
                  </Button>
                ))}
              </div>
              {userId !== user?.id && (
                <div className="contact-actions">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() =>
                      ui.open(chat.id, { kind: "block", userId, name: p.display_name ?? "" })
                    }
                  >
                    {say("Block", "Bloquear")}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() =>
                      ui.open(chat.id, { kind: "report", userId, name: p.display_name ?? "" })
                    }
                  >
                    {say("Report", "Reportar")}
                  </Button>
                </div>
              )}
              <Button type="button" variant="outline" onClick={viewFullProfile}>
                {say("View full profile →", "Ver perfil completo →")}
              </Button>
              {action.feedback}
            </PublicProfileSurface>
          )}
        </>
      )}
    </ChatSettingsDialog>
  );
}
