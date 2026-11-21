export declare const AUTHORIZED_STAGING_REF: "gffdrrtatxdiucigtwdn";

export declare function parseAuthorizedStagingOrigin(
  envRef: string | undefined,
  rawUrl: string | undefined,
): string;

export declare function isMissingResourceError(error: unknown, kind: "bucket" | "user"): boolean;

export declare function createStagingTestUser(params: {
  url: string;
  anonKey: string;
  admin: unknown;
  prefix: string;
  tag: string;
  registeredUserIds: string[];
  createClientFn: unknown;
}): Promise<{ user: { id: string }; token: string; client: unknown }>;

export declare function runConcurrentChannelCreation(params: {
  ownerClient: {
    rpc: (
      fn: string,
      args: Record<string, unknown>,
    ) => Promise<{ data: unknown; error: { message?: string } | null }>;
  };
  draftId: string;
  name: string;
  slug: string;
  description: string;
  onTrackChannelId: (id: string) => void;
}): Promise<Array<{ data: unknown; error: { message?: string } | null }>>;

export declare function runCommunityLockIsolationScenario(params: {
  spawnLockHolder: () => {
    killed?: boolean;
    kill: () => void;
    stdout?: { on: (ev: "data", cb: (chunk: Buffer | string) => void) => void };
    stderr?: { on: (ev: "data", cb: (chunk: Buffer | string) => void) => void };
    once: (ev: "error" | "exit", cb: (...args: unknown[]) => void) => void;
  };
  probeControlWrite: (
    attempt: number,
  ) => Promise<{ error: { code?: string; message?: string } | null }>;
  runUnrelatedWrites: () => Promise<
    [
      { error: { code?: string; message?: string } | null },
      { error: { code?: string; message?: string } | null },
    ]
  >;
  probeHoldThresholdMs?: number;
  probeRetryDelayMs?: number;
  maxProbes?: number;
  unrelatedTimeoutMs?: number;
  childSettleTimeoutMs?: number;
}): Promise<{
  probesAttempted: number;
  holderPid: number;
  blockedControlPid: number;
  dbLockVerifiedAtStart: boolean;
  dbLockVerifiedAfterUnrelatedWindow: boolean;
  unrelatedElapsedMs: number;
  controlElapsedMs: number;
  directSend: string;
  groupSend: string;
  controlSend: string;
}>;

export declare class StagingCleanupVerifier {
  runStep(label: string, fn: () => Promise<unknown>): Promise<void>;
  cleanupAndVerifyChannel(
    admin: unknown,
    ownerClient: unknown,
    channelId: string | undefined,
  ): Promise<void>;
  verifyRowAbsent(admin: unknown, table: string, id: string, bucketKey: string): Promise<void>;
  verifyUserAbsent(admin: unknown, userId: string): Promise<void>;
  verifyObjectAbsent(admin: unknown, bucket: string, objectPath: string): Promise<void>;
  verifyBucketAbsent(admin: unknown, bucket: string): Promise<void>;
  emitSummary(
    opts: { suite: string; origin: string; passed: boolean; metrics?: Record<string, unknown> },
    logFn?: (line: string) => void,
  ): {
    suite: string;
    targetRef: string;
    origin: string;
    passed: boolean;
    metrics: Record<string, unknown>;
    cleanup: {
      checkedCounts: Record<string, number>;
      cleanupErrors: string[];
      leftovers: string[];
    };
  };
}
