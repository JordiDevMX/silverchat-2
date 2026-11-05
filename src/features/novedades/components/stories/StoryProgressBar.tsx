import { StoryProgressSurface } from "@/components/ui/story-surfaces";
export function StoryProgressBar(props: { count: number; index: number; progress: number }) {
  return <StoryProgressSurface {...props} />;
}
