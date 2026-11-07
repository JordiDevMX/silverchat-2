import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

/** Presentation only; message ownership, receipts and actions belong to the feature. */
export function BubbleSurface({
  own = false,
  className,
  ...props
}: ComponentProps<"div"> & { own?: boolean }) {
  return (
    <div
      {...props}
      data-slot="bubble-surface"
      data-own={own}
      className={cn(
        "rounded-2xl px-4 py-3",
        own ? "bubble-self" : "bg-bubble-other text-foreground",
        className,
      )}
    />
  );
}
