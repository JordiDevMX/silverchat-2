import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  createContext,
  type PropsWithChildren,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { useI18n } from "@/app/providers/i18n-provider";
import { useTheme } from "@/app/providers/theme-provider";
import { registerBeforeSignOut } from "@/lib/auth";
import { useAuth } from "@/lib/auth-provider";
import { supabase } from "@/lib/supabase";
import type { Settings, SettingsPatch } from "./hooks";

const Context = createContext<{
  settings: Settings | undefined;
  loading: boolean;
  error: string;
  save: (patch: SettingsPatch, debounce?: boolean) => Promise<void>;
  retry: () => void;
} | null>(null);
export function PreferencesProvider({ children }: PropsWithChildren) {
  const { user, mfaRequired } = useAuth();
  return (
    <AccountPreferences key={user?.id ?? "guest"} userId={!mfaRequired ? user?.id : undefined}>
      {children}
    </AccountPreferences>
  );
}
function AccountPreferences({ children, userId }: PropsWithChildren<{ userId?: string }>) {
  const cache = useQueryClient();
  const theme = useTheme();
  const i18n = useI18n();
  const [error, setError] = useState("");
  const [optimistic, setOptimistic] = useState<SettingsPatch>({});
  const pending = useRef<SettingsPatch>({});
  const failed = useRef<SettingsPatch>({});
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const inFlight = useRef(0);
  const chain = useRef<Promise<unknown>>(Promise.resolve());
  const query = useQuery({
    queryKey: ["preferences", userId],
    enabled: !!userId,
    staleTime: Infinity,
    refetchOnWindowFocus: false,
    queryFn: async () => {
      const r = await supabase
        .from("user_settings")
        .select("*")
        .eq("user_id", userId ?? "")
        .single();
      if (r.error) throw r.error;
      return r.data;
    },
  });
  const { setTheme, setAccent } = theme;
  const { setLanguage } = i18n;
  useEffect(() => {
    if (query.data) {
      setTheme(optimistic.theme ?? query.data.theme);
      setAccent(optimistic.accent ?? query.data.accent);
      setLanguage(optimistic.language ?? query.data.language);
    }
  }, [query.data, optimistic, setTheme, setAccent, setLanguage]);
  const flush = () => {
    clearTimeout(timer.current);
    const patch = pending.current;
    pending.current = {};
    if (!userId || !Object.keys(patch).length) return Promise.resolve();
    inFlight.current++;
    const task = chain.current
      .catch(() => undefined)
      .then(async () => {
        const r = await supabase
          .from("user_settings")
          .update(patch)
          .eq("user_id", userId)
          .select("user_id")
          .single();
        if (r.error) {
          failed.current = { ...failed.current, ...patch };
          setError("Your preferences could not be saved. Retry to sync them.");
          throw r.error;
        }
        for (const key of Object.keys(patch)) delete failed.current[key as keyof SettingsPatch];
        if (!Object.keys(failed.current).length) setError("");
      });
    void task
      .finally(() => {
        inFlight.current--;
      })
      .catch(() => undefined);
    chain.current = task;
    return task;
  };
  const flushRef = useRef(flush);
  flushRef.current = flush;
  useEffect(
    () => () => {
      void flushRef.current().catch(() => undefined);
    },
    [],
  );
  useEffect(
    () =>
      registerBeforeSignOut(async () => {
        if (Object.keys(failed.current).length)
          pending.current = { ...failed.current, ...pending.current };
        await flushRef.current();
        await chain.current;
      }),
    [],
  );
  const save = async (patch: SettingsPatch, debounce = false) => {
    if (!userId || !query.data) throw new Error("Settings unavailable");
    setOptimistic((old) => ({ ...old, ...patch }));
    cache.setQueryData<Settings>(["preferences", userId], (old) =>
      old ? { ...old, ...patch } : old,
    );
    pending.current = { ...pending.current, ...patch };
    if (debounce) {
      clearTimeout(timer.current);
      timer.current = setTimeout(() => {
        void flushRef.current().catch(() => undefined);
      }, 500);
      return;
    }
    await flush();
  };
  // A dirty preference draft also warns on a hard navigation; normal route changes keep this provider alive.
  useEffect(() => {
    const warn = (event: BeforeUnloadEvent) => {
      if (
        inFlight.current ||
        Object.keys(pending.current).length ||
        Object.keys(failed.current).length
      ) {
        event.preventDefault();
        event.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, []);
  return (
    <Context.Provider
      value={{
        settings: query.data ? { ...query.data, ...optimistic } : undefined,
        loading: query.isLoading,
        error: error || (query.error ? "Could not load preferences." : ""),
        save,
        retry: () => {
          if (Object.keys(failed.current).length) {
            pending.current = { ...failed.current, ...pending.current };
            void flush().catch(() => undefined);
          } else void query.refetch();
        },
      }}
    >
      {children}
    </Context.Provider>
  );
}
export function usePreferences() {
  const value = useContext(Context);
  if (!value) throw new Error("PreferencesProvider missing");
  return value;
}
