// Local Docker only. Two independent sessions contend for the tenth active story.
import assert from "node:assert/strict";
import { execFileSync, spawn } from "node:child_process";

const container =
  process.env.SUPABASE_TEST_CONTAINER ?? "supabase_db_silverchat-backend-validation";
const args = [
  "exec",
  "-i",
  container,
  "psql",
  "-X",
  "-qAt",
  "-U",
  "postgres",
  "-d",
  "postgres",
  "-v",
  "ON_ERROR_STOP=1",
];
const sql = (text) => execFileSync("docker", args, { input: text, encoding: "utf8" }).trim();
const uid = "e1111111-1111-4111-8111-111111111111";
const claims = `SELECT set_config('request.jwt.claims','{"sub":"${uid}","role":"authenticated","aal":"aal1"}',true); SET LOCAL ROLE authenticated;`;
const clean = () => sql(`DELETE FROM auth.users WHERE id='${uid}';`);
const session = (text) => {
  const child = spawn("docker", args);
  let output = "";
  child.stdout.on("data", (d) => (output += d));
  child.stderr.on("data", (d) => (output += d));
  child.stdin.end(text);
  return new Promise((resolve) => child.on("close", (code) => resolve({ code, output })));
};
try {
  clean();
  sql(
    `INSERT INTO auth.users(id,email,raw_user_meta_data) VALUES('${uid}','story-concurrency@example.test','{}'); BEGIN; ${claims} DO $$BEGIN FOR i IN 1..9 LOOP PERFORM public.create_story('text',NULL,'Story '||i,'#123456'); END LOOP; END $$; COMMIT;`,
  );
  const first = session(
    `BEGIN; SET application_name='silverchat_story_race'; ${claims} SELECT public.create_story('text',NULL,'Tenth','#123456'); SELECT pg_sleep(2); COMMIT;`,
  );
  for (let i = 0; i < 30; i++) {
    if (
      sql(
        "SELECT count(*) FROM pg_stat_activity WHERE application_name='silverchat_story_race' AND wait_event='PgSleep';",
      ) === "1"
    )
      break;
    if (i === 29) throw new Error("First contender did not acquire story slot");
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  const second = session(
    `BEGIN; ${claims} SELECT public.create_story('text',NULL,'Eleventh','#123456'); COMMIT;`,
  );
  const [winner, loser] = await Promise.all([first, second]);
  assert.equal(winner.code, 0, winner.output);
  assert.notEqual(loser.code, 0);
  assert.match(loser.output, /up to 10 active stories/);
  assert.equal(
    sql(`SELECT count(*) FROM public.stories WHERE user_id='${uid}' AND expires_at>now();`),
    "10",
  );
  console.log("PASS: concurrent story creation serializes; only ten active stories remain.");
} finally {
  clean();
}
