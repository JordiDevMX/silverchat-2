export interface ChannelInvitationOutcome {
  succeeded: string[];
  failed: Array<{ recipientId: string; reason: string }>;
}

/**
 * Parses the per-recipient JSONB array returned by `send_channel_invitations`.
 * Any requested recipient missing from the response or with `ok !== true` is
 * classified as failed so partial deliveries never look fully sent.
 */
export function parseChannelInvitationResults(
  data: unknown,
  requestedRecipientIds: readonly string[],
): ChannelInvitationOutcome {
  const byRecipient = new Map<string, { ok: boolean; reason: string }>();

  if (Array.isArray(data)) {
    for (const raw of data) {
      if (!raw || typeof raw !== "object") continue;
      const item = raw as Record<string, unknown>;
      if (typeof item.recipient_id !== "string" || !item.recipient_id) continue;
      byRecipient.set(item.recipient_id, {
        ok: item.ok === true,
        reason: typeof item.reason === "string" && item.reason ? item.reason : "ineligible",
      });
    }
  }

  const succeeded: string[] = [];
  const failed: Array<{ recipientId: string; reason: string }> = [];

  for (const recipientId of requestedRecipientIds) {
    const entry = byRecipient.get(recipientId);
    if (entry?.ok) {
      succeeded.push(recipientId);
    } else {
      failed.push({ recipientId, reason: entry?.reason ?? "unavailable" });
    }
  }

  return { succeeded, failed };
}

const MAX_SILENCE_MINUTES = 30 * 24 * 60; // 30 days max custom silence

export function parseCustomSilenceMinutes(raw: string): number | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const parsed = Number(trimmed);
  if (!Number.isFinite(parsed) || !Number.isInteger(parsed)) return null;
  if (parsed < 1 || parsed > MAX_SILENCE_MINUTES) return null;
  return parsed * 60_000;
}
