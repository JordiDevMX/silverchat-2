import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

/** Static ambient light. It never intercepts input or participates in layout. */
export function ShellBackdrop({ className, ...props }: ComponentProps<"div">) {
  return (
    <div
      {...props}
      data-slot="shell-backdrop"
      aria-hidden="true"
      className={cn(
        "pointer-events-none absolute inset-x-0 top-0 z-[1] h-64 bg-ambient-glow",
        className,
      )}
    />
  );
}
