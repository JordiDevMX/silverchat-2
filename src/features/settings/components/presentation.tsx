import type { ComponentProps } from "react";
import { useI18n } from "@/app/providers/i18n-provider";
import { SettingsPageSurface, SettingsToggle } from "@/components/ui/settings-surfaces";
export function SettingsPage({
  title,
  description,
  ...props
}: ComponentProps<typeof SettingsPageSurface>) {
  const { t } = useI18n();
  return (
    <SettingsPageSurface {...props} title={t(title)} description={description && t(description)} />
  );
}
export function Toggle({ label, description, ...props }: ComponentProps<typeof SettingsToggle>) {
  const { t } = useI18n();
  return <SettingsToggle {...props} label={t(label)} description={description && t(description)} />;
}
