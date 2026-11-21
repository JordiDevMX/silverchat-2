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

export const MAX_CHANNEL_INVITATIONS_PER_BATCH = 50;

export interface ChannelInvitationBatchResult {
  succeeded: string[];
  failed: Array<{ recipientId: string; reason: string }>;
  error: { message?: string } | null;
}

/**
 * Splits recipient IDs into <=50-item chunks matching `send_channel_invitations`
 * server limits, preserving per-recipient progress across batches so partial or
 * cross-batch failures only require retrying remaining recipients.
 */
export async function sendChannelInvitationsInBatches(params: {
  channelId: string;
  recipientIds: readonly string[];
  getInvitationId: (recipientId: string) => string;
  sendBatch: (
    channelId: string,
    batch: Array<{ id: string; recipient_id: string }>,
  ) => Promise<{ data: unknown; error: { message?: string } | null }>;
  onBatchSucceeded?: (succeededIds: string[]) => void;
}): Promise<ChannelInvitationBatchResult> {
  const succeeded: string[] = [];
  const failed: Array<{ recipientId: string; reason: string }> = [];

  for (let i = 0; i < params.recipientIds.length; i += MAX_CHANNEL_INVITATIONS_PER_BATCH) {
    const chunk = params.recipientIds.slice(i, i + MAX_CHANNEL_INVITATIONS_PER_BATCH);
    const payload = chunk.map((recipientId) => ({
      id: params.getInvitationId(recipientId),
      recipient_id: recipientId,
    }));

    const rpc = await params.sendBatch(params.channelId, payload);
    if (rpc.error) {
      const remaining = params.recipientIds.slice(i);
      for (const recipientId of remaining) {
        failed.push({ recipientId, reason: "rpc_error" });
      }
      return { succeeded, failed, error: rpc.error };
    }

    const outcome = parseChannelInvitationResults(rpc.data, chunk);
    if (outcome.succeeded.length > 0) {
      succeeded.push(...outcome.succeeded);
      params.onBatchSucceeded?.(outcome.succeeded);
    }
    if (outcome.failed.length > 0) {
      failed.push(...outcome.failed);
    }
  }

  return { succeeded, failed, error: null };
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
