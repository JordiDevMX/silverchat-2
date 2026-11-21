export declare const AUTHORIZED_STAGING_REF: "gffdrrtatxdiucigtwdn";

export declare function parseAuthorizedStagingOrigin(
  envRef: string | undefined,
  rawUrl: string | undefined,
): string;

export declare function createStagingTestUser(params: {
  url: string;
  anonKey: string;
  admin: unknown;
  prefix: string;
  tag: string;
  registeredUserIds: string[];
  createClientFn: unknown;
}): Promise<{ user: { id: string }; token: string; client: unknown }>;

export declare class StagingCleanupVerifier {
  runStep(label: string, fn: () => Promise<unknown>): Promise<void>;
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
