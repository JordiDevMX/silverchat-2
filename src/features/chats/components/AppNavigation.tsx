import { useRouterState } from "@tanstack/react-router";
import { MessageCircle, Phone, Radio, Settings, Users } from "lucide-react";
import { useEffect } from "react";
import { NavLink } from "@/features/settings/components/shared";
import { cleanupDrafts } from "../drafts";
import { useChats, useChatsRealtime } from "../hooks/useChats";
import { useChatText } from "../i18n";
import { badgeText, isMuted } from "../utils/computeChatDisplay";
export function AppNavigation() {
  const { data = [] } = useChats();
  useChatsRealtime();
  const t = useChatText();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  useEffect(() => {
    try {
      cleanupDrafts(localStorage);
    } catch {
      /* Optional storage. */
    }
  }, []);
  // Muted/archived chats don't produce tab notifications; manual dots aren't messages.
  const unread = data.reduce(
    (sum, c) => sum + (!c.archivedAt && !isMuted(c) ? c.unreadCount : 0),
    0,
  );
  return (
    <nav className="app-navigation" aria-label={t("Main navigation", "Navegación principal")}>
      <span className="app-monogram" aria-hidden="true">
        s<span>c</span>
      </span>
      {(
        [
          [MessageCircle, "Chats", "/chats"],
          [Radio, "Updates", "/novedades"],
          [Users, "Communities", "/communities"],
          [Phone, "Calls", "/calls"],
          [Settings, "Settings", "/settings"],
        ] as const
      ).map(([Icon, label, href]) => (
        <NavLink
          key={href}
          href={href}
          className={`app-nav-link ${pathname.startsWith(href) || (href === "/novedades" && pathname.startsWith("/channels")) ? "active" : ""}`}
        >
          <span className="app-nav-icon">
            <Icon size={23} />
            {label === "Chats" && unread > 0 && (
              <span role="img" className="chat-badge" aria-label={`${unread} ${t("Unread")}`}>
                {badgeText(unread)}
              </span>
            )}
          </span>
          <span>{label === "Updates" ? t("Updates", "Novedades") : t(label)}</span>
        </NavLink>
      ))}
    </nav>
  );
}
