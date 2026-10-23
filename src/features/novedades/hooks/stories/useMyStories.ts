import { useAuth } from "@/lib/auth-provider";
import { useStories } from "./useStories";
export function useMyStories() {
  const { user } = useAuth();
  const query = useStories();
  return { ...query, data: query.data?.find((g) => g.user_id === user?.id)?.stories ?? [] };
}
