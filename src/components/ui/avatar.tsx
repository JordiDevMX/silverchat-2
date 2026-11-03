import { type ComponentProps, useState } from "react";
import { cn } from "@/lib/utils";

const sizes = {
  xs: "size-8 text-xs",
  sm: "size-9 text-xs",
  md: "size-11 text-sm",
  lg: "size-12 text-sm",
  xl: "size-16 text-base",
};

/** Presentation only. Callers resolve signed URLs and privacy before supplying src. */
export function Avatar({
  src,
  initials,
  gradient,
  size = "md",
  className,
  style,
  ...props
}: ComponentProps<"span"> & {
  src?: string;
  initials: string;
  gradient?: string;
  size?: keyof typeof sizes;
}) {
  const [failedUrl, setFailedUrl] = useState<string>();
  const showImage = !!src && src !== failedUrl;
  return (
    <span
      data-slot="avatar"
      className={cn(
        "relative inline-grid shrink-0 place-items-center overflow-hidden rounded-full border border-border bg-gradient-silver font-semibold shadow-silver",
        gradient ? "text-white" : "text-foreground/80",
        sizes[size],
        className,
      )}
      style={{ backgroundImage: gradient, ...style }}
      {...props}
    >
      {showImage ? (
        <img
          src={src}
          alt=""
          loading="lazy"
          decoding="async"
          className="h-full w-full object-cover"
          onError={() => setFailedUrl(src)}
        />
      ) : (
        <span aria-hidden="true">{initials}</span>
      )}
    </span>
  );
}
