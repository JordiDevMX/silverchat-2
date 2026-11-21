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

/**
 * Recognizes resource-specific absence ("bucket" vs "user") while giving
 * precedence to explicit non-404 HTTP/service failure statuses and rejecting
 * generic upstream/service "not found" errors.
 */
export function isMissingResourceError(error, kind) {
  if (!error || typeof error !== "object") return false;

  const rawStatuses = [error.status, error.statusCode].filter(
    (s) => s !== undefined && s !== null && s !== "",
  );
  let saw404 = false;
  for (const raw of rawStatuses) {
    const num = typeof raw === "number" ? raw : Number(raw);
    if (Number.isFinite(num)) {
      if (num === 404) {
        saw404 = true;
      } else if (num >= 500 || num === 401 || num === 403 || num === 408 || num === 429) {
        return false;
      } else if (num !== 400) {
        // Note: @supabase/storage-js sometimes wraps statusCode "404" in status 400; any other non-404 status fails.
        return false;
      }
    } else if (String(raw) !== "404") {
      return false;
    }
  }

  const msg = typeof error.message === "string" ? error.message.trim() : "";
  const code = typeof error.code === "string" ? error.code.trim().toLowerCase() : "";

  if (/\b(upstream|service|gateway|route|endpoint|proxy|server)\b/i.test(msg)) {
    return false;
  }

  if (kind === "bucket") {
    if (code === "nosuchbucket" || code === "bucket_not_found") return true;
    if (/^(bucket not found|the resource was not found)\.?$/i.test(msg)) return true;
    return saw404 && /\bbucket\b/i.test(msg) && /\bnot found\b/i.test(msg);
  }

  if (kind === "user") {
    if (code === "user_not_found") return true;
    if (/^user not found\.?$/i.test(msg)) return true;
    return saw404 && /\buser\b/i.test(msg) && /\bnot found\b/i.test(msg);
  }

  return false;
}

/**
 * Creates a disposable Staging auth user and registers its ID BEFORE signing in,
 * so partial auth failures still get cleaned up in `finally`.
 */
export async function createStagingTestUser({
  url,
  anonKey,
  admin,
  prefix,
  tag,
  registeredUserIds,
  createClientFn,
}) {
  const suffix = `${Date.now()}_${Math.floor(Math.random() * 10_000)}`;
  const email = `${prefix}-${tag}-${suffix}@example.test`;
  const password = `Srp!${crypto.randomUUID()}`;
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: {
      username: `${prefix.replace(/[^a-z0-9]/gi, "_")}_${tag}_${suffix.slice(-6)}`,
      display_name: tag,
    },
  });
  if (data?.user?.id && Array.isArray(registeredUserIds)) {
    registeredUserIds.push(data.user.id);
  }
  if (error || !data?.user) throw error ?? new Error("createUser failed");

  const client = createClientFn(url, anonKey, { auth: { persistSession: false } });
  const signIn = await client.auth.signInWithPassword({ email, password });
  if (signIn.error || !signIn.data?.session) {
    throw signIn.error ?? new Error("signIn failed");
  }
  return { user: data.user, token: signIn.data.session.access_token, client };
}

/**
 * Registers the draft channel UUID for cleanup BEFORE dispatching concurrent
 * `create_channel` requests, and requires both concurrent calls to succeed with
 * the exact draft UUID.
 */
export async function runConcurrentChannelCreation({
  ownerClient,
  draftId,
  name,
  slug,
  description,
  onTrackChannelId,
}) {
  onTrackChannelId(draftId);
  const payload = {
    p_channel_id: draftId,
    p_name: name,
    p_slug: slug,
    p_description: description,
  };
  const [c1, c2] = await Promise.all([
    ownerClient.rpc("create_channel", payload),
    ownerClient.rpc("create_channel", payload),
  ]);
  assert.ifError(c1.error);
  assert.ifError(c2.error);
  assert.equal(c1.data, draftId, "First concurrent create_channel must return draft UUID");
  assert.equal(c2.data, draftId, "Second concurrent create_channel must return draft UUID");
  return [c1, c2];
}

function withTimeout(promise, ms, label) {
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error(`Timed out after ${ms}ms waiting for ${label}`)), ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

function parseLockObservationRows(stdout) {
  const jsonStart = stdout.indexOf("{");
  if (jsonStart < 0) return null;
  try {
    const parsed = JSON.parse(stdout.slice(jsonStart));
    return Array.isArray(parsed.rows) ? (parsed.rows[0] ?? null) : null;
  } catch {
    return null;
  }
}

