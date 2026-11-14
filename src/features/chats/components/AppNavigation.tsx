import { useRouterState } from "@tanstack/react-router";
import { MessageCircle, Phone, Radio, Settings, Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { BrandMark } from "@/components/ui/brand-lockup";
import { NavLink } from "@/features/settings/components/shared";
import { useAppNavigation } from "../hooks/useAppNavigation";
import { useChatText } from "../i18n";
import { badgeText } from "../utils/computeChatDisplay";
export function AppNavigation() {
  const { unread, communityUnread } = useAppNavigation();
  const t = useChatText();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const items = [
    { icon: MessageCircle, label: "Chats", href: "/chats", unread },
    { icon: Radio, label: "Updates", href: "/novedades", unread: 0 },
    { icon: Users, label: "Communities", href: "/communities", unread: communityUnread },
    { icon: Phone, label: "Calls", href: "/calls", unread: 0 },
    { icon: Settings, label: "Settings", href: "/settings", unread: 0 },
  ];
  return (
    <nav className="app-navigation" aria-label={t("Main navigation", "Navegación principal")}>
      <BrandMark className="app-monogram hidden lg:grid" />
      <span className="app-nav-divider" aria-hidden="true" />
      <ul className="app-nav-items">
        {items.map(({ icon: Icon, label, href, unread: count }) => {
          const active =
            pathname.startsWith(href) ||
            (href === "/novedades" && pathname.startsWith("/channels"));
          return (
            <li key={href}>
              <NavLink
                href={href}
                className={`app-nav-link ${active ? "active" : ""}`}
                aria-current={active ? "page" : undefined}
              >
                <span
                  className={`app-nav-icon ${active ? "bg-gradient-neon neon-icon-fill shadow-glow" : ""}`}
                >
                  <Icon size={20} strokeWidth={active ? 2.4 : 2} aria-hidden="true" />
                  {count > 0 && (
                    <Badge
                      variant="neon"
                      role="img"
                      className="app-nav-badge"
                      aria-label={`${count} ${t("Unread")}`}
                    >
                      {badgeText(count)}
                    </Badge>
                  )}
                </span>
                <span className="app-nav-label">
                  {label === "Updates" ? t("Updates", "Novedades") : t(label)}
                </span>
              </NavLink>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
