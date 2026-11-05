import { useRouter } from "@tanstack/react-router";
import { signOutOtherDevices } from "@/lib/auth";
import { useAuth } from "@/lib/auth-provider";
import { usePreferences } from "../preferences-provider";
import { useAction } from "./useAction";

/** Keep completion/navigation independent from decorative dialog dismissal. */
export function usePreferenceConfirmation(onClose: () => void) {
  const { save } = usePreferences();
  const action = useAction();
  return {
    ...action,
    confirm: (patch: Parameters<typeof save>[0]) =>
      action.run(async () => {
        await save(patch);
        onClose();
      }),
  };
}
export function useLogoutConfirmation() {
  const auth = useAuth();
  const router = useRouter();
  const action = useAction();
  return {
    ...action,
    confirm: (all: boolean) =>
      action.run(async () => {
        await auth.signOut(all);
        await router.navigate({ href: "/auth/login" });
      }),
  };
}
export function useOtherDevicesConfirmation(onClose: () => void) {
  const action = useAction();
  return {
    ...action,
    confirm: () =>
      action.run(async () => {
        await signOutOtherDevices();
        onClose();
      }, "Other devices signed out"),
  };
}
