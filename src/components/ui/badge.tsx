import { cva, type VariantProps } from "class-variance-authority";
import * as React from "react";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex h-5 min-w-5 shrink-0 items-center justify-center whitespace-nowrap rounded-full px-1.5 text-[10px] font-bold leading-none",
  {
    variants: {
      variant: {
        default: "bg-secondary text-secondary-foreground",
        neon: "bg-primary bg-gradient-neon neon-label-fill text-primary-foreground shadow-glow",
      },
    },
    defaultVariants: { variant: "default" },
  },
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {}

const Badge = React.forwardRef<HTMLSpanElement, BadgeProps>(
  ({ className, variant, ...props }, ref) => (
    <span
      ref={ref}
      data-slot="badge"
      className={cn(badgeVariants({ variant, className }))}
      {...props}
    />
  ),
);
Badge.displayName = "Badge";

export { Badge, badgeVariants };
