// Call log formatting (6.2/6.3): day grouping and duration/time labels.
export function formatDuration(totalSeconds: number): string {
  const seconds = Math.max(0, Math.floor(totalSeconds));
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const rest = seconds % 60;
  const mm = String(minutes).padStart(2, "0");
  const ss = String(rest).padStart(2, "0");
  return hours > 0 ? `${hours}:${mm}:${ss}` : `${mm}:${ss}`;
}

export interface CallGroup<T> {
  label: string;
  calls: T[];
}

export interface DayLabels {
  today: string;
  yesterday: string;
}

/** Group calls by calendar day (L8): Today / Yesterday / formatted date. */
export function groupCallsByDay<T extends { startedAt: string }>(
  calls: T[],
  labels: DayLabels,
  locale: string,
  now: Date = new Date(),
): CallGroup<T>[] {
  const today = now.toDateString();
  const yesterday = new Date(now.getTime() - 86_400_000).toDateString();
  const groups = new Map<string, T[]>();
  for (const call of calls) {
    const key = new Date(call.startedAt).toDateString();
    const bucket = groups.get(key);
    if (bucket) bucket.push(call);
    else groups.set(key, [call]);
  }
  const dayFormat = new Intl.DateTimeFormat(locale, {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
  return Array.from(groups, ([key, items]) => ({
    label:
      key === today
        ? labels.today
        : key === yesterday
          ? labels.yesterday
          : dayFormat.format(new Date(key)),
    calls: items,
  }));
}

/** Relative timestamp (6.3): "14:22" today, "Yesterday 14:22", "12/09 14:22". */
export function formatCallTimestamp(
  startedAt: string,
  labels: DayLabels,
  locale: string,
  now: Date = new Date(),
): string {
  const date = new Date(startedAt);
  const time = new Intl.DateTimeFormat(locale, {
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
  if (date.toDateString() === now.toDateString()) return time;
  if (date.toDateString() === new Date(now.getTime() - 86_400_000).toDateString()) {
    return `${labels.yesterday} ${time}`;
  }
  const day = new Intl.DateTimeFormat(locale, { day: "2-digit", month: "2-digit" }).format(date);
  return `${day} ${time}`;
}
