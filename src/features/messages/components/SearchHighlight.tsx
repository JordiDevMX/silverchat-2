import type { ReactNode } from "react";
export function SearchHighlight({ active, children }: { active: boolean; children: ReactNode }) {
  return <div className={active ? "message-highlight" : ""}>{children}</div>;
}
