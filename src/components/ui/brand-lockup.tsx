import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

export function BrandMark({ className, ...props }: ComponentProps<"span">) {
  return (
    <span
      {...props}
      data-slot="brand-mark"
      aria-hidden="true"
      className={cn(
        "grid size-10 shrink-0 place-items-center rounded-xl bg-neon bg-gradient-neon text-lg font-bold text-white shadow-glow",
        className,
      )}
    >
      S
    </span>
  );
}

export function BrandLockup({ className, ...props }: ComponentProps<"span">) {
  return (
    <span
      {...props}
      data-slot="brand-lockup"
      role="img"
      aria-label="SilverChat"
      className={cn("inline-flex items-center gap-1.5", className)}
    >
      <BrandMark />
      <span aria-hidden="true" className="text-2xl font-semibold tracking-tight text-foreground">
        ilver<span className="text-neon">Chat</span>
      </span>
    </span>
  );
}
