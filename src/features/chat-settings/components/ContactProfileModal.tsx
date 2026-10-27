import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "@tanstack/react-router";
import { Modal } from "@/features/auth/components";
import { formatDirectChatError } from "@/features/chats/hooks/useCreateDirectChat";
import { useMessageText } from "@/features/messages/i18n";
import type { ChatDetails } from "@/features/messages/types";
import {
  Avatar,
  QueryState,
  useAction,
  useAvatarGradient,
} from "@/features/settings/components/shared";
import { useAuth } from "@/lib/auth-provider";
import { FIXED_PLATFORMS, normalizeSocialLinks, socialHref } from "@/lib/social-links";
import { supabase } from "@/lib/supabase";
import { useContactProfile } from "../hooks/useContactProfile";
import { useChatUIStore } from "../stores/uiStore";
export function ContactProfileModal({ userId, chat }: { userId: string; chat: ChatDetails }) {
  const query = useContactProfile(userId);
  const queryClient = useQueryClient();
  const p = query.data?.profile;
  const { say, language } = useMessageText();
  const ui = useChatUIStore();
  const router = useRouter();
  const action = useAction();
  const { user } = useAuth();
  const gradient = useAvatarGradient(userId);
  const social = normalizeSocialLinks(p?.social_links);
  const links = [
    ...FIXED_PLATFORMS.flatMap((platform) =>
      social[platform.key] ? [{ label: platform.label, url: social[platform.key] ?? "" }] : [],
    ),
    ...(social.custom ?? []),
  ];
  const last = p?.last_seen_at;
  const active =
    (chat.type === "direct" && chat.otherUserId === userId
      ? chat.status
      : query.data?.chat?.status) === "active";
  return (
    <Modal
      title={say("Contact profile", "Perfil del contacto")}
      className="chat-settings-modal contact-modal"
      onClose={action.busy ? undefined : ui.close}
    >
      <button
        type="button"
        className="modal-close message-icon"
        aria-label={say("Close", "Cerrar")}
        onClick={ui.close}
      >
        ×
      </button>
      <QueryState
        loading={query.isPending}
        error={query.error}
        retry={() => void query.refetch()}
      />
      {!query.isPending && !query.error && !p && (
        <p>{say("Profile unavailable", "Perfil no disponible")}</p>
      )}
      {p && (
        <>
          <div className="contact-banner" style={{ background: gradient.data }} />
          <Avatar profile={p} size="large" />
          <h2>{p.display_name}</h2>
          <p>
            @{p.username}
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
          {p.bio && <p className="contact-bio">{p.bio}</p>}
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
            <button
              type="button"
              className="button primary"
              disabled={action.busy}
              onClick={() =>
                void action.run(async () => {
                  const existingChat =
                    chat.type === "direct" && chat.otherUserId === userId
                      ? { id: chat.id, status: chat.status }
                      : query.data?.chat;
                  let id =
                    existingChat?.status === "active" || existingChat?.status === "pending_request"
                      ? existingChat.id
                      : undefined;
                  if (!id) {
                    const result =
                      userId === user?.id
                        ? await supabase.rpc("create_self_chat")
                        : await supabase.rpc("create_direct_chat_request", {
                            p_target_user_id: userId,
                            p_initial_content: "👋",
                          });
                    if (result.error) {
                      throw new Error(formatDirectChatError(result.error, language));
                    }
                    id = result.data;
                    await Promise.all([
                      queryClient.invalidateQueries({ queryKey: ["chats"] }),
                      queryClient.invalidateQueries({ queryKey: ["direct-contacts"] }),
                      queryClient.invalidateQueries({ queryKey: ["contacts"] }),
                      queryClient.invalidateQueries({ queryKey: ["message-requests"] }),
                      queryClient.invalidateQueries({ queryKey: ["contact-profile"] }),
                    ]);
                  }
                  ui.close();
                  await router.navigate({ href: `/chats/${id}` });
                })
              }
            >
              {say("Message", "Mensaje")}
            </button>
            {[say("Call", "Llamar"), say("Video", "Video")].map((label) => (
              <button
                type="button"
                className="button secondary"
                key={label}
                disabled
                title={
                  active
                    ? say("Calls coming soon", "Llamadas próximamente")
                    : say("Accept the chat request first", "Acepta la solicitud del chat primero")
                }
              >
                {label}
              </button>
            ))}
          </div>
          {userId !== user?.id && (
            <div className="contact-actions">
              <button
                type="button"
                className="button secondary"
                onClick={() =>
                  ui.open(chat.id, { kind: "block", userId, name: p.display_name ?? "" })
                }
              >
                {say("Block", "Bloquear")}
              </button>
              <button
                type="button"
                className="button secondary"
                onClick={() =>
                  ui.open(chat.id, { kind: "report", userId, name: p.display_name ?? "" })
                }
              >
                {say("Report", "Reportar")}
              </button>
            </div>
          )}
          <button
            type="button"
            className="button secondary"
            onClick={() => {
              ui.close();
              void router.navigate({ href: `/profile/${encodeURIComponent(p.username ?? "")}` });
            }}
          >
            {say("View full profile →", "Ver perfil completo →")}
          </button>
          {action.feedback}
        </>
      )}
    </Modal>
  );
}
