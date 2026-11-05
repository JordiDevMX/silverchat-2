import { useRouter } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";

export { AppSkeleton } from "@/components/ui/app-skeleton";
export { CodeInput } from "@/components/ui/code-input";
export { InlineError } from "@/components/ui/inline-error";
export { Modal } from "@/components/ui/modal";

import { useAuth } from "@/lib/auth-provider";

export { AuthSurface as AuthFrame, PublicBrand as Brand } from "@/components/ui/auth-surfaces";

export function SessionExpiredModal() {
  const auth = useAuth();
  const router = useRouter();
  if (!auth.sessionExpired) return null;
  return (
    <Modal title="Your session has expired" className="session-expired-dialog">
      <p>Please log in again to continue.</p>
      <Button
        className="w-full"
        type="button"
        onClick={() => {
          window.location.assign(
            `/auth/login?${new URLSearchParams({ redirect: router.state.location.href })}`,
          );
        }}
      >
        Log in
      </Button>
    </Modal>
  );
}
