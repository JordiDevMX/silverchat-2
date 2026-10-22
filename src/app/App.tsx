import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { RouterProvider } from "@tanstack/react-router";

import { AuthProvider } from "./providers/auth-provider";
import { I18nProvider } from "./providers/i18n-provider";
import { ThemeProvider } from "./providers/theme-provider";
import { router } from "./router";

const queryClient = new QueryClient();

// Prompt #2 §10 — initial providers tree. ThemeProvider/I18nProvider/AuthProvider
// are stubs; real implementations arrive in Prompt #5 and Prompt #14.
export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <I18nProvider>
          <AuthProvider>
            <RouterProvider router={router} />
          </AuthProvider>
        </I18nProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}
