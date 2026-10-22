import type { PropsWithChildren } from "react";

// Stub — full i18n system (i18next init + Intl formatters) lands in Prompt #14.
export function I18nProvider({ children }: PropsWithChildren) {
  return <>{children}</>;
}