/**
 * Runs Scenario 6 (unrelated direct & group sends completing while a community lock
 * is verifiably held in Postgres and blocking a control community write).
 *
 * Enforces strict causal ordering:
 * 1. A control write is dispatched and must remain pending while `confirmLockHeld`
 *    independently confirms in the database that the holder transaction blocks the
 *    control session (`blocked_at_start = true`, `phase1_gate_pid` observed).
 * 2. Only AFTER `confirmLockHeld` resolves with `{ confirmed: true }` (while the
 *    control write is still pending and the holder is still alive) does the harness
 *    dispatch `runUnrelatedWrites()`.
 * 3. Only AFTER both unrelated writes resolve does the harness call
 *    `signalUnrelatedWritesCompleted()`, which triggers the holder to re-verify in
 *    `pg_locks` that the exact same control session is STILL blocked (`blocked_at_end = true`,
 *    `phase3_gate_pid` observed) before releasing the lock.
 */
export async function runCommunityLockIsolationScenario({
  spawnLockHolder,
  probeControlWrite,
  confirmLockHeld,
  runUnrelatedWrites,
  signalUnrelatedWritesCompleted,
  probeHoldThresholdMs = 450,
  probeRetryDelayMs = 200,
  maxProbes = 15,
  unrelatedTimeoutMs = 2500,
  childSettleTimeoutMs = 3000,
}) {
  if (typeof confirmLockHeld !== "function") {
    throw new Error(
      "confirmLockHeld database observer callback is required before dispatching unrelated writes",
    );
  }
  if (typeof signalUnrelatedWritesCompleted !== "function") {
    throw new Error(
      "signalUnrelatedWritesCompleted barrier callback is required to hold the lock through both unrelated writes",
    );
  }

  const scenarioStartPerfMs = performance.now();
  const lockProc = spawnLockHolder();
  let lockStdout = "";
  let lockStderr = "";
  let lockExited = false;
  let lockExitCode = null;
  let lockSpawnError = null;

  lockProc.stdout?.on("data", (d) => {
    lockStdout += d.toString();
  });
  lockProc.stderr?.on("data", (d) => {
    lockStderr += d.toString();
  });

  let rejectEarlyExit;
  const earlyExitPromise = new Promise((_, reject) => {
    rejectEarlyExit = reject;
  });
  // Prevent Node UnhandledPromiseRejection if the child fails before earlyExitPromise is raced/awaited.
  earlyExitPromise.catch(() => {});

  const lockSettledPromise = new Promise((resolve) => {
    lockProc.once("error", (err) => {
      lockExited = true;
      lockSpawnError = err;
      rejectEarlyExit(err);
      resolve({ code: null, error: err });
    });
    lockProc.once("exit", (code) => {
      lockExited = true;
      lockExitCode = code;
      if (code !== 0) {
        rejectEarlyExit(
          new Error(`Lock holder exited ${code}: ${(lockStderr || lockStdout).trim()}`),
        );
      }
      resolve({ code, error: null });
    });
  });

  const sleepOrEarlyChildFailure = (ms) => {
    if (lockSpawnError) return Promise.reject(lockSpawnError);
    if (lockExited && lockExitCode !== 0) {
      return Promise.reject(
        new Error(`Lock holder exited ${lockExitCode}: ${(lockStderr || lockStdout).trim()}`),
      );
    }
    let timer;
    const sleep = new Promise((r) => {
      timer = setTimeout(r, ms);
    });
    return Promise.race([sleep, earlyExitPromise]).finally(() => clearTimeout(timer));
  };

  try {
    let activeControl = null;
    let controlResolved = false;
    let probesAttempted = 0;
    let lockConfirmedAtElapsedMs = null;

    for (let attempt = 0; attempt < maxProbes && !lockExited; attempt++) {
      probesAttempted++;
      controlResolved = false;
      const tStart = performance.now();
      const promise = Promise.resolve()
        .then(() => probeControlWrite(attempt + 1))
        .then((res) => {
          controlResolved = true;
          return { res, elapsedMs: Math.round(performance.now() - tStart) };
        });

      await sleepOrEarlyChildFailure(probeHoldThresholdMs);
      if (!controlResolved && !lockExited) {
        // Control request is in-flight; wait for independent database confirmation that
        // the holder blocks the control session BEFORE dispatching unrelated writes.
        for (let cTry = 0; cTry < 12 && !controlResolved && !lockExited; cTry++) {
          const confirmation = await Promise.race([
            Promise.resolve().then(() => confirmLockHeld(attempt + 1)),
            earlyExitPromise,
          ]);
          if (confirmation?.confirmed === true && !controlResolved && !lockExited) {
            activeControl = promise;
            lockConfirmedAtElapsedMs = Math.round(performance.now() - scenarioStartPerfMs);
            break;
          }
          if (!controlResolved && !lockExited) {
            await sleepOrEarlyChildFailure(probeRetryDelayMs);
          }
        }
        if (activeControl) break;
      }
      const fastOutcome = await withTimeout(
        promise,
        unrelatedTimeoutMs,
        "unconfirmed control probe",
      );
      assert.ifError(fastOutcome.res?.error);
      if (!lockExited) {
        await sleepOrEarlyChildFailure(probeRetryDelayMs);
      }
    }

    if (lockSpawnError) throw lockSpawnError;
    if (lockExited && lockExitCode !== 0) {
      throw new Error(`Lock holder exited ${lockExitCode}: ${(lockStderr || lockStdout).trim()}`);
    }
    assert(
      activeControl && !controlResolved && !lockExited && lockConfirmedAtElapsedMs !== null,
      "Expected database observer to confirm holder blocks control session before dispatching unrelated writes",
    );

    const unrelatedDispatchedAtElapsedMs = Math.round(performance.now() - scenarioStartPerfMs);
    assert(
      lockConfirmedAtElapsedMs <= unrelatedDispatchedAtElapsedMs,
      "Database lock confirmation must occur before unrelated writes are dispatched",
    );

    const tUnrelatedStart = performance.now();
    const [directSend, groupSend] = await withTimeout(
      Promise.race([runUnrelatedWrites(), earlyExitPromise]),
      unrelatedTimeoutMs,
      "unrelated direct + group sends under community lock",
    );
    const unrelatedElapsedMs = Math.round(performance.now() - tUnrelatedStart);
    const unrelatedFinishedAtElapsedMs = Math.round(performance.now() - scenarioStartPerfMs);
    assert.ifError(directSend?.error);
    assert.ifError(groupSend?.error);
    assert.equal(
      controlResolved,
      false,
      "Control community insert must still be blocked when unrelated direct & group sends finish",
    );
    assert.equal(
      lockExited,
      false,
      "Community lock holder must still be alive when unrelated sends finish",
    );

    // Signal the lock holder that both unrelated sends have completed so it can take
    // its second pg_locks sample while still holding the community lock, then commit.
    const releaseSignalSentAtElapsedMs = Math.round(performance.now() - scenarioStartPerfMs);
    const [signalRes, settled] = await Promise.all([
      withTimeout(
        Promise.resolve().then(() => signalUnrelatedWritesCompleted()),
        10_000,
        "unrelated writes completion signal",
      ),
      withTimeout(lockSettledPromise, 15_000, "lock holder completion"),
    ]);
    assert.ifError(signalRes?.error);
    if (settled.error) throw settled.error;
    if (settled.code !== 0) {
      throw new Error(`Lock holder exited ${settled.code}: ${(lockStderr || lockStdout).trim()}`);
    }

    const dbObs = parseLockObservationRows(lockStdout);
    assert(
      dbObs &&
        Number.isInteger(Number(dbObs.holder_pid)) &&
        Number(dbObs.holder_pid) > 0 &&
        Number.isInteger(Number(dbObs.blocked_pid)) &&
        Number(dbObs.blocked_pid) > 0 &&
        Number(dbObs.blocked_pid) !== Number(dbObs.holder_pid) &&
        Number.isInteger(Number(dbObs.phase1_gate_pid)) &&
        Number(dbObs.phase1_gate_pid) > 0 &&
        Number.isInteger(Number(dbObs.phase3_gate_pid)) &&
        Number(dbObs.phase3_gate_pid) > 0 &&
        dbObs.blocked_at_start === true &&
        dbObs.blocked_at_end === true,
      `Database lock observation must confirm holder_pid blocked control session across the phase1->phase3 window (got ${JSON.stringify(dbObs)})`,
    );

    if (
      dbObs.first_observed_elapsed_ms !== undefined &&
      dbObs.second_observed_elapsed_ms !== undefined
    ) {
      assert(
        Number(dbObs.first_observed_elapsed_ms) <= unrelatedDispatchedAtElapsedMs &&
          unrelatedFinishedAtElapsedMs <= Number(dbObs.second_observed_elapsed_ms),
        `Database lock observations [${dbObs.first_observed_elapsed_ms}ms, ${dbObs.second_observed_elapsed_ms}ms] must bracket unrelated writes [${unrelatedDispatchedAtElapsedMs}ms, ${unrelatedFinishedAtElapsedMs}ms]`,
      );
    }

    const controlOutcome = await withTimeout(activeControl, 10_000, "control write completion");
    assert.ifError(controlOutcome.res?.error);
    assert(
      controlOutcome.elapsedMs > unrelatedElapsedMs,
      `Control community write (${controlOutcome.elapsedMs}ms) must finish after unrelated sends (${unrelatedElapsedMs}ms)`,
    );

    return {
      probesAttempted,
      holderPid: Number(dbObs.holder_pid),
      blockedControlPid: Number(dbObs.blocked_pid),
      phase1ObserverPid: Number(dbObs.phase1_gate_pid),
      phase3ObserverPid: Number(dbObs.phase3_gate_pid),
      dbLockVerifiedAtStart: dbObs.blocked_at_start === true,
      dbLockVerifiedAfterUnrelatedWindow: dbObs.blocked_at_end === true,
      lockConfirmedAtElapsedMs,
      unrelatedDispatchedAtElapsedMs,
      unrelatedFinishedAtElapsedMs,
      releaseSignalSentAtElapsedMs,
      unrelatedElapsedMs,
      controlElapsedMs: controlOutcome.elapsedMs,
      directSend: directSend?.error ? `err:${directSend.error.code ?? "unknown"}` : "ok",
      groupSend: groupSend?.error ? `err:${groupSend.error.code ?? "unknown"}` : "ok",
      controlSend: controlOutcome.res?.error
        ? `err:${controlOutcome.res.error.code ?? "unknown"}`
        : "ok",
    };
  } finally {
    if (!lockExited && !lockProc.killed) {
      try {
        lockProc.kill();
      } catch {}
    }
    await withTimeout(lockSettledPromise, childSettleTimeoutMs, "child process settle").catch(
      () => {},
    );
  }
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

  /**
   * Deletes a tracked channel row if present (ignoring absence when a test fails
   * before or during creation), then verifies the row is absent in `public.channels`.
   */
  async cleanupAndVerifyChannel(admin, ownerClient, channelId) {
    if (!channelId) return;
    await this.runStep(`delete_channel:${channelId}`, async () => {
      const { data, error } = await admin
        .from("channels")
        .select("id")
        .eq("id", channelId)
        .maybeSingle();
      if (error) return { error };
      if (!data) return { error: null };
      if (ownerClient) {
        const rpc = await ownerClient.rpc("delete_channel", { p_channel_id: channelId });
        if (!rpc.error) return rpc;
      }
      return admin.from("channels").delete().eq("id", channelId);
    });
    await this.verifyRowAbsent(admin, "channels", channelId, "channels");
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
      if (!isMissingResourceError(error, "user")) {
        this.#errors.push(`verify user(${userId}): ${error.message ?? String(error)}`);
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
      this.#errors.push(`verify storage(${label}): ${error.message ?? String(error)}`);
    } else if ((data ?? []).some((item) => item.name === fileName)) {
      this.#leftovers.push(`storage:${label}`);
    }
  }

  async verifyBucketAbsent(admin, bucket) {
    this.#checked.buckets.push(bucket);
    const { data, error } = await admin.storage.getBucket(bucket);
    if (error) {
      if (!isMissingResourceError(error, "bucket")) {
        this.#errors.push(`verify bucket(${bucket}): ${error.message ?? String(error)}`);
      }
      return;
    }
    if (data) {
      this.#leftovers.push(`bucket:${bucket}`);
    }
  }

  emitSummary({ suite, origin, passed: primaryPassed, metrics = {} }, logFn = console.log) {
    const clean = this.#errors.length === 0 && this.#leftovers.length === 0;
    const allPassed = Boolean(primaryPassed) && clean;
    const summary = {
      suite,
      targetRef: AUTHORIZED_STAGING_REF,
      origin,
      passed: allPassed,
      metrics,
      cleanup: {
        checkedCounts: Object.fromEntries(
          Object.entries(this.#checked).map(([k, v]) => [k, v.length]),
        ),
        cleanupErrors: [...this.#errors],
        leftovers: [...this.#leftovers],
      },
    };
    logFn(JSON.stringify(summary));
    if (!clean) {
      throw new Error(
        `Staging cleanup verification failed: errors=${JSON.stringify(this.#errors)}, leftovers=${JSON.stringify(this.#leftovers)}`,
      );
    }
    return summary;
  }
}
