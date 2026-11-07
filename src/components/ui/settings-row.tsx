import { ChevronRight } from "lucide-react";
import type { ComponentProps, ReactNode } from "react";
import { cn } from "@/lib/utils";

export function CardSurface({ className, ...props }: ComponentProps<"div">) {
  return (
    <div
      data-slot="card-surface"
      className={cn(
        "overflow-hidden rounded-2xl border border-border/60 bg-card/60 text-card-foreground shadow-silver backdrop-blur-xl divide-y divide-border/50",
        className,
      )}
      {...props}
    />
  );
}

export function SectionHeading({ className, ...props }: ComponentProps<"h3">) {
  return (
    <h3
      data-slot="section-heading"
      className={cn("px-1 pt-1 pb-2 text-xs font-semibold text-muted-foreground", className)}
      {...props}
    />
  );
}

export const settingsRowClassName =
  "group flex min-h-12 w-full items-center gap-3 px-3.5 py-2.5 text-left text-foreground transition-colors hover:bg-accent/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

export function SettingsRowContent({
  label,
  subtitle,
  icon,
  right,
}: {
  label: ReactNode;
  subtitle?: ReactNode;
  icon?: ReactNode;
  right?: ReactNode;
}) {
  return (
    <>
      {icon && (
        <span
          aria-hidden="true"
          className="grid size-8 shrink-0 place-items-center rounded-lg border border-border/60 bg-gradient-silver text-neon [&_svg]:size-4"
        >
          {icon}
        </span>
      )}
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-medium break-words">{label}</span>
        {subtitle && (
          <span className="block text-xs text-muted-foreground break-words">{subtitle}</span>
        )}
      </span>
      {right}
    </>
  );
}

/** Use a static row for embedded controls; action rows must not contain another button. */
export function SettingsRow({
  label,
  subtitle,
  icon,
  right,
  onClick,
  className,
  disabled,
}: {
  label: ReactNode;
  subtitle?: ReactNode;
  icon?: ReactNode;
  right?: ReactNode;
  onClick?: () => void;
  className?: string;
  disabled?: boolean;
}) {
  const content = (
    <SettingsRowContent
      label={label}
      subtitle={subtitle}
      icon={icon}
      right={
        right ??
        (onClick && (
          <ChevronRight aria-hidden="true" className="size-4 shrink-0 text-muted-foreground" />
        ))
      }
    />
  );
  return onClick ? (
    <button
      data-slot="settings-row"
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={cn(settingsRowClassName, className)}
    >
      {content}
    </button>
  ) : (
    <div data-slot="settings-row" className={cn(settingsRowClassName, className)}>
      {content}
    </div>
  );
}
