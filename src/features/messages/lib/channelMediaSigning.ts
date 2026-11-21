import type { Upload } from "../types.ts";

export interface MediaSigningContext {
  channelId?: string | null;
  messageId?: string | null;
  download?: boolean;
}

export type SignChannelMediaPayload =
  | {
      kind: "channel_avatar";
      channelId: string;
      path: string;
    }
  | {
      kind: "channel_post_media";
      uploadId: string;
      channelId: string;
      download: boolean;
      filename?: string;
    }
  | {
      kind: "forwarded_channel_media";
      uploadId: string;
      messageId: string;
      download: boolean;
      filename?: string;
    };

export type MediaSigningTarget =
  | {
      mode: "edge";
      body: SignChannelMediaPayload;
    }
  | {
      mode: "storage";
      bucket: string;
      path: string;
    };

const CHANNEL_AVATAR_PATH_RE =
  /^chat-([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\/channel-/i;
const UUID_PREFIX_RE = /^([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\//i;

export function resolveMediaSigningTarget(
  upload: Pick<Upload, "id" | "bucket" | "path"> &
    Partial<Pick<Upload, "original_filename" | "channelId" | "messageId">>,
  context?: MediaSigningContext,
): MediaSigningTarget {
  const download = Boolean(context?.download);
  const channelId = context?.channelId ?? upload.channelId ?? null;
  const messageId = context?.messageId ?? upload.messageId ?? null;
  const filename = upload.original_filename;

  if (upload.bucket !== "channel-media") {
    return {
      mode: "storage",
      bucket: upload.bucket,
      path: upload.path,
    };
  }

  if (channelId) {
    return {
      mode: "edge",
      body: {
        kind: "channel_post_media",
        uploadId: upload.id,
        channelId,
        download,
        ...(filename ? { filename } : {}),
      },
    };
  }

  if (messageId) {
    return {
      mode: "edge",
      body: {
        kind: "forwarded_channel_media",
        uploadId: upload.id,
        messageId,
        download,
        ...(filename ? { filename } : {}),
      },
    };
  }

  const fallbackChannelId = UUID_PREFIX_RE.exec(upload.path)?.[1];
  if (fallbackChannelId) {
    return {
      mode: "edge",
      body: {
        kind: "channel_post_media",
        uploadId: upload.id,
        channelId: fallbackChannelId,
        download,
        ...(filename ? { filename } : {}),
      },
    };
  }

  return {
    mode: "storage",
    bucket: upload.bucket,
    path: upload.path,
  };
}

export function resolveAvatarSigningTarget(
  path: string | null | undefined,
): MediaSigningTarget | null {
  if (!path) return null;
  const match = CHANNEL_AVATAR_PATH_RE.exec(path);
  if (match?.[1]) {
    return {
      mode: "edge",
      body: {
        kind: "channel_avatar",
        channelId: match[1],
        path,
      },
    };
  }
  return {
    mode: "storage",
    bucket: "avatars",
    path,
  };
}
