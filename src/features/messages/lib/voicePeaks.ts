// Include every sample, including short buffers and the remainder. Mix channels
// by maximum magnitude so a silent left channel cannot erase the waveform.
export function computePeaks(
  buffer: Pick<AudioBuffer, "length" | "numberOfChannels" | "getChannelData">,
  count = 40,
): number[] {
  if (!Number.isInteger(count) || count < 1 || count > 1000) throw new Error("Invalid peak count");
  const channels = Array.from({ length: buffer.numberOfChannels }, (_, i) =>
    buffer.getChannelData(i),
  );
  return Array.from({ length: count }, (_, i) => {
    let peak = 0;
    const start = Math.floor((i * buffer.length) / count),
      end = Math.floor(((i + 1) * buffer.length) / count);
    for (const samples of channels)
      for (let j = start; j < end; j++) {
        const value = Math.abs(samples[j] ?? 0);
        if (Number.isFinite(value)) peak = Math.max(peak, value);
      }
    return Math.round(Math.min(1, peak) * 100);
  });
}
export const recordingLimitMs = 300000;
export function formatVoiceTime(seconds: number, locale: string) {
  return new Intl.DateTimeFormat(locale, {
    minute: "2-digit",
    second: "2-digit",
    timeZone: "UTC",
  }).format(new Date(Math.max(0, Number.isFinite(seconds) ? seconds : 0) * 1000));
}
