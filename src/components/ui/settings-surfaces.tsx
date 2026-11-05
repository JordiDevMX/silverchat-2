import { Check } from "lucide-react";
import { type ComponentProps, type ReactNode, useId } from "react";
import { cn } from "@/lib/utils";
import { MotionOverlay } from "./motion-overlay";
import { Switch } from "./switch";

/** Route-neutral settings surfaces; providers, URLs and saves belong to adapters. */
export function SettingsShellSurface({
  header,
  sidebar,
  children,
}: {
  header: ReactNode;
  sidebar: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="settings-shell settings-shell-v2">
      <header className="settings-topbar">{header}</header>
      <div className="settings-workspace">
        <aside className="settings-sidebar">{sidebar}</aside>
        <div className="settings-main">{children}</div>
      </div>
    </div>
  );
}
export function SettingsPageSurface({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <section className="settings-page settings-panel">
      <header className="settings-page-heading">
        <h1>{title}</h1>
        {description && <p>{description}</p>}
      </header>
      {children}
    </section>
  );
}
export function SettingsToggle({
  label,
  description,
  checked,
  disabled,
  onChange,
}: {
  label: string;
  description?: string;
  checked: boolean;
  disabled?: boolean;
  onChange: (value: boolean) => void;
}) {
  const id = useId();
  return (
    <div className="toggle-row settings-toggle">
      <label htmlFor={id}>
        <strong>{label}</strong>
        {description && <small id={`${id}-description`}>{description}</small>}
      </label>
      <Switch
        id={id}
        aria-label={label}
        aria-describedby={description ? `${id}-description` : undefined}
        checked={checked}
        disabled={disabled}
        onCheckedChange={onChange}
      />
    </div>
  );
}
export function ThemeChoice({
  value,
  label,
  icon,
  selected,
  onSelect,
}: {
  value: "light" | "dark" | "system";
  label: string;
  icon: ReactNode;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      className={`theme-option theme-preview-${value}`}
      type="button"
      aria-pressed={selected}
      onClick={onSelect}
    >
      <span className="theme-miniature" aria-hidden="true">
        <span />
        <span />
        <span />
      </span>
      <span>
        {icon}
        {label}
      </span>
    </button>
  );
}
export const SETTINGS_ACCENTS = ["blue", "purple", "red", "orange", "yellow", "green"] as const;
export function AccentChoice({
  value,
  label,
  selected,
  onSelect,
}: {
  value: (typeof SETTINGS_ACCENTS)[number];
  label: string;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      className={`accent-swatch theme-${value}`}
      type="button"
      aria-label={label}
      aria-pressed={selected}
      onClick={onSelect}
    >
      {selected && <Check size={19} aria-hidden="true" />}
    </button>
  );
}
export function SettingsDialog({ className, ...props }: ComponentProps<typeof MotionOverlay>) {
  return <MotionOverlay {...props} className={cn("settings-dialog", className)} />;
}
