import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import path from "node:path";

export const AUTHORIZED_STAGING_REF = "gffdrrtatxdiucigtwdn";

export function parseAuthorizedStagingOrigin(envRef, rawUrl) {
  if (envRef && envRef !== AUTHORIZED_STAGING_REF) {
    throw new Error(
      `Refusing unauthorized target ref '${envRef}'; only Staging '${AUTHORIZED_STAGING_REF}' is allowed.`,
    );
  }

  const expectedOrigin = `https://${AUTHORIZED_STAGING_REF}.supabase.co`;
  const candidate = rawUrl ?? expectedOrigin;
  let parsed;
  try {
    parsed = new URL(candidate);
  } catch {
    throw new Error(`Invalid SUPABASE_URL: expected HTTPS origin '${expectedOrigin}'.`);
  }
  if (
    parsed.protocol !== "https:" ||
    parsed.origin !== expectedOrigin ||
    parsed.pathname !== "/" ||
    parsed.search ||
    parsed.hash
  ) {
    throw new Error(
      `SUPABASE_URL '${parsed.href}' does not match authorized Staging origin '${expectedOrigin}'.`,
    );
  }
  return expectedOrigin;
}

/**
 * Binds both SUPABASE_PROJECT_REF and normalized SUPABASE_URL HTTPS origin to
 * the sole authorized Staging project before verifying db-guard or fetching
 * privileged credentials.
 */
export function resolveAuthorizedStagingConfig(rootDir) {
  const expectedOrigin = parseAuthorizedStagingOrigin(
    process.env.SUPABASE_PROJECT_REF,
    process.env.SUPABASE_URL,
  );

  execFileSync(
    process.execPath,
    [path.join(rootDir, "scripts", "db-guard.mjs"), "--expect", AUTHORIZED_STAGING_REF],
    { cwd: rootDir, stdio: "inherit" },
  );

  const cliScript = path.join(rootDir, "node_modules", "supabase", "dist", "supabase.js");
  const keys = JSON.parse(
    execFileSync(
      process.execPath,
      [
        cliScript,
        "--workdir",
        rootDir,
        "projects",
        "api-keys",
        "--project-ref",
        AUTHORIZED_STAGING_REF,
        "-o",
        "json",
      ],
      { encoding: "utf8" },
    ),
  );
  const anonKey = keys.find((k) => k.id === "anon")?.api_key;
  const serviceKey = keys.find((k) => k.id === "service_role")?.api_key;
  assert(anonKey && serviceKey, "Missing Staging API keys");

  return { ref: AUTHORIZED_STAGING_REF, url: expectedOrigin, anonKey, serviceKey };
}

export class StagingCleanupVerifier {
  #errors = [];
  #leftovers = [];
  #checked = {
    channels: [],
    communities: [],
    chats: [],
    uploads: [],
    objects: [],
    buckets: [],
    users: [],
  };

  async runStep(label, fn) {
    try {
      const res = await fn();
      if (res && typeof res === "object" && "error" in res && res.error) {
        this.#errors.push(`${label}: ${res.error.message ?? String(res.error)}`);
      }
    } catch (err) {
      this.#errors.push(`${label}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  async verifyRowAbsent(admin, table, id, bucketKey) {
    if (!id) return;
    this.#checked[bucketKey]?.push(id);
    const { data, error } = await admin.from(table).select("id").eq("id", id).maybeSingle();
    if (error) {
      this.#errors.push(`verify ${table}(${id}): ${error.message}`);
    } else if (data) {
      this.#leftovers.push(`${table}:${id}`);
    }
  }

  async verifyUserAbsent(admin, userId) {
    if (!userId) return;
    this.#checked.users.push(userId);
    const { data, error } = await admin.auth.admin.getUserById(userId);
    if (error) {
      const msg = error.message?.toLowerCase() ?? "";
      if (!msg.includes("not found") && error.status !== 404) {
        this.#errors.push(`verify user(${userId}): ${error.message}`);
      }
      return;
    }
    if (data?.user) {
      this.#leftovers.push(`auth.users:${userId}`);
    }
  }

  async verifyObjectAbsent(admin, bucket, objectPath) {
    const label = `${bucket}/${objectPath}`;
    this.#checked.objects.push(label);
    const slash = objectPath.lastIndexOf("/");
    const folder = slash > 0 ? objectPath.slice(0, slash) : "";
    const fileName = slash >= 0 ? objectPath.slice(slash + 1) : objectPath;
    const { data, error } = await admin.storage.from(bucket).list(folder, { search: fileName });
    if (error) {
      this.#errors.push(`verify storage(${label}): ${error.message}`);
    } else if ((data ?? []).some((item) => item.name === fileName)) {
      this.#leftovers.push(`storage:${label}`);
    }
  }

  async verifyBucketAbsent(admin, bucket) {
    this.#checked.buckets.push(bucket);
    const { data, error } = await admin.storage.getBucket(bucket);
    if (!error && data) {
      this.#leftovers.push(`bucket:${bucket}`);
    }
  }

  emitSummary({ suite, origin, passed, metrics = {} }) {
    const summary = {
      suite,
      targetRef: AUTHORIZED_STAGING_REF,
      origin,
      passed,
      metrics,
      cleanup: {
        checkedCounts: Object.fromEntries(
          Object.entries(this.#checked).map(([k, v]) => [k, v.length]),
        ),
        cleanupErrors: this.#errors,
        leftovers: this.#leftovers,
      },
    };
    console.log(JSON.stringify(summary));
    if (this.#errors.length > 0 || this.#leftovers.length > 0) {
      throw new Error(
        `Staging cleanup verification failed: errors=${JSON.stringify(this.#errors)}, leftovers=${JSON.stringify(this.#leftovers)}`,
      );
    }
  }
}
