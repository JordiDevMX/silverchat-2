export function StoryProgressBar({
  count,
  index,
  progress,
}: {
  count: number;
  index: number;
  progress: number;
}) {
  return (
    <div role="img" className="story-progress" aria-label="Story progress">
      {Array.from({ length: count }, (_, i) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: Progress slots have fixed positional identity.
        <div key={`segment-${i}`}>
          <span style={{ transform: `scaleX(${i < index ? 1 : i === index ? progress : 0})` }} />
        </div>
      ))}
    </div>
  );
}
