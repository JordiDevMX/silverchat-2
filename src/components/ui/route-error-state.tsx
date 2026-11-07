import type { ErrorComponentProps } from "@tanstack/react-router";
import { AuthSurface, InfrastructureNotice } from "./auth-surfaces";
import { Button } from "./button";

/** Replaces the router's diagnostic presentation without exposing internal error details. */
export function RouteErrorState({ reset }: ErrorComponentProps) {
  return (
    <AuthSurface title="Something went wrong">
      <InfrastructureNotice role="alert">
        This page couldn’t be opened. Please try again.
      </InfrastructureNotice>
      <Button onClick={reset}>Try again</Button>
      <Button asChild variant="outline">
        <a href="/">Return home</a>
      </Button>
    </AuthSurface>
  );
}
