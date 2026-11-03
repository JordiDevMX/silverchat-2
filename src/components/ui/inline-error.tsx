import type { PropsWithChildren } from "react";
export function InlineError({ children }: PropsWithChildren) {
  return children ? (
    <p role="alert" className="form-error text-sm text-destructive">
      {children}
    </p>
  ) : null;
}
