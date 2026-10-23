import { Search, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useChatText } from "../i18n";
export function ChatSearchBar({
  query,
  archived,
  onChange,
}: {
  query: string;
  archived: boolean;
  onChange: (value: string) => void;
}) {
  const [value, setValue] = useState(query);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const t = useChatText();
  useEffect(() => {
    clearTimeout(timer.current);
    setValue(query);
  }, [query]);
  useEffect(() => () => clearTimeout(timer.current), []);
  const change = (next: string) => {
    setValue(next);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => onChange(next), 150);
  };
  const label = t(archived ? "Search archived…" : "Search chats…");
  return (
    <div className="chat-search">
      <Search size={19} aria-hidden="true" />
      <input
        type="search"
        aria-label={label}
        placeholder={label}
        maxLength={200}
        value={value}
        onChange={(e) => change(e.target.value)}
      />
      {value && (
        <button
          type="button"
          aria-label={t("Clear search")}
          onClick={() => {
            clearTimeout(timer.current);
            setValue("");
            onChange("");
          }}
        >
          <X size={18} />
        </button>
      )}
    </div>
  );
}
