import { Search, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Input } from "./input";

export function SearchField({
  label,
  clearLabel,
  value,
  onChange,
  onClear,
  className,
}: {
  label: string;
  clearLabel: string;
  value: string;
  onChange: (value: string) => void;
  onClear: () => void;
  className?: string;
}) {
  return (
    <div
      data-slot="search-field"
      className={cn(
        "flex min-h-11 items-center gap-2.5 rounded-xl border-0 bg-gradient-silver px-3 text-muted-foreground focus-within:ring-2 focus-within:ring-ring",
        className,
      )}
    >
      <Search size={19} aria-hidden="true" className="shrink-0" />
      <Input
        type="search"
        aria-label={label}
        placeholder={label}
        maxLength={200}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-11 w-0 min-w-0 flex-1 rounded-none border-0 bg-transparent p-0 text-foreground shadow-none outline-none focus-visible:ring-0 [&::-webkit-search-cancel-button]:hidden"
      />
      {value && (
        <button
          data-slot="search-clear"
          type="button"
          aria-label={clearLabel}
          onClick={onClear}
          className="grid size-8 shrink-0 place-items-center rounded-md hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring"
        >
          <X size={18} aria-hidden="true" />
        </button>
      )}
    </div>
  );
}
