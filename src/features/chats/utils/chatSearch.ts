import { type FilterKey, filterKeys } from "../types.ts";
export function validateChatSearch(s: Record<string, unknown>) {
  return {
    filter: filterKeys.includes(s.filter as FilterKey)
      ? (s.filter as FilterKey)
      : ("all" as FilterKey),
    q: ["string", "number", "boolean"].includes(typeof s.q) ? String(s.q).slice(0, 200) : "",
    select: s.select === "true" || s.select === true ? "true" : undefined,
    selectedIds:
      typeof s.selectedIds === "string"
        ? s.selectedIds
            .split(",")
            .filter((id) => /^[a-f0-9-]{36}$/i.test(id))
            .slice(0, 200)
            .join(",")
        : "",
  };
}
