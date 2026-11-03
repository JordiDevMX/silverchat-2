import { useRouter } from "@tanstack/react-router";
import { Check, X } from "lucide-react";
import { Modal } from "@/features/auth/components";
import { Avatar } from "@/features/settings/components/shared";
import { useMessageRequestActions } from "../hooks/useMessageRequestActions";
import { useChatText } from "../i18n";
import type { MessageRequest } from "../types";
import { RequestDisclosure } from "./RequestDisclosure";
export function MessageRequestsSection({ requests }: { requests: MessageRequest[] }) {
  const t = useChatText();
  const router = useRouter();
  const { decline, setDecline, notice, error, mutation, run } = useMessageRequestActions();
  if (!requests.length && !decline && !notice && !error) return null;
  return (
    <section className="message-requests" aria-label={t("Message requests")}>
      {!!requests.length && (
        <RequestDisclosure label={t("Message requests")} count={requests.length}>
          {requests.map((r) => (
            <div className="request-row" key={r.id}>
              <button
                type="button"
                className="request-open"
                onClick={() => void router.navigate({ href: `/chats/${r.chatId}` })}
              >
                <Avatar
                  size="small"
                  profile={{ id: r.senderId, display_name: r.name, avatar_url: r.avatarUrl }}
                />
                <span>
                  <strong>{t(r.name)}</strong> <small>{r.username && `@${r.username}`}</small>
                  <span className="request-preview">
                    {r.preview ? t(r.preview) : t("No messages yet")}
                  </span>
                </span>
              </button>
              <button
                type="button"
                className="request-accept"
                aria-label={`${t("Accept")} ${r.name}`}
                disabled={mutation.busy}
                onClick={() => void run(r, true)}
              >
                <Check size={20} />
              </button>
              <button
                type="button"
                className="request-decline"
                aria-label={`${t("Decline")} ${r.name}`}
                disabled={mutation.busy}
                onClick={() => setDecline(r)}
              >
                <X size={20} />
              </button>
            </div>
          ))}
        </RequestDisclosure>
      )}
      {notice && <p role="status">{notice}</p>}
      {error && <p role="alert">{t("Could not update chats. Please try again.")}</p>}
      {decline && (
        <Modal
          title={t("Decline this chat request?")}
          onClose={mutation.busy ? undefined : () => setDecline(null)}
        >
          <p>
            {t(
              `${decline.name} won’t be able to message you again for 7 days.`,
              `${decline.name} no podrá enviarte mensajes durante 7 días.`,
            )}
          </p>
          {error && <p role="alert">{t("Could not update chats. Please try again.")}</p>}
          <div className="modal-actions">
            <button
              type="button"
              className="button secondary"
              disabled={mutation.busy}
              onClick={() => setDecline(null)}
            >
              {t("Cancel")}
            </button>
            <button
              type="button"
              className="button danger"
              disabled={mutation.busy}
              onClick={() => void run(decline, false)}
            >
              {t("Decline")}
            </button>
          </div>
        </Modal>
      )}
    </section>
  );
}
