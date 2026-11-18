import type { Profile as AccountProfile } from "@/features/auth/types";
import { getInitials } from "@/lib/avatar";
import type { Profile } from "../types";

// `profiles_visible` computes `avatar_initials` from private name fields. Optimistic
// messages need the same public shape, so mirror that projection client-side.
export function senderProfile(profile: AccountProfile): Profile {
  return {
    avatar_initials: getInitials(profile),
    avatar_url: profile.avatar_url,
    bio: profile.bio,
    created_at: profile.created_at,
    display_name: profile.display_name,
    id: profile.id,
    last_seen_at: profile.last_seen_at,
    social_links: profile.social_links,
    updated_at: profile.updated_at,
    username: profile.username,
  };
}
