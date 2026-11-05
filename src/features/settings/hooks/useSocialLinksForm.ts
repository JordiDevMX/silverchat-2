import { type FormEvent, useState } from "react";
import { useI18n } from "@/app/providers/i18n-provider";
import { normalizeSocialLinks } from "@/lib/social-links";
import { supabase } from "@/lib/supabase";
import { type Profile, useProfileRefresh } from "../hooks";
import { useAction } from "./useAction";
export function useSocialLinksForm(profile: Profile) {
  const [links, setLinks] = useState(() => normalizeSocialLinks(profile.social_links));
  const [keys, setKeys] = useState(() => links.custom?.map(() => crypto.randomUUID()) ?? []);
  const action = useAction();
  const refresh = useProfileRefresh();
  const { t } = useI18n();
  const custom = links.custom ?? [];
  const submit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    void action.run(async () => {
      const normalized = normalizeSocialLinks(links);
      const r = await supabase
        .from("profiles")
        .update({ social_links: { ...normalized } })
        .eq("id", profile.id)
        .select("id")
        .single();
      if (r.error) throw r.error;
      setLinks(normalized);
      setKeys(normalized.custom?.map(() => crypto.randomUUID()) ?? []);
      await refresh();
    }, "Saved");
  };
  return { links, setLinks, keys, setKeys, action, t, custom, submit };
}
