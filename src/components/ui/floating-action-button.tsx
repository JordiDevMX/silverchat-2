import { MessageSquarePlus, Phone, Plus, Radio, UsersRound } from "lucide-react";
import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

const icons = {
  chats: MessageSquarePlus,
  calls: Phone,
  communities: UsersRound,
  updates: Radio,
};

export function FloatingActionButton({
  kind,
  className,
  type = "button",
  ...props
}: Omit<ComponentProps<"button">, "children"> & { kind: keyof typeof icons }) {
  const Icon = icons[kind];
  return (
    <button
      {...props}
      type={type}
      data-slot="floating-action-button"
      data-kind={kind}
      className={cn(
        "grid size-14 shrink-0 cursor-pointer place-items-center rounded-2xl border-0 bg-neon text-[oklch(0.12_0.01_255)] shadow-glow outline-none hover:brightness-105 focus-visible:outline-none focus-visible:ring-0 focus-visible:brightness-125 focus-visible:[&_svg]:stroke-[3] disabled:pointer-events-none disabled:opacity-50 disabled:shadow-none",
        className,
      )}
    >
      <span className="relative" aria-hidden="true">
        <Icon size={26} />
        {kind === "calls" && <Plus size={12} className="absolute -top-1 -right-1" />}
      </span>
    </button>
  );
}
