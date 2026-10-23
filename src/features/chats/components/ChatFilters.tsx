import { useEffect, useRef } from "react";
import { useChatText } from "../i18n";
import { type FilterKey, filterKeys } from "../types";
export function ChatFilters({
  value,
  onChange,
}: {
  value: FilterKey;
  onChange: (key: FilterKey) => void;
}) {
  const ref = useRef<HTMLFieldSetElement>(null);
  const t = useChatText();
  useEffect(() => {
    ref.current
      ?.querySelector('[aria-pressed="true"]')
      ?.scrollIntoView({ inline: "nearest", block: "nearest" });
  }, []);
  return (
    <fieldset ref={ref} className="chat-filters" aria-label={t("Chats")}>
      {filterKeys.map((key) => (
        <button type="button" key={key} aria-pressed={value === key} onClick={() => onChange(key)}>
          {t(key[0]?.toUpperCase() + key.slice(1))}
        </button>
      ))}
    </fieldset>
  );
}
