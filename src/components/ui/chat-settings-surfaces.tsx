import type { ComponentProps, ReactNode } from "react";
import { SettingsDialog } from "./settings-surfaces";

/** Chat and community adapters supply data, URLs, translated labels and workflows. */
export function ChatSettingsDialog(props: ComponentProps<typeof SettingsDialog>) {
  return <SettingsDialog {...props} className={`chat-settings-dialog ${props.className ?? ""}`} />;
}
export function ChatSettingsScreenSurface({
  as: Tag = "main",
  header,
  children,
  className = "",
  id = "main",
}: {
  as?: "main" | "section";
  header: ReactNode;
  children: ReactNode;
  className?: string;
  id?: string;
}) {
  return (
    <Tag
      id={id || undefined}
      className={`chat-settings-screen chat-settings-panel settings-panel ${className}`}
    >
      <header>{header}</header>
      {children}
    </Tag>
  );
}
export function SharedFileRowSurface({
  icon,
  name,
  details,
  action,
  error,
}: {
  icon: ReactNode;
  name: string;
  details: ReactNode;
  action: ReactNode;
  error?: ReactNode;
}) {
  return (
    <div className="shared-file-row shared-file-row-v2">
      {icon}
      <span>
        <strong title={name}>{name}</strong>
        <small>{details}</small>
      </span>
      {action}
      {error}
    </div>
  );
}
export function MemberRowSurface({ children }: { children: ReactNode }) {
  return <div className="group-member group-member-v2">{children}</div>;
}

export function SharedMediaTileSurface({ className = "", ...props }: ComponentProps<"button">) {
  return (
    <button
      type="button"
      {...props}
      className={`shared-media-tile shared-media-tile-v2 ${className}`}
    />
  );
}
