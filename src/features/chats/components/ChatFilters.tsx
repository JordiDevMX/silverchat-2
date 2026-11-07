import type { ComponentProps } from "react";
import { useEffect, useRef } from "react";
import { useChatText } from "../i18n";
import { type FilterKey, filterKeys } from "../types";
export function ChatFiltersSurface({
  t,
  value,
  onChange,
}: {
  t: (value: string, spanish?: string) => string;
  value: FilterKey;
  onChange: (key: FilterKey) => void;
}) {
  const ref = useRef<HTMLFieldSetElement>(null);
  useEffect(() => {
    // Keep a restored URL filter visible without moving the page (or a parent pane).
    const strip = ref.current;
    const active = strip?.querySelector(`[data-filter="${value}"]`);
    if (!strip || !active) return;
    const bounds = strip.getBoundingClientRect();
    const item = active.getBoundingClientRect();
    if (item.left < bounds.left) strip.scrollLeft += item.left - bounds.left;
    else if (item.right > bounds.right) strip.scrollLeft += item.right - bounds.right;
  }, [value]);
  return (
    <fieldset ref={ref} className="chat-filters" aria-label={t("Chats")}>
      {filterKeys.map((key) => (
        <button
          type="button"
          key={key}
          data-filter={key}
          aria-pressed={value === key}
          onClick={() => onChange(key)}
        >
          {t(key[0]?.toUpperCase() + key.slice(1))}
        </button>
      ))}
    </fieldset>
  );
}

export function ChatFilters(props: Omit<ComponentProps<typeof ChatFiltersSurface>, "t">) {
  const t = useChatText();
  return <ChatFiltersSurface {...props} t={t} />;
}
