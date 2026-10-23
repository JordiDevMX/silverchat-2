// Local Docker only. Two independent Postgres sessions contend for the final pin slot.
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
const uid = "f1111111-1111-4111-8111-111111111111",
  chat = "f2222222-2222-4222-8222-222222222222";
const ids = [1, 2, 3, 4].map((n) => `f3333333-3333-4333-8333-${String(n).padStart(12, "0")}`);
const claims = `SELECT set_config('request.jwt.claims','{"sub":"${uid}","role":"authenticated","aal":"aal1"}',true); SET LOCAL ROLE authenticated;`;
const clean = () =>
  sql(`DELETE FROM public.chats WHERE id='${chat}'; DELETE FROM auth.users WHERE id='${uid}';`);
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
    `INSERT INTO auth.users(id,email,raw_user_meta_data) VALUES('${uid}','pin-concurrency@example.test','{}'); INSERT INTO public.chats(id,type,name) VALUES('${chat}','group','Pin concurrency'); INSERT INTO public.chat_members(chat_id,user_id) VALUES('${chat}','${uid}'); ${ids.map((id) => `INSERT INTO public.messages(id,chat_id,sender_id,content) VALUES('${id}','${chat}','${uid}','pin');`).join("")} UPDATE public.messages SET is_pinned_in_chat=true WHERE id IN ('${ids[0]}','${ids[1]}');`,
  );
  const first = session(
    `BEGIN; SET application_name='silverchat_pin_race'; ${claims} SELECT public.set_message_pin('${ids[2]}',true); SELECT pg_sleep(2); COMMIT;`,
  );
  for (let i = 0; i < 30; i++) {
    if (
      sql(
        "SELECT count(*) FROM pg_stat_activity WHERE application_name='silverchat_pin_race' AND wait_event='PgSleep';",
      ) === "1"
    )
      break;
    if (i === 29) throw new Error("First contender did not acquire pin slot");
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  const second = session(
    `BEGIN; ${claims} SELECT public.set_message_pin('${ids[3]}',true); COMMIT;`,
  );
  const [winner, loser] = await Promise.all([first, second]);
  assert.equal(winner.code, 0, winner.output);
  assert.notEqual(loser.code, 0);
  assert.match(loser.output, /Cannot pin more than 3 messages/);
  assert.equal(
    sql(`SELECT count(*) FROM public.messages WHERE chat_id='${chat}' AND is_pinned_in_chat;`),
    "3",
  );
  console.log("PASS: concurrent pins serialize; the fourth pin fails and exactly three remain.");
} finally {
  clean();
}
