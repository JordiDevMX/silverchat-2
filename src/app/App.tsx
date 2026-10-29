import { QueryCache, QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { RouterProvider } from "@tanstack/react-router";
import { useEffect } from "react";
import { AppSkeleton, AuthFrame } from "@/features/auth/components";
import { PreferencesProvider } from "@/features/settings/preferences-provider";
import { AuthProvider, useAuth } from "@/lib/auth-provider";
import { isServerError, useSupabaseHealth } from "@/lib/supabase-health";
import { ConnectionBanner } from "./connection-banner";
import { I18nProvider } from "./providers/i18n-provider";
import { ThemeProvider } from "./providers/theme-provider";
import { router } from "./router";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Bounded retries: an outage must not amplify its own load.
      retry: (failureCount, error) => {
        if (isServerError(error)) return failureCount < 2;
        if ((error as { status?: number } | null)?.status === 429) return false;
        return failureCount < 3;
      },
      retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 8000),
    },
  },
  queryCache: new QueryCache({
    onError: (error) => {
      if (isServerError(error)) useSupabaseHealth.getState().markDown();
    },
  }),
});
function AuthenticatedRouter() {
  const auth = useAuth();
  useEffect(() => {
    if (auth.isLoading || auth.error || (auth.user && !auth.mfaRequired && !auth.profile)) return;
    router.update({ context: { auth } });
    void router.invalidate();
  }, [auth]);
  if (auth.error)
    return (
      <AuthFrame title="Let’s reconnect">
        <p>{auth.error}</p>
        <button className="button primary" type="button" onClick={() => window.location.reload()}>
          Try again
        </button>
      </AuthFrame>
    );
  if (auth.isLoading || (auth.user && !auth.mfaRequired && !auth.profile)) return <AppSkeleton />;
  return <RouterProvider router={router} context={{ auth }} />;
}
export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <I18nProvider>
          <ConnectionBanner />
          <AuthProvider>
            <PreferencesProvider>
              <AuthenticatedRouter />
            </PreferencesProvider>
          </AuthProvider>
        </I18nProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

import "@/styles/settings.css";

import "@/styles/chats.css";
