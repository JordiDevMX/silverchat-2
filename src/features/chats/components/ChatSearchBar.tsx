import { useEffect, useRef, useState } from "react";
import { SearchField } from "@/components/ui/search-field";
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
    <SearchField
      className="chat-search"
      label={label}
      clearLabel={t("Clear search")}
      value={value}
      onChange={change}
      onClear={() => {
        clearTimeout(timer.current);
        setValue("");
        onChange("");
      }}
    />
  );
}
