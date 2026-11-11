// TASK-012 — migration equivalence verification tooling.
//
// Parses supabase/migrations/*.sql into an expected final-state inventory,
// dumps the LINKED Supabase project via `npx supabase db query --linked`, and
// diffs the two. Read-only: every remote statement executed is a SELECT.
//
//   node scripts/verify-migrations/verify-migrations.mjs           # parse + print inventory
//   node scripts/verify-migrations/verify-migrations.mjs run       # dump the linked project
//   node scripts/verify-migrations/verify-migrations.mjs compare   # diff dump vs. files
//
// The target is the currently linked project (supabase/.temp/project-ref);
// output files are named per target so a Staging dump never overwrites the
// Production evidence. See scripts/verify-migrations/README.md.

// biome-ignore-all lint/suspicious/noAssignInExpressions: the parsers below use the
// match-and-test idiom (`if ((m = re.exec(src)))`) throughout; every assignment is
// deliberate and used immediately in the branch it guards.
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { canonExpr, canonExprLoose, relNames } from "./canon.mjs";

const ROOT = process.cwd();
const MIG = path.join(ROOT, "supabase", "migrations");
const OUT = path.join(ROOT, ".migration-verification");

// Target = currently linked Supabase project. Evidence files are named per
// target so a Staging dump never overwrites the Production evidence.
const PROD_REF = "lmzbaxlojgsdwgcxkmzx";
let TARGET = "unknown";
try {
  TARGET = fs.readFileSync(path.join(ROOT, "supabase", ".temp", "project-ref"), "utf8").trim();
} catch {}
const DUMP_SQL = path.join(OUT, `dump-${TARGET}.sql`);
const DUMP_JSON = path.join(OUT, `dump-${TARGET}.json`);
const REPORT = path.join(OUT, `equivalence-report-${TARGET}.txt`);

// ---------- SQL text scanning ----------
// Strip line comments (-- to EOL) and block comments outside dollar-quotes and single quotes.
function stripComments(sql) {
  let out = "",
    i = 0,
    n = sql.length,
    dollar = null,
    inS = false;
  while (i < n) {
    const c = sql[i],
      two = sql.slice(i, i + 2);
    if (dollar) {
      if (sql.startsWith(dollar, i)) {
        out += dollar;
        i += dollar.length;
        dollar = null;
        continue;
      }
      out += c;
      i++;
      continue;
    }
    if (inS) {
      if (c === "'") {
        if (sql[i + 1] === "'") {
          out += "''";
          i += 2;
          continue;
        }
        inS = false;
      }
      out += c;
      i++;
      continue;
    }
    if (c === "$") {
      const m = sql.slice(i).match(/^\$[a-zA-Z0-9_]*\$/);
      if (m) {
        dollar = m[0];
        out += dollar;
        i += dollar.length;
        continue;
      }
    }
    if (c === "'") {
      inS = true;
      out += c;
      i++;
      continue;
    }
    if (two === "--") {
      while (i < n && sql[i] !== "\n") i++;
      continue;
    }
    if (two === "/*") {
      const e = sql.indexOf("*/", i + 2);
      i = e === -1 ? n : e + 2;
      continue;
    }
    out += c;
    i++;
  }
  return out;
}
function splitStatements(sql) {
  const stmts = [];
  let cur = "",
    dollar = null,
    inS = false;
  for (let i = 0; i < sql.length; i++) {
    const c = sql[i];
    if (dollar) {
      if (sql.startsWith(dollar, i)) {
        cur += dollar;
        i += dollar.length - 1;
        dollar = null;
        continue;
      }
      cur += c;
      continue;
    }
    if (inS) {
      cur += c;
      if (c === "'") {
        if (sql[i + 1] === "'") {
          cur += "'";
          i++;
        } else inS = false;
      }
      continue;
    }
    if (c === "$") {
      const m = sql.slice(i).match(/^\$[a-zA-Z0-9_]*\$/);
      if (m) {
        dollar = m[0];
        cur += dollar;
        i += dollar.length - 1;
        continue;
      }
    }
    if (c === "'") {
      inS = true;
      cur += c;
      continue;
    }
    if (c === ";") {
      stmts.push(cur);
      cur = "";
      continue;
    }
    cur += c;
  }
  if (cur.trim()) stmts.push(cur);
  return stmts;
}
// index of ')' matching the '(' at i; returns -1 if unbalanced
function matchParen(s, i) {
  let depth = 0,
    dollar = null,
    inS = false;
  for (let j = i; j < s.length; j++) {
    const c = s[j];
    if (dollar) {
      if (s.startsWith(dollar, j)) {
        j += dollar.length - 1;
        dollar = null;
        continue;
      }
      continue;
    }
    if (inS) {
      if (c === "'") {
        if (s[j + 1] === "'") {
          j++;
          continue;
        }
        inS = false;
      }
      continue;
    }
    if (c === "$") {
      const m = s.slice(j).match(/^\$[a-zA-Z0-9_]*\$/);
      if (m) {
        dollar = m[0];
        j += dollar.length - 1;
        continue;
      }
    }
    if (c === "'") {
      inS = true;
      continue;
    }
    if (c === "(") depth++;
    else if (c === ")") {
      depth--;
      if (depth === 0) return j;
    }
  }
  return -1;
}
// split on top-level commas
function splitTop(s) {
  const parts = [];
  let depth = 0,
    dollar = null,
    inS = false,
    cur = "";
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (dollar) {
      cur += c;
      if (s.startsWith(dollar, i)) {
        cur += dollar;
        i += dollar.length - 1;
        dollar = null;
      }
      continue;
    }
    if (inS) {
      cur += c;
      if (c === "'") {
        if (s[i + 1] === "'") {
          cur += "'";
          i++;
        } else inS = false;
      }
      continue;
    }
    if (c === "$") {
      const m = s.slice(i).match(/^\$[a-zA-Z0-9_]*\$/);
      if (m) {
        dollar = m[0];
        cur += dollar;
        i += dollar.length - 1;
        continue;
      }
    }
    if (c === "'") {
      inS = true;
      cur += c;
      continue;
    }
    if (c === "(") depth++;
    if (c === ")") depth--;
    if (c === "," && depth === 0) {
      parts.push(cur);
      cur = "";
      continue;
    }
    cur += c;
  }
  if (cur.trim()) parts.push(cur);
  return parts.map((p) => p.trim()).filter(Boolean);
}
const norm = (s) => s.toLowerCase().replace(/\s+/g, " ").trim();
const squash = (s) => s.toLowerCase().replace(/\s+/g, "");

// Canonical form for SQL expressions lives in canon.mjs (shared with the
// debug helpers so both sides are canonicalized identically).
function normType(t) {
  let x = squash(t).replace(/public\./g, "");
  const _map = {
    timestamptz: "timestampwithtimezone",
    timestampwithtimezone: "timestampwithtimezone",
    int: "integer",
    bool: "boolean",
    varchar: "charactervarying",
    charactervarying: "charactervarying",
  };
  x = x.replace(/\btimestamptz\b/g, "timestamp with time zone").replace(/\s+/g, "");
  x = x
    .replace(/\bint\b/g, "integer")
    .replace(/\bbool\b/g, "boolean")
    .replace(/\bvarchar\b/g, "charactervarying")
    .replace(/^public\./, "");
  return x;
}
function normArg(a) {
  let x = squash(a.replace(/^public\./, ""))
    .replace(/timestamptz/g, "timestampwithtimezone")
    .replace(/timestampwithtimezone/g, "timestampwithtimezone");
  x = x.replace(/int(eger)?\b/g, "integer").replace(/\bbool(ean)?\b/g, "boolean");
  x = x.replace(/timestampwithtimezone/g, "tz");
  return x;
}
// Type-only token check: first token of an argument is a type (nameless) or a parameter name (named).
const TYPE_TOKEN_RE =
  /^(public\.)?(uuid|text|boolean|bool|int|integer|smallint|bigint|numeric|real|double|jsonb|json|timestamptz|timestamp|date|interval|bytea|char|varchar|character|record|trigger|void|oid|anyarray|anyelement|regprocedure|chat_type|chat_status|chat_member_role|message_type|call_type|call_status|chat_request_status|report_status|story_media_type|theme_preference)(\[\])?$/i;
function normFnSig(argsRaw) {
  if (!argsRaw?.trim()) return "";
  return splitTop(argsRaw.replace(/^\(/, "").replace(/\)\s*$/, ""))
    .map((raw) => {
      let a = raw.trim();
      const hasDefault = /\bdefault\b/i.test(a);
      a = a.replace(/\bdefault\s+[\s\S]*$/i, "").trim();
      a = a.replace(/^(in|out|inout|variadic)\s+/i, "");
      const toks = a.split(/\s+/);
      if (toks.length > 1 && !TYPE_TOKEN_RE.test(toks[0])) toks.shift(); // drop param name
      return normArg(toks.join(" ")) + (hasDefault ? "=d" : "");
    })
    .join(",");
}
const normBody = (s) =>
  s
    .replace(/\r\n/g, "\n")
    .replace(/[ \t]+$/gm, "")
    .trim();

// Quote-aware ARRAY[...] content extractor: finds the closing ] that is not
// inside a single-quoted literal (array items like 'f(uuid[])' contain brackets).
function extractArray(st) {
  const open = st.search(/ARRAY\s*\[/i);
  if (open < 0) return null;
  let i = st.indexOf("[", open),
    inQ = false;
  for (; i < st.length; i++) {
    const c = st[i];
    if (inQ) {
      if (c === "'") {
        if (st[i + 1] === "'") {
          i++;
          continue;
        }
        inQ = false;
      }
      continue;
    }
    if (c === "'") inQ = true;
    else if (c === "]") return st.slice(st.indexOf("[", open) + 1, i);
  }
  return null;
}

// All ARRAY[...] contents in a statement (quote-aware).
function extractAllArrays(st) {
  const out = [];
  let idx = 0;
  while (idx < st.length) {
    const rest = st.slice(idx);
    const m = rest.match(/ARRAY\s*\[/i);
    if (!m) break;
    const openIdx = idx + rest.indexOf("[", m.index);
    let i = openIdx + 1,
      inQ = false,
      end = -1;
    for (; i < st.length; i++) {
      const c = st[i];
      if (inQ) {
        if (c === "'") {
          if (st[i + 1] === "'") {
            i++;
            continue;
          }
          inQ = false;
        }
        continue;
      }
      if (c === "'") inQ = true;
      else if (c === "]") {
        end = i;
        break;
      }
    }
    if (end < 0) break;
    out.push(st.slice(openIdx + 1, end));
    idx = end + 1;
  }
  return out;
}

// ---------- inventory state ----------
const inv = {
  functions: {}, // key: name+'/'+sig -> rec
  tables: {}, // name -> {columns:{col:{type,notnull,default}}, constraints:Set, named}
  triggers: {}, // name -> rec
  policies: {}, // key: table+'/'+name -> rec
  indexes: {}, // name -> rec
  pubAdds: {}, // pub -> Set(table)
  cron: {}, // jobname -> {schedule, cmd, times}
  privs: [], // expected privilege statements
  enums: {}, // name -> labels[]
  views: {}, // name -> {opts:string[]}
  extensions: [], // extension names
  appConfig: {}, // key -> JSON value
  checkCounts: {}, // table -> inline+named CHECK count
  fks: [], // {table, cols[], ref, refCols[], del, upd}
  uniques: [], // {table, cols[]}
  pks: [], // {table, cols[]}
  other: [], // unclassified statements
  rlsTables: [],
};
function setTable(name) {
  if (!inv.tables[name]) inv.tables[name] = { columns: {}, constraints: new Set() };
  return inv.tables[name];
}
function handleDoBlock(st) {
  // 0004: mfa_assurance_required restrictive policy on every public table existing at this point.
  // (Runs before the ARRAY check — this block iterates pg_tables, not a literal array.)
  if (/CREATE\s+POLICY\s+mfa_assurance_required\s+ON\s+public\.%I/i.test(st)) {
    const expr = "(SELECT public.auth_mfa_satisfied())";
    for (const t of Object.keys(inv.tables)) {
      inv.policies[`public.${t}/mfa_assurance_required`] = {
        table: `public.${t}`,
        name: "mfa_assurance_required",
        permissive: "RESTRICTIVE",
        cmd: "ALL",
        roles: ["authenticated"],
        using: expr,
        withCheck: expr,
      };
    }
    return true;
  }
  // Publication table adds (static literal and dynamic public.%I forms) — 0003/0008/0010.
  let pubHandled = false;
  if (/ALTER\s+PUBLICATION\s+\w+\s+ADD\s+TABLE/i.test(st)) {
    if (scanPublicationAdds(st)) pubHandled = true;
    if (/ADD\s+TABLE\s+public\.%I/i.test(st)) {
      for (const arrC of extractAllArrays(st)) {
        for (const x of (arrC.match(/'([^']+)'/g) || []).map((y) => y.slice(1, -1))) {
          if (!/^\w+$/.test(x)) continue; // function-signature items are not tables
          inv.pubAdds.supabase_realtime ||= [];
          if (!inv.pubAdds.supabase_realtime.includes(x)) inv.pubAdds.supabase_realtime.push(x);
          pubHandled = true;
        }
      }
    }
  }
  // 0005/0007: create_direct_chat_request body rewrites via pg_get_functiondef.
  // (No ARRAY[...] in these blocks; must be handled before the generic checks.)
  if (/create_direct_chat_request\(uuid,text\)'::regprocedure/i.test(st)) {
    const f = inv.functions["create_direct_chat_request/uuid,text"];
    if (f) {
      const apply = (b, find, repl, tag) => {
        if (!b.includes(find)) {
          console.error(`REWRITE-MISS ${tag}`);
          return b;
        }
        return b.split(find).join(repl);
      };
      let b = f.body;
      // The rewrites are applied to the body, not to the statement text: a
      // corrective migration that repeats 0005's rewrite finds the body
      // already rewritten and must leave it alone (same guard the migration
      // itself uses).
      if (b.includes("Initial message cannot be empty")) {
        b = apply(
          b,
          "  IF p_initial_content IS NULL OR btrim(p_initial_content) = '' THEN\n    RAISE EXCEPTION 'Initial message cannot be empty';\n  END IF;",
          "  IF p_initial_content IS NULL THEN RAISE EXCEPTION 'Initial content must not be null'; END IF;",
          "0005-empty-check",
        );
        b = apply(
          b,
          "  INSERT INTO public.messages(chat_id, sender_id, content)\n    VALUES (v_chat.id, v_user, p_initial_content);",
          "  IF btrim(p_initial_content) <> '' THEN\n    INSERT INTO public.messages(chat_id, sender_id, content)\n      VALUES (v_chat.id, v_user, p_initial_content);\n  END IF;",
          "0005-insert-wrap",
        );
      }
      if (
        b.includes(
          "  IF FOUND AND v_chat.status IN ('active', 'pending_request') THEN\n    RETURN v_chat.id;",
        )
      ) {
        b = apply(
          b,
          "  IF FOUND AND v_chat.status IN ('active', 'pending_request') THEN\n    RETURN v_chat.id;",
          "  IF FOUND AND v_chat.status IN ('active', 'pending_request') THEN\n    IF v_chat.status = 'active' THEN\n      INSERT INTO public.chat_members(chat_id,user_id) VALUES(v_chat.id,v_user) ON CONFLICT DO NOTHING;\n    END IF;\n    RETURN v_chat.id;",
          "0007-found-rewrite",
        );
      }
      f.body = normBody(b);
    }
    return true;
  }
  const arrC = extractArray(st);
  if (arrC === null) return pubHandled;
  const names = (arrC.match(/'([^']+)'/g) || []).map((s) => s.slice(1, -1));
  if (!names.length) return pubHandled;
  if (/ENABLE\s+ROW\s+LEVEL\s+SECURITY/i.test(st)) {
    inv.rlsTables.push(...names);
    return true;
  }
  if (
    /REVOKE\s+ALL\s+ON\s+public\.%I/i.test(st) &&
    /GRANT\s+SELECT\s+ON\s+public\.%I\s+TO\s+authenticated/i.test(st)
  ) {
    for (const t of names) {
      for (const p of ["SELECT", "INSERT", "UPDATE", "DELETE", "TRUNCATE", "REFERENCES", "TRIGGER"])
        for (const g of ["public", "anon", "authenticated"])
          inv.privs.push({
            kind: "TABLE",
            target: t,
            priv: p,
            cols: null,
            grantee: g,
            expected: false,
          });
      inv.privs.push({
        kind: "TABLE",
        target: t,
        priv: "SELECT",
        cols: null,
        grantee: "authenticated",
        expected: true,
      });
    }
    return true;
  }
  if (/INSERT\s+INTO/i.test(st)) return true; // data seed (e.g. app_config rows) — not schema
  // 0004: MFA-raise injection before the identity guard in RPC definitions.
  if (
    /pg_get_functiondef\(\('public\.' \|\| signature\)::regprocedure\)/i.test(st) &&
    /IF v_user IS NULL THEN/.test(st) &&
    /auth_mfa_satisfied/i.test(st)
  ) {
    const INJECT =
      "IF NOT public.auth_mfa_satisfied() THEN RAISE EXCEPTION 'MFA required' USING ERRCODE = '42501'; END IF; IF v_user IS NULL THEN";
    const arr = extractArray(st) || "";
    for (const s of (arr.match(/'([^']+)'/g) || []).map((x) => x.slice(1, -1))) {
      const nm = s.slice(0, s.indexOf("("));
      const sig = normFnSig(s.slice(s.indexOf("(") + 1).replace(/\)$/, "")).replace(/=d/g, "");
      const f = inv.functions[`${nm}/${sig}`];
      if (f?.body.includes("IF v_user IS NULL THEN"))
        f.body = normBody(f.body.replace("IF v_user IS NULL THEN", INJECT));
      else if (!f) console.error(`INJECT-MISS ${nm}/${sig} from ${JSON.stringify(s)}`);
      else if (!f.body.includes("IF v_user IS NULL THEN"))
        console.error(`INJECT-NOGUARD ${nm}/${sig}`);
    }
    return true;
  }
  // 0004: boolean helper bodies wrapped with the MFA gate.
  if (
    /SELECT public\.auth_mfa_satisfied\(\) AND \('/i.test(st) &&
    /regexp_replace\(source/i.test(st)
  ) {
    const arr = extractArray(st) || "";
    for (const s of (arr.match(/'([^']+)'/g) || []).map((x) => x.slice(1, -1))) {
      const nm = s.slice(0, s.indexOf("("));
      const sig = normFnSig(s.slice(s.indexOf("(") + 1).replace(/\)$/, "")).replace(/=d/g, "");
      const f = inv.functions[`${nm}/${sig}`];
      if (f)
        f.body = normBody(
          `SELECT public.auth_mfa_satisfied() AND (${f.body.replace(/[;\s]*$/, "")})`,
        );
    }
    return true;
  }
  // 0004: mfa_assurance_required restrictive policy on every public table existing at this point.
  // (duplicate handler removed — see top of handleDoBlock)
  // Function-ACL DO blocks (0003/0010/0012): per-list REVOKE ALL / GRANT EXECUTE loops.
  let aclHandled = false;
  if (
    /REVOKE\s+ALL\s+ON\s+FUNCTION\s+public\.'\s*\|\|\s*\w+/i.test(st) ||
    /GRANT\s+EXECUTE\s+ON\s+FUNCTION\s+public\.'\s*\|\|\s*\w+/i.test(st)
  ) {
    const parts = st.split(/FOREACH\s+\w+\s+IN\s+ARRAY\s/i).slice(1);
    let pushed = false;
    for (const part of parts) {
      const arrC = extractArray(part);
      if (arrC === null) continue;
      const fns = (arrC.match(/'([^']+)'/g) || []).map((x) => x.slice(1, -1));
      const grantAuth =
        /GRANT\s+EXECUTE\s+ON\s+FUNCTION\s+public\.'\s*\|\|\s*\w+\s*\|\|\s*'\s+TO\s+authenticated/i.test(
          part,
        );
      const revokeM = part.match(
        /REVOKE\s+ALL\s+ON\s+FUNCTION\s+public\.'\s*\|\|\s*\w+\s*\|\|\s*'\s+FROM\s+([^;]+?)\s*;/i,
      );
      const revokeRoles = revokeM ? revokeM[1].split(",").map((r) => r.trim().toLowerCase()) : [];
      for (const f of fns) {
        const open = f.indexOf("(");
        const nm = f.slice(0, open).replace(/^public\./, "");
        const sig = normFnSig(f.slice(open + 1).replace(/\)\s*$/, "")).replace(/=d/g, "");
        for (const r of revokeRoles) {
          inv.privs.push({
            kind: "FUNCTION",
            target: `${nm}(${f.slice(open + 1).replace(/\)\s*$/, "")})`,
            priv: "EXECUTE",
            cols: null,
            grantee: r,
            expected: false,
          });
          pushed = true;
        }
        if (grantAuth) {
          inv.privs.push({
            kind: "FUNCTION",
            target: `${nm}(${f.slice(open + 1).replace(/\)\s*$/, "")})`,
            priv: "EXECUTE",
            cols: null,
            grantee: "authenticated",
            expected: true,
          });
          pushed = true;
        }
        void sig;
      }
    }
    if (pushed) aclHandled = true;
  }
  // Publication ADD TABLE (DO blocks 0003/0008/0010, and static statements via main loop).
  const pubCount = scanPublicationAdds(st);
  return aclHandled || pubHandled || (pubCount > 0 && st.trim().toUpperCase().startsWith("DO"));
}
function scanPublicationAdds(st) {
  const pubM = [
    ...st.matchAll(/ALTER\s+PUBLICATION\s+(supabase_realtime)\s+ADD\s+TABLE\s+public\.(\w+)/gi),
  ];
  if (!pubM.length) return 0;
  inv.pubAdds.supabase_realtime ||= [];
  for (const m of pubM)
    if (!inv.pubAdds.supabase_realtime.includes(m[2])) inv.pubAdds.supabase_realtime.push(m[2]);
  return pubM.length;
}

function parseFunction(stmt) {
  const m = stmt.match(/^CREATE\s+(OR\s+REPLACE\s+)?FUNCTION\s+([\w.]+)\s*\(/i);
  if (!m) return false;
  const name = m[2].split(".").pop();
  const open = stmt.indexOf("(", m.index + m[0].length - 1);
  const close = matchParen(stmt, open);
  const argsRaw = stmt.slice(open + 1, close);
  const rest = stmt.slice(close + 1);
  const asM = rest.match(/AS\s+(\$[a-zA-Z0-9_]*\$)/i);
  if (!asM) throw new Error(`no AS tag: ${name}`);
  const tag = asM[1];
  const _bodyStart = rest.indexOf(tag, asM.index + tag.length - 1); // find body start: next occurrence of tag
  const bStart = rest.indexOf(tag, asM.index) + tag.length;
  const bEnd = rest.indexOf(tag, bStart);
  const body = rest.slice(bStart, bEnd);
  const attrs = rest.slice(0, asM.index);
  const retM = attrs.match(/RETURNS\s+([\s\S]+?)\s+LANGUAGE\s/i);
  const langM = attrs.match(/LANGUAGE\s+(plpgsql|sql|plpython3u|internal)/i);
  const key = `${name}/${normFnSig(argsRaw).replace(/=d/g, "")}`;
  inv.functions[key] = {
    name,
    sig: normFnSig(argsRaw),
    argsRaw: argsRaw.replace(/\s+/g, " ").trim(),
    rettype: normType(retM ? retM[1] : ""),
    language: langM ? langM[1].toLowerCase() : "",
    volatility: /IMMUTABLE/i.test(attrs) ? "i" : /STABLE/i.test(attrs) ? "s" : "v",
    isStrict: /\bSTRICT\b/i.test(attrs),
    isSecdef: /SECURITY\s+DEFINER/i.test(attrs),
    searchPath: (() => {
      const sm = attrs.match(/SET\s+search_path\s*=\s*('(?:[^']*)'|[\w$.,\s]+?)(?=\s*(?:,|$)|\n)/i);
      if (!sm) return null;
      const v = sm[1].startsWith("'") ? sm[1].slice(1, -1) : sm[1];
      return squash(v) === "" ? "" : squash(v);
    })(),
    body: normBody(body),
    nDefaults: (argsRaw.match(/\bdefault\b/gi) || []).length,
  };
  return true;
}
function parseTrigger(stmt) {
  const m = stmt.match(
    /^CREATE\s+(?:OR\s+REPLACE\s+)?(?:CONSTRAINT\s+)?TRIGGER\s+(\w+)\s+([\s\S]+)$/i,
  );
  if (!m) return false;
  const name = m[1];
  const rest = m[2];
  const onIdx = rest.search(/\bON\s/i);
  const timing = rest.slice(0, onIdx).replace(/\s+/g, " ").trim();
  const rest2 = rest.slice(onIdx).replace(/^ON\s+/i, "");
  const ws = rest2.match(/^[\w.]+/)[0];
  const table = ws;
  const rest3 = rest2.slice(ws.length);
  const execIdx = rest3.search(/EXECUTE\s+(FUNCTION|PROCEDURE)/i);
  let pre = rest3.slice(0, execIdx);
  const fnM = rest3.slice(execIdx).match(/EXECUTE\s+(?:FUNCTION|PROCEDURE)\s+([\w.]+)\s*\(/i);
  const whenM = pre.match(/WHEN\s*\(/i);
  let when = "";
  if (whenM) {
    const wOpen = rest3.indexOf("(", whenM.index);
    const wClose = matchParen(rest3, wOpen);
    when = squash(rest3.slice(wOpen + 1, wClose));
    pre = rest3.slice(0, whenM.index);
  }
  inv.triggers[name] = {
    name,
    table,
    timing: norm(timing),
    eachRow: /FOR\s+EACH\s+ROW/i.test(pre),
    when,
    fn: fnM[1],
  };
  return true;
}
function parsePolicy(stmt) {
  const m = stmt.match(
    /^CREATE\s+(?:OR\s+REPLACE\s+)?POLICY\s+("?[\w]+"?)\s+ON\s+([\w.]+)\s*([\s\S]+)$/i,
  );
  if (!m) return false;
  const [, nameRaw, table, rest] = m;
  const name = nameRaw.replace(/"/g, "");
  const permissive = /AS\s+RESTRICTIVE/i.test(rest) ? "RESTRICTIVE" : "PERMISSIVE";
  const forM = rest.match(/FOR\s+(ALL|SELECT|INSERT|UPDATE|DELETE)/i);
  const toM = rest.match(/TO\s+([\w,\s"]+?)(?=\s+USING|\s+WITH|\s*$|\s+FOR)/i);
  const usingIdx = rest.search(/\bUSING\s*\(/i);
  const withIdx = rest.search(/\bWITH\s+CHECK\s*\(/i);
  const grab = (idx) => {
    if (idx < 0) return null;
    const o = rest.indexOf("(", idx);
    const c = matchParen(rest, o);
    return rest.slice(o + 1, c).trim();
  };
  inv.policies[`${table}/${name}`] = {
    table,
    name,
    permissive,
    cmd: forM ? forM[1].toUpperCase() : "ALL",
    roles: toM ? toM[1].replace(/\s+/g, "").split(",") : [],
    using: grab(usingIdx),
    withCheck: grab(withIdx),
  };
  return true;
}
function parseIndex(stmt) {
  const m = stmt.match(
    /^CREATE\s+(UNIQUE\s+)?INDEX\s+(?:CONCURRENTLY\s+)?(?:IF\s+NOT\s+EXISTS\s+)?(\w+)\s+ON\s+([\w.]+)\s*([\s\S]*)$/i,
  );
  if (!m) return false;
  let rest = m[4];
  const usM = rest.match(/^USING\s+(\w+)\s*/i);
  const method = usM ? usM[1].toLowerCase() : "btree";
  if (usM) rest = rest.slice(usM[0].length);
  const o = rest.indexOf("(");
  const c = matchParen(rest, o);
  const cols = squash(rest.slice(o + 1, c));
  rest = rest.slice(c + 1);
  const wM = rest.match(/WHERE\s+([\s\S]+?)\s*;?\s*$/i);
  inv.indexes[m[2]] = {
    name: m[2],
    table: m[3],
    unique: !!m[1],
    method,
    cols,
    where: wM ? wM[1].trim() : "",
  };
  return true;
}
function parseCreateTable(stmt) {
  const m = stmt.match(/^CREATE\s+TABLE\s+(IF\s+NOT\s+EXISTS\s+)?([\w.]+)\s*\(/i);
  if (!m) return false;
  const name = m[2].split(".").pop();
  const open = stmt.indexOf("(", m.index + m[0].length - 1);
  const close = matchParen(stmt, open);
  const items = splitTop(stmt.slice(open + 1, close));
  const t = setTable(name);
  const bumpChecks = (n) => {
    if (n) inv.checkCounts[name] = (inv.checkCounts[name] || 0) + n;
  };
  const addFk = (cols, clause) => {
    const f = parseFkClause(clause);
    if (f) inv.fks.push({ table: name, cols: cols.map((c) => c.toLowerCase()), ...f });
  };
  const addUq = (cols) => inv.uniques.push({ table: name, cols: cols.map((c) => c.toLowerCase()) });
  const addPk = (cols) => inv.pks.push({ table: name, cols: cols.map((c) => c.toLowerCase()) });
  const colList = (s) => splitTop(s).map((c) => c.trim().replace(/"/g, ""));
  let m2;
  for (const item of items) {
    bumpChecks((item.match(/\bCHECK\b/gi) || []).length);
    // table-level key constraints
    if ((m2 = item.match(/^(?:CONSTRAINT\s+\w+\s+)?UNIQUE\s*\(([^)]*)\)/i))) {
      addUq(colList(m2[1]));
      continue;
    }
    if ((m2 = item.match(/^(?:CONSTRAINT\s+\w+\s+)?PRIMARY\s+KEY\s*\(([^)]*)\)/i))) {
      addPk(colList(m2[1]));
      for (const c of colList(m2[1])) {
        if (t.columns[c]) t.columns[c].notnull = true;
      }
      continue;
    }
    if ((m2 = item.match(/^(?:CONSTRAINT\s+\w+\s+)?FOREIGN\s+KEY\s*\(([^)]*)\)\s*REFERENCES/i))) {
      addFk(colList(m2[1]), item);
      continue;
    }
    const cm = item.match(/^CONSTRAINT\s+(\w+)/i);
    if (cm) {
      t.constraints.add(cm[1].toLowerCase());
      continue;
    }
    if (/^(PRIMARY\s+KEY|UNIQUE|CHECK|FOREIGN\s+KEY|EXCLUDE)\b/i.test(item)) {
      const pkM = item.match(/^PRIMARY\s+KEY\s*\(([\s\S]+)\)$/i);
      if (pkM)
        for (const c of splitTop(pkM[1])) {
          const col = c.trim().replace(/"/g, "");
          if (t.columns[col]) t.columns[col].notnull = true;
          else t.columns[col] = { type: "", notnull: true, default: "" };
        }
      continue; // unnamed
    }
    const colM =
      item.match(/^"?(]?[\w]+)"?\s+([\s\S]+)$/i) || item.match(/^"([\w]+)"\s+([\s\S]+)$/i);
    if (!colM) {
      inv.other.push(`COL? ${name}: ${item.slice(0, 80)}`);
      continue;
    }
    const col = colM[1],
      def = colM[2];
    if (/\bPRIMARY\s+KEY\b/i.test(def)) addPk([col]);
    if (/(^|\s)UNIQUE(\s|$)/i.test(def)) addUq([col]);
    if (/\bREFERENCES\b/i.test(def)) addFk([col], def);
    const dfltM = def.match(
      /\bDEFAULT\s+([\s\S]+?)(?=\bNOT\s+NULL\b|\bNULL\b|\bUNIQUE\b|\bCHECK\b|\bREFERENCES\b|\bGENERATED\b|$)/i,
    );
    const isNotNull = /\bNOT\s+NULL\b/i.test(def) || /\bPRIMARY\s+KEY\b/i.test(def);
    const dflt = dfltM ? squash(dfltM[1].replace(/::[\w\s]+(\[\])?/g, "")) : "";
    t.columns[col] = {
      type: normType(
        def.split(
          /\bNOT\s+NULL\b|\bNULL\b|\bDEFAULT\b|\bUNIQUE\b|\bCHECK\b|\bREFERENCES\b|\bPRIMARY\s+KEY\b|\bGENERATED\b/i,
        )[0],
      ),
      notnull: isNotNull,
      default: dflt,
    };
  }
  return true;
}
function parseAlterTable(stmt) {
  const m = stmt.match(/^ALTER\s+TABLE\s+(?:IF\s+EXISTS\s+)?(?:ONLY\s+)?([\w.]+)\s+([\s\S]+)$/i);
  if (!m) return false;
  const name = m[1].split(".").pop();
  const t = setTable(name);
  for (const act of splitTop(m[2])) {
    let mm;
    if ((mm = act.match(/ADD\s+COLUMN\s+(?:IF\s+NOT\s+EXISTS\s+)?"?(\w+)"?\s+([\s\S]+)/i))) {
      const def = mm[2];
      if (/\bREFERENCES\b/i.test(def)) {
        const f = parseFkClause(def);
        if (f) inv.fks.push({ table: name, cols: [mm[1].toLowerCase()], ...f });
      }
      if (/\bUNIQUE\b/i.test(def)) inv.uniques.push({ table: name, cols: [mm[1].toLowerCase()] });
      const dfltM = def.match(
        /\bDEFAULT\s+([\s\S]+?)(?=\bNOT\s+NULL\b|\bNULL\b|\bUNIQUE\b|\bCHECK\b|\bREFERENCES\b|\bGENERATED\b|$)/i,
      );
      t.columns[mm[1]] = {
        type: normType(
          def.split(
            /\bNOT\s+NULL\b|\bNULL\b|\bDEFAULT\b|\bUNIQUE\b|\bCHECK\b|\bREFERENCES\b|\bPRIMARY\s+KEY\b|\bGENERATED\b/i,
          )[0],
        ),
        notnull: /\bNOT\s+NULL\b/i.test(def),
        default: dfltM ? squash(dfltM[1].replace(/::[\w\s]+(\[\])?/g, "")) : "",
      };
      continue;
    }
    if ((mm = act.match(/ADD\s+CONSTRAINT\s+(\w+)/i))) {
      t.constraints.add(mm[1].toLowerCase());
      if (/\bCHECK\b/i.test(act)) inv.checkCounts[name] = (inv.checkCounts[name] || 0) + 1;
      if (act.match(/UNIQUE\s*\(([^)]*)\)/i)) {
        const cols = act
          .match(/UNIQUE\s*\(([^)]*)\)/i)[1]
          .split(",")
          .map((c) => c.trim().toLowerCase());
        inv.uniques = inv.uniques.filter(
          (u) => !(u.table === name && u.name === mm[1].toLowerCase()),
        );
        inv.uniques.push({ table: name, cols, name: mm[1].toLowerCase() });
      }
      if (act.match(/PRIMARY\s+KEY\s*\(([^)]*)\)/i)) {
        const cols = act
          .match(/PRIMARY\s+KEY\s*\(([^)]*)\)/i)[1]
          .split(",")
          .map((c) => c.trim().toLowerCase());
        inv.pks = inv.pks.filter((p) => !(p.table === name && p.name === mm[1].toLowerCase()));
        inv.pks.push({ table: name, cols, name: mm[1].toLowerCase() });
      }
      if (/FOREIGN\s+KEY/i.test(act)) {
        const f = parseFkClause(act);
        if (f)
          inv.fks.push({
            table: name,
            cols: (act.match(/FOREIGN\s+KEY\s*\(([^)]*)\)/i) || ["", ""])[1]
              .split(",")
              .map((c) => c.trim().toLowerCase()),
            ...f,
          });
      }
      continue;
    }
    if ((mm = act.match(/DROP\s+COLUMN\s+(?:IF\s+EXISTS\s+)?"?(\w+)"?/i))) {
      delete t.columns[mm[1]];
      continue;
    }
    if ((mm = act.match(/DROP\s+CONSTRAINT\s+(?:IF\s+EXISTS\s+)?(\w+)/i))) {
      const cn = mm[1].toLowerCase();
      t.constraints.delete(cn);
      inv.uniques = inv.uniques.filter((u) => !(u.table === name && u.name === cn));
      inv.pks = inv.pks.filter((p) => !(p.table === name && p.name === cn));
      continue;
    }
    if (
      (mm = act.match(
        /ALTER\s+COLUMN\s+"?(\w+)"?\s+(DROP|SET)\s+(NOT\s+NULL|DEFAULT)(?:\s+([\s\S]+))?$/i,
      ))
    ) {
      const col = t.columns[mm[1]];
      if (!col) continue;
      if (mm[2].toUpperCase() === "DROP" && /NOT/i.test(mm[3])) col.notnull = false;
      else if (mm[2].toUpperCase() === "SET" && /NOT/i.test(mm[3])) col.notnull = true;
      else if (mm[2].toUpperCase() === "DROP") col.default = "";
      else col.default = squash((mm[4] || "").replace(/::[\w\s]+(\[\])?/g, ""));
      continue;
    }
    if ((mm = act.match(/ENABLE\s+ROW\s+LEVEL\s+SECURITY/i))) {
      if (!inv.rlsTables.includes(name)) inv.rlsTables.push(name);
      continue;
    }
    if ((mm = act.match(/RENAME\s+TO\s+(\w+)/i))) {
      inv.tables[mm[1]] = t;
      delete inv.tables[name];
      continue;
    }
    if ((mm = act.match(/ALTER\s+COLUMN\s+("?[\w]+"?)\s+TYPE\s+([\s\S]+)/i))) {
      if (t.columns[mm[1].replace(/"/g, "")])
        t.columns[mm[1].replace(/"/g, "")].type = normType(mm[2].split(/\bUSING\b/i)[0]);
    }
    // other actions (OWNER, ENABLE, SET SCHEMA...) ignored
  }
  return true;
}
function parsePriv(stmt) {
  const m = stmt.match(
    /^(GRANT|REVOKE)\s+([\s\S]+?)\s+ON\s+([A-Z_]+\s+)?([\s\S]+?)\s+(TO|FROM)\s+([\w\s,",]+?)\s*;?$/i,
  );
  if (!m) return false;
  const [, verb, privlist, kindTok, target, _toFrom, grantees] = m;
  const kind = kindTok ? kindTok.trim().toUpperCase() : "TABLE";
  const granteeList = grantees.replace(/"/g, "").replace(/\s+/g, "").split(",");
  for (const t of splitTop(target)) {
    for (const pv of splitTop(privlist)) {
      const pm = pv.match(/^(\w+)\s*(?:\(\s*([\s\S]*?)\s*\))?$/);
      if (!pm) {
        inv.other.push(`PRIV? ${verb} ${pv}`);
        continue;
      }
      const priv = pm[1].toUpperCase();
      const cols = pm[2] ? pm[2].replace(/\s+/g, "").split(",") : null;
      for (const g of granteeList) {
        inv.privs.push({
          kind,
          target: t.replace(/^public\./, ""),
          priv,
          cols,
          grantee: g.toUpperCase() === "PUBLIC" ? "public" : g,
          expected: verb.toUpperCase() === "GRANT",
        });
      }
    }
  }
  return true;
}

// Output column names of a CREATE VIEW ... AS SELECT <list>.
function viewColumns(stmt) {
  const asIdx =
    stmt.search(/\)\s*AS\s+SELECT\b/i) >= 0
      ? stmt.search(/\)\s*AS\s+SELECT\b/i)
      : stmt.search(/\bAS\s+SELECT\b/i);
  if (asIdx < 0) return [];
  const sel = stmt.slice(asIdx);
  const fromIdx = sel.search(/\bFROM\b/i);
  const list = sel.slice(sel.search(/SELECT\b/i) + 6, fromIdx >= 0 ? fromIdx : sel.length);
  return splitTop(list).map((item) => {
    const s = item.trim();
    let m = s.match(/\bAS\s+(\w+)\s*$/i);
    if (m) return m[1].toLowerCase();
    m = s.match(/^(?:[\w]+\.)?(\w+)$/);
    if (m) return m[1].toLowerCase();
    return "<expr>";
  });
}

// Foreign-key clause in a column/table definition.
function parseFkClause(text) {
  const m = String(text || "").match(
    /REFERENCES\s+(?:public\.)?("?[\w.]+"?)\s*\(\s*([^)]*?)\s*\)/i,
  );
  if (!m) return null;
  const rest = String(text).slice(m.index + m[0].length);
  const pick = (kw) => {
    const mm = rest.match(
      new RegExp(`ON\\s+${kw}\\s+(CASCADE|SET\\s+NULL|SET\\s+DEFAULT|RESTRICT|NO\\s+ACTION)`, "i"),
    );
    return mm ? mm[1].toUpperCase().replace(/\s+/g, " ") : "NO ACTION";
  };
  return {
    ref: m[1].replace(/"/g, "").split(".").pop().toLowerCase(),
    refCols: m[2].split(",").map((c) => c.trim().replace(/"/g, "").toLowerCase()),
    del: pick("DELETE"),
    upd: pick("UPDATE"),
  };
}

// ---------- process files ----------
const files = fs
  .readdirSync(MIG)
  .filter((f) => /^\d+.*\.sql$/.test(f))
  .sort();
for (const f of files) {
  const raw = fs.readFileSync(path.join(MIG, f), "utf8");
  const sql = stripComments(raw);
  for (const st0 of splitStatements(sql)) {
    const st = st0.trim().replace(/\s+/g, " ");
    if (!st || /^(BEGIN|COMMIT|ROLLBACK|START|END)$/i.test(st)) continue;
    let handled =
      parseFunction(st0.trim()) ||
      parseTrigger(st0.trim()) ||
      parsePolicy(st0.trim()) ||
      parseIndex(st0.trim()) ||
      parseCreateTable(st0.trim()) ||
      parseAlterTable(st0.trim()) ||
      parsePriv(st);
    if (!handled) {
      if (/^DO\s*\$/i.test(st0.trim())) {
        handled = handleDoBlock(st0.trim());
      }
    }
    if (!handled) {
      if (/^DROP\s+(POLICY|TRIGGER|INDEX|FUNCTION|TABLE|CONSTRAINT)/i.test(st)) {
        handleDrop(st);
        handled = true;
      } else if (/^CREATE\s+(OR\s+REPLACE\s+)?TYPE\s+public\.\w+\s+AS\s+ENUM/i.test(st)) {
        const em = st.match(
          /CREATE\s+(?:OR\s+REPLACE\s+)?TYPE\s+public\.(\w+)\s+AS\s+ENUM\s*\(([\s\S]*)\)/i,
        );
        if (em) inv.enums[em[1]] = splitTop(em[2]).map((x) => x.trim().replace(/^'|'$/g, ""));
        handled = true;
      } else if (/^CREATE\s+EXTENSION\s+IF\s+NOT\s+EXISTS\s+\w+/i.test(st)) {
        inv.extensions.push(st.match(/^CREATE\s+EXTENSION\s+IF\s+NOT\s+EXISTS\s+(\w+)/i)[1]);
        handled = true;
      } else if (/^CREATE\s+(OR\s+REPLACE\s+)?VIEW\s+public\.\w+/i.test(st)) {
        const vm = st.match(
          /CREATE\s+(?:OR\s+REPLACE\s+)?VIEW\s+public\.(\w+)(?:\s+WITH\s*\(([\s\S]*?)\))?/i,
        );
        if (vm)
          inv.views[vm[1]] = {
            opts: vm[2] ? vm[2].split(",").map((o) => squash(o.replace(/\s*=\s*/, "="))) : [],
            cols: viewColumns(st),
          };
        handled = true;
      } else if (/^INSERT\s+INTO\s+public\.app_config/i.test(st)) {
        for (const rm of st.matchAll(/\('([^']+)',\s*'([^']*)'/g))
          inv.appConfig[rm[1]] = JSON.parse(rm[2]);
        handled = true;
      } else if (/cron\.schedule\(/i.test(st)) {
        const cm = st.match(/cron\.schedule\(\s*'([^']+)'\s*,\s*'([^']+)'/i);
        const tag = st.match(/(\$\w*\$)([\s\S]*?)\1/);
        const j =
          inv.cron[cm[1]] ||
          (inv.cron[cm[1]] = { schedule: cm[2], cmd: "", times: 0, schedules: [] });
        j.times++;
        j.schedule = cm[2]; // last write wins (re-scheduling the same job name)
        if (!j.schedules.includes(cm[2])) j.schedules.push(cm[2]);
        j.cmd = tag ? normBody(tag[2]) : j.cmd;
        handled = true;
      } else if (/^ALTER\s+PUBLICATION/i.test(st)) {
        const n = scanPublicationAdds(st);
        if (!n && !/ADD\s+TABLE/i.test(st)) inv.other.push(`${f}: ${st.slice(0, 100)}`);
        handled = true;
      }
    }
    if (!handled) inv.other.push(`${f}: ${st.slice(0, 100)}`);
  }
}
function handleDrop(st) {
  const kind = st.match(/^DROP\s+(\w+)/i)[1].toUpperCase();
  if (kind === "POLICY") {
    const m = st.match(/DROP\s+POLICY\s+(IF\s+EXISTS\s+)?("?\w+"?)\s+ON\s+([\w.]+)/i);
    if (m) delete inv.policies[`${m[3]}/${m[2].replace(/"/g, "")}`];
  } else if (kind === "TRIGGER") {
    const m = st.match(/DROP\s+TRIGGER\s+(IF\s+EXISTS\s+)?(\w+)\s+ON\s+([\w.]+)/i);
    if (m) delete inv.triggers[m[2]];
  } else if (kind === "INDEX") {
    for (const n of splitTop(st.replace(/^DROP\s+INDEX\s+(IF\s+EXISTS\s+)?/i, ""))) {
      const nm = n
        .match(/[\w.]+/)[0]
        .split(".")
        .pop();
      delete inv.indexes[nm];
    }
  } else if (kind === "FUNCTION") {
    for (const n of splitTop(st.replace(/^DROP\s+FUNCTION\s+(IF\s+EXISTS\s+)?/i, ""))) {
      const open = n.indexOf("(");
      const nm = n
        .slice(0, open >= 0 ? open : undefined)
        .match(/[\w.]+/)[0]
        .split(".")
        .pop();
      const args = open >= 0 ? n.slice(open + 1).replace(/\)\s*$/, "") : null;
      if (args !== null) delete inv.functions[`${nm}/${normFnSig(args).replace(/=d/g, "")}`];
      else
        for (const k of Object.keys(inv.functions))
          if (k.startsWith(`${nm}/`)) delete inv.functions[k];
    }
  } else if (kind === "TABLE") {
    const m = st.match(/DROP\s+TABLE\s+(IF\s+EXISTS\s+)?([\w.]+)/i);
    if (m) delete inv.tables[m[2].split(".").pop()];
  } else if (kind === "CONSTRAINT") {
    /* handled in ALTER */
  } else if (
    kind === "SCHEMA" ||
    kind === "TYPE" ||
    kind === "EXTENSION" ||
    kind === "DOMAIN" ||
    kind === "MATERIALIZED" ||
    kind === "VIEW"
  ) {
    /* ignore */
  }
}

fs.writeFileSync(path.join(OUT, "inventory.json"), JSON.stringify(inv, null, 1));

// ---------- prod dump ----------
const dumpSql = `
select json_build_object(
 'functions', (select coalesce(json_agg(x),'[]') from (
   select p.proname as name, pg_get_function_identity_arguments(p.oid) as identity_args,
     format_type(p.prorettype, null) as rettype,
     p.provolatile, p.proisstrict, p.prosecdef, p.proconfig::text as proconfig,
     pg_get_functiondef(p.oid) as def
   from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public') x),
 'triggers', (select coalesce(json_agg(x),'[]') from (
   select t.tgname as name, c.relname as table_name, pg_get_triggerdef(t.oid) as def
   from pg_trigger t join pg_class c on c.oid=t.tgrelid join pg_namespace n on n.oid=c.relnamespace
   where n.nspname='public' and not t.tgisinternal) x),
 'triggers_auth', (select coalesce(json_agg(x),'[]') from (
   select t.tgname as name, c.relname as table_name, pg_get_triggerdef(t.oid) as def
   from pg_trigger t join pg_class c on c.oid=t.tgrelid join pg_namespace n on n.oid=c.relnamespace
   where n.nspname='auth' and not t.tgisinternal) x),
 'policies', (select coalesce(json_agg(x),'[]') from (
   select schemaname, tablename, policyname, permissive, cmd, roles, qual, with_check
   from pg_policies where schemaname in ('public','storage')) x),
 'indexes', (select coalesce(json_agg(x),'[]') from (
   select n.nspname as schemaname, c.relname as tablename, i.relname as indexname, pg_get_indexdef(i.oid) as def
   from pg_index ix join pg_class i on i.oid=ix.indexrelid join pg_class c on c.oid=ix.indrelid
   join pg_namespace n on n.oid=c.relnamespace
   where n.nspname in ('public','storage') and i.relkind='i') x),
 'constraints', (select coalesce(json_agg(x),'[]') from (
   select c.relname as table_name, con.conname as name, con.contype::text as type,
     pg_get_constraintdef(con.oid) as def
   from pg_constraint con join pg_class c on c.oid=con.conrelid
   join pg_namespace n on n.oid=c.relnamespace where n.nspname='public') x),
 'columns', (select coalesce(json_agg(x),'[]') from (
   select c.relname as table_name, a.attname as name, format_type(a.atttypid,a.atttypmod) as type,
     not a.attnotnull as nullable, coalesce(pg_get_expr(ad.adbin,ad.adrelid),'') as default_
   from pg_attribute a join pg_class c on c.oid=a.attrelid join pg_namespace n on n.oid=c.relnamespace
   left join pg_attrdef ad on ad.adrelid=a.attrelid and ad.adnum=a.attnum
   where n.nspname='public' and c.relkind='r' and a.attnum>0 and not a.attisdropped) x),
 'tables', (select coalesce(json_agg(x),'[]') from (
   select c.relname as name, c.relrowsecurity as rls, c.relforcerowsecurity as force_rls
   from pg_class c join pg_namespace n on n.oid=c.relnamespace
   where n.nspname='public' and c.relkind='r') x),
 'publication_tables', (select coalesce(json_agg(x),'[]') from (
   select pubname, schemaname, tablename from pg_publication_tables) x),
 'cron_jobs', (select coalesce(json_agg(x),'[]') from (
   select jobname, count(*) as jobs, (array_agg(command order by jobid))[1] as command,
          array_agg(distinct schedule) as schedules
   from cron.job group by jobname) x),
 'column_privileges', (select coalesce(json_agg(x),'[]') from (
   select grantee, table_name, column_name, privilege_type from information_schema.column_privileges
   where table_schema='public' and grantee in ('authenticated','anon','service_role','public')) x),
 'table_privileges', (select coalesce(json_agg(x),'[]') from (
   select grantee, table_name, privilege_type from information_schema.table_privileges
   where table_schema='public' and grantee in ('authenticated','anon','service_role','public')) x),
 'routine_privileges', (select coalesce(json_agg(x),'[]') from (
   select p.proname as name, pg_get_function_identity_arguments(p.oid) as identity_args,
     r.rolname as grantee, ap.privilege_type
   from pg_proc p join pg_namespace n on n.oid=p.pronamespace,
     aclexplode(coalesce(p.proacl, acldefault('f',p.proowner))) ap
     join pg_roles r on r.oid=ap.grantee
   where n.nspname='public' and r.rolname in ('authenticated','anon','service_role','public')) x),
 'views', (select coalesce(json_agg(x),'[]') from (
   select c.relname as name, pg_get_userbyid(c.relowner) as owner, c.reloptions as opts
   from pg_class c join pg_namespace n on n.oid=c.relnamespace
   where n.nspname='public' and c.relkind='v') x),
 'view_columns', (select coalesce(json_agg(x),'[]') from (
   select table_name, column_name, ordinal_position
   from information_schema.columns
   where table_schema='public' and table_name in (select viewname from pg_views where schemaname='public')
   order by table_name, ordinal_position) x),
 'enums', (select coalesce(json_agg(x),'[]') from (
   select t.typname as name, array_agg(e.enumlabel order by e.enumsortorder) as labels
   from pg_type t join pg_enum e on e.enumtypid=t.oid
   where t.typnamespace='public'::regnamespace group by t.typname) x),
 'extensions', (select coalesce(json_agg(x),'[]') from (
   select extname from pg_extension where extname in ('pgcrypto','pg_cron')) x),
 'app_config', (select coalesce(json_agg(x),'[]') from (
   select key, value from public.app_config order by key) x),
 'check_counts', (select coalesce(json_agg(x),'[]') from (
   select c.relname as table_name, count(*) as n
   from pg_constraint con join pg_class c on c.oid=con.conrelid join pg_namespace n on n.oid=c.relnamespace
   where n.nspname='public' and con.contype='c' and con.conname not like '%not_null'
   group by c.relname) x),
 'key_constraints', (select coalesce(json_agg(x),'[]') from (
   select c.relname as table_name, con.contype as contype, con.conname as name,
          pg_get_constraintdef(con.oid) as def
   from pg_constraint con join pg_class c on c.oid=con.conrelid join pg_namespace n on n.oid=c.relnamespace
   where n.nspname='public' and con.contype in ('f','u','p')) x)
)::text as payload;
`;
fs.writeFileSync(DUMP_SQL, dumpSql);

console.log(
  `inventory written. functions=${Object.keys(inv.functions).length}`,
  `triggers=${Object.keys(inv.triggers).length}`,
  `policies=${Object.keys(inv.policies).length}`,
  `indexes=${Object.keys(inv.indexes).length}`,
  `tables=${Object.keys(inv.tables).length}`,
  `privs=${inv.privs.length}`,
  `other=${inv.other.length}`,
);
if (inv.other.length) console.log(`OTHER:\n${inv.other.join("\n").slice(0, 3000)}`);

// run target dump (read-only SELECT against the linked project)
if (process.argv[2] === "run") {
  console.log(`querying target ${TARGET}...`);
  const stdout = execFileSync(
    "cmd",
    ["/c", "npx", "supabase", "db", "query", "--linked", "--output-format", "json", "-f", DUMP_SQL],
    { encoding: "utf8", maxBuffer: 512 * 1024 * 1024, cwd: ROOT },
  );
  const start = stdout.indexOf("{");
  fs.writeFileSync(path.join(OUT, `dump-${TARGET}-raw.json`), stdout.slice(start));
  const payload = JSON.parse(JSON.parse(stdout.slice(start)).rows[0].payload);
  fs.writeFileSync(DUMP_JSON, JSON.stringify(payload, null, 1));
  if (TARGET === PROD_REF)
    fs.writeFileSync(path.join(OUT, "prod.json"), JSON.stringify(payload, null, 1));
  console.log(`dump written: ${path.basename(DUMP_JSON)}`);
}
if (process.argv[2] === "compare") {
  const prod = JSON.parse(fs.readFileSync(DUMP_JSON, "utf8"));
  const report = [];
  const S = (s) => squash(s || "");
  const soft = [];
  const hard = [];
  const note = [];
  const parenOnly = []; // proven token-identical; only postgres grouping parens differ
  const line = (cls, ...rest) => {
    report.push(`${cls} | ${rest.join(" | ")}`);
    if (cls.startsWith("DIFFERS") || cls.startsWith("MISSING") || cls.startsWith("EXTRA"))
      (cls.endsWith("_SOFT") ? soft : hard).push(report[report.length - 1]);
  };

  // ---- functions ----
  const prodFns = {};
  for (const f of prod.functions) {
    const sig = normFnSigFromIdentity(f.identity_args);
    prodFns[`${f.name}/${sig}`] = f;
  }
  function normFnSigFromIdentity(raw) {
    if (!raw?.trim()) return "";
    return splitTop(raw)
      .map((a) => {
        const toks = a.trim().split(/\s+/);
        return (
          (toks.length > 1 ? normArg(toks.slice(1).join(" ")) : normArg(a)) +
          (/DEFAULT/i.test(a) ? "=d" : "")
        );
      })
      .join(",");
  }
  const expKeys = new Set(Object.keys(inv.functions).map((k) => k.replace(/=d/g, "")));
  const prodKeys = new Set(Object.keys(prodFns));
  for (const [k, e] of Object.entries(inv.functions)) {
    const kk = k.replace(/=d/g, "");
    const p = prodFns[kk];
    if (!p) {
      line("MISSING_FUNCTION", kk);
      continue;
    }
    const diffs = [];
    let eRet = e.rettype.replace(/^setof/, "");
    if (/^table\(/.test(eRet)) eRet = "record";
    if (normType(p.rettype) !== eRet) diffs.push(`rettype file=${eRet} prod=${p.rettype}`);
    if (p.provolatile !== e.volatility)
      diffs.push(`volatility file=${e.volatility} prod=${p.provolatile}`);
    if (p.proisstrict !== e.isStrict) diffs.push(`strict file=${e.isStrict} prod=${p.proisstrict}`);
    if (p.prosecdef !== e.isSecdef) diffs.push(`secdef file=${e.isSecdef} prod=${p.prosecdef}`);
    const prodSp = p.proconfig
      ? (p.proconfig.match(/search_path=("[^"]*"|[^}\s]*)/i) || [])[1]
      : null;
    const prodSpN =
      prodSp === null
        ? null
        : squash(prodSp.replace(/\\/g, "").replace(/"/g, "")) === ""
          ? ""
          : squash(prodSp.replace(/\\/g, "").replace(/"/g, ""));
    if (prodSpN !== e.searchPath)
      diffs.push(
        `search_path file=${JSON.stringify(e.searchPath)} prod=${JSON.stringify(prodSpN)}`,
      );
    // defaults + signature from def header
    const hM = p.def.match(/^CREATE OR REPLACE FUNCTION public\.([\w]+)\s*\(/);
    let prodSig = "",
      prodDefaults = 0;
    if (hM) {
      const hOpen = p.def.indexOf("(", hM[0].length - 1);
      const hClose = matchParen(p.def, hOpen);
      prodSig = normFnSig(p.def.slice(hOpen + 1, hClose));
      prodDefaults = (p.def.slice(hOpen, hClose).match(/\bDEFAULT\b/gi) || []).length;
    }
    if (prodSig !== e.sig) diffs.push(`sig file=${e.sig} prod=${prodSig}`);
    if (prodDefaults !== e.nDefaults)
      diffs.push(`n_defaults file=${e.nDefaults} prod=${prodDefaults}`);
    // body
    const bM = p.def.match(/\$function\$([\s\S]*?)\$function\$/);
    const pBody = bM ? bM[1] : "";
    if (normBody(pBody) !== e.body) {
      if (S(pBody) === S(e.body)) soft.push(`WHITESPACE_ONLY_BODY ${kk}`);
      else diffs.push(`BODY differs (file ${e.body.length} chars vs prod ${pBody.length} chars)`);
    }
    if (diffs.length) line("DIFFERS_FUNCTION", kk, diffs.join("; "));
  }
  for (const k of prodKeys) if (!expKeys.has(k)) line("EXTRA_FUNCTION_PROD_ONLY", k);

  // ---- triggers ----
  const prodTrg = {};
  for (const t of prod.triggers.concat(prod.triggers_auth || [])) prodTrg[t.name] = t;
  const normParens = (s) => squash((s || "").replace(/[()]/g, ""));
  for (const [k, e] of Object.entries(inv.triggers)) {
    const p = prodTrg[k];
    if (!p) {
      line("MISSING_TRIGGER", k);
      continue;
    }
    const dm = p.def.match(
      /^CREATE (?:CONSTRAINT )?TRIGGER \w+\s+([\s\S]*?)\s+ON\s+([\w.]+)\s+([\s\S]*)$/i,
    );
    if (!dm) {
      note.push(`TRIGGER_UNPARSABLE ${k} :: ${p.def.slice(0, 120)}`);
      continue;
    }
    const prodTiming = squash(dm[1]),
      prodTable = dm[2],
      prodRest = dm[3];
    if (prodTable !== e.table) {
      line("DIFFERS_TRIGGER_TABLE", k, `${e.table} vs ${prodTable}`);
      continue;
    }
    if (prodTiming !== squash(e.timing)) {
      line("DIFFERS_TRIGGER", k, `timing file=${e.timing} prod=${prodTiming}`);
      continue;
    }
    const fnM = prodRest.match(/EXECUTE\s+(?:FUNCTION|PROCEDURE)\s+([\w.]+)\s*\(/i);
    const whenM = prodRest.match(/WHEN\s*\(([\s\S]*)\)\s*EXECUTE/i);
    const fnEq = !!fnM && fnM[1].replace(/^public\./, "") === e.fn.replace(/^public\./, "");
    const eachEq = /FOR\s+EACH\s+ROW/i.test(prodRest) === e.eachRow;
    const whenEq = normParens(whenM ? whenM[1] : "") === normParens(e.when || "");
    if (!(fnEq && eachEq && whenEq))
      line(
        "DIFFERS_TRIGGER",
        k,
        "fn=" +
          (fnM ? fnM[1] : "?") +
          "/" +
          e.fn +
          " eachRow=" +
          eachEq +
          "/" +
          e.eachRow +
          " when prod=" +
          normParens(whenM ? whenM[1] : "") +
          " file=" +
          normParens(e.when || ""),
      );
  }
  for (const k of Object.keys(prodTrg))
    if (!inv.triggers[k]) {
      const p = prodTrg[k];
      if (p && /onauth\.users|on auth\.users/i.test(p.def))
        note.push(`EXTRA_TRIGGER_AUTH_SCHEMA ${k} :: ${p.def.slice(0, 120)}`);
      else line("EXTRA_TRIGGER_PROD_ONLY", `${k} on ${p ? p.table_name : "?"}`);
    }

  // ---- policies ----
  const prodPol = {};
  for (const p of prod.policies) prodPol[`${p.schemaname}.${p.tablename}/${p.policyname}`] = p;
  for (const [k, e] of Object.entries(inv.policies)) {
    const p = prodPol[k];
    if (!p) {
      line("MISSING_POLICY", k);
      continue;
    }
    const diffs = [];
    if (p.permissive !== e.permissive) diffs.push(`permissive ${e.permissive} vs ${p.permissive}`);
    if (p.cmd !== e.cmd) diffs.push(`cmd ${e.cmd} vs ${p.cmd}`);
    const prodRoles = (p.roles || [])
      .map((r) => r.replace(/"/g, ""))
      .sort()
      .join(",");
    const expRoles = [...e.roles].sort().join(",");
    if (prodRoles !== expRoles) diffs.push(`roles ${expRoles} vs ${prodRoles}`);
    const pTable = String(p.tablename || e.table || "")
      .split(".")
      .pop();
    const fileRels = relNames(e.using || "", pTable).concat(relNames(e.withCheck || "", pTable));
    const prodRels = relNames(p.qual || "", pTable).concat(relNames(p.with_check || "", pTable));
    const fU = canonExpr(e.using || "", { rels: fileRels }),
      pU = canonExpr(p.qual || "", { rels: prodRels });
    const fC = canonExpr(e.withCheck || "", { rels: fileRels }),
      pC = canonExpr(p.with_check || "", { rels: prodRels });
    const fUL = canonExprLoose(e.using || "", { rels: fileRels }),
      pUL = canonExprLoose(p.qual || "", { rels: prodRels });
    const fCL = canonExprLoose(e.withCheck || "", { rels: fileRels }),
      pCL = canonExprLoose(p.with_check || "", { rels: prodRels });
    const cmp = (a, b, al, bl) => (a === b ? "EQ" : al === bl ? "PARENS" : "DIFF");
    const uRes = cmp(fU, pU, fUL, pUL),
      cRes = cmp(fC, pC, fCL, pCL);
    if (uRes === "DIFF")
      diffs.push(`USING ${(e.using || "").slice(0, 80)} vs ${(p.qual || "").slice(0, 80)}`);
    else if (uRes === "PARENS") parenOnly.push(`POLICY_PARENS_ONLY ${k} USING`);
    if (cRes === "DIFF")
      diffs.push(
        "WITH_CHECK " +
          (e.withCheck || "").slice(0, 80) +
          " vs " +
          (p.with_check || "").slice(0, 80),
      );
    else if (cRes === "PARENS") parenOnly.push(`POLICY_PARENS_ONLY ${k} WITH_CHECK`);
    if (diffs.length) {
      // expression canonicalization differences are common; only structural fields are hard
      const structural = diffs.filter((d) => !d.startsWith("USING") && !d.startsWith("WITH_CHECK"));
      if (structural.length) line("DIFFERS_POLICY", k, diffs.join(" ; "));
      else soft.push(`POLICY_EXPR ${k} :: ${diffs.join(" ; ")}`);
    }
  }
  for (const k of Object.keys(prodPol)) if (!inv.policies[k]) line("EXTRA_POLICY_PROD_ONLY", k);

  // ---- constraints (named only) ----
  const prodCon = {};
  for (const c of prod.constraints) (prodCon[c.table_name] ||= new Set()).add(c.name);

  // ---- indexes ----
  const prodIdx = {};
  for (const i of prod.indexes) prodIdx[i.indexname] = i;
  const _stripCast = (s) => squash((s || "").replace(/::[a-z_]+(\[\])?/g, ""));
  for (const [k, e] of Object.entries(inv.indexes)) {
    const p = prodIdx[k];
    if (!p) {
      line("MISSING_INDEX", k);
      continue;
    }
    const dm = p.def.match(/\( ([\s\S]*?) \)/) || p.def.match(/\(([\s\S]*?)\)/);
    const whereM = p.def.match(/WHERE\s+([\s\S]*)$/);
    const diffs = [];
    if (p.def.includes("CREATE UNIQUE INDEX") !== e.unique) diffs.push("unique");
    if (!dm || squash(dm[1]) !== e.cols)
      diffs.push(`cols exp=${e.cols} prod=${dm ? squash(dm[1]) : "?"}`);
    const pWhere = whereM ? whereM[1] : "",
      eWhere = e.where || "";
    const whereRes =
      canonExpr(pWhere) === canonExpr(eWhere)
        ? "EQ"
        : canonExprLoose(pWhere) === canonExprLoose(eWhere)
          ? "PARENS"
          : "DIFF";
    if (whereRes === "DIFF")
      diffs.push(`where exp=${e.where} prod=${whereM ? squash(whereM[1]) : ""}`);
    else if (whereRes === "PARENS") parenOnly.push(`INDEX_WHERE_PARENS_ONLY ${k}`);
    if (diffs.length === 1 && diffs[0].startsWith("where"))
      soft.push(`INDEX_WHERE_SOFT ${k} :: ${diffs[0]}`);
    else if (diffs.length) line("DIFFERS_INDEX", k, diffs.join("; "));
  }
  for (const k of Object.keys(prodIdx)) {
    const p = prodIdx[k];
    if (inv.indexes[k]) continue;
    if (!inv.tables[p.tablename]) continue; // storage/infra schema objects
    if ((prodCon[p.tablename] || new Set()).has(k)) continue; // constraint-backed index
    line("EXTRA_INDEX_PROD_ONLY", `${k} on ${p.tablename}`);
  }

  // ---- tables/columns ----
  const prodCols = {};
  for (const c of prod.columns) (prodCols[c.table_name] ||= {})[c.name] = c;
  const prodTables = {};
  for (const t of prod.tables) prodTables[t.name] = t;
  for (const [t, e] of Object.entries(inv.tables)) {
    if (!prodTables[t]) {
      line("MISSING_TABLE", t);
      continue;
    }
    const pc = prodCols[t] || {};
    for (const [c, ce] of Object.entries(e.columns)) {
      const p = pc[c];
      if (!p) {
        line("MISSING_COLUMN", `${t}.${c}`);
        continue;
      }
      if (normType(p.type) !== ce.type)
        line("DIFFERS_COLUMN_TYPE", `${t}.${c}`, `${ce.type} vs ${p.type}`);
      if (p.nullable === ce.notnull)
        line(
          "DIFFERS_COLUMN_NULLABLE",
          `${t}.${c}`,
          `file notnull=${ce.notnull} prod nullable=${p.nullable}`,
        );
      const pd = canonExpr(p.default_ || ""),
        ed = canonExpr(ce.default || "");
      if (pd !== ed) {
        if (canonExprLoose(p.default_ || "") === canonExprLoose(ce.default || ""))
          parenOnly.push(`COLUMN_DEFAULT_PARENS_ONLY ${t}.${c}`);
        else soft.push(`COLUMN_DEFAULT ${t}.${c} file=${ed} prod=${pd}`);
      }
    }
    for (const c of Object.keys(pc)) if (!e.columns[c]) line("EXTRA_COLUMN_PROD_ONLY", `${t}.${c}`);
  }
  for (const t of Object.keys(prodTables)) if (!inv.tables[t]) line("EXTRA_TABLE_PROD_ONLY", t);
  for (const t of inv.rlsTables)
    if (prodTables[t] && !prodTables[t].rls) line("DIFFERS_RLS_DISABLED", t);
  for (const t of Object.keys(prodTables))
    if (prodTables[t].rls && !inv.rlsTables.includes(t))
      note.push(`RLS on ${t} not from 0001 list (fine if enabled elsewhere)`);

  // ---- constraints: missing check ----
  for (const [t, e] of Object.entries(inv.tables)) {
    const ps = prodCon[t] || new Set();
    for (const c of e.constraints) if (!ps.has(c)) line("MISSING_CONSTRAINT", `${t}.${c}`);
  }
  for (const [t, ps] of Object.entries(prodCon))
    for (const c of ps) {
      if (!inv.tables[t]?.constraints.has(c)) note.push(`CONSTRAINT_PROD_ONLY ${t}.${c}`);
    }

  // ---- publications ----
  const pubProd = new Set(
    prod.publication_tables
      .filter((r) => r.pubname === "supabase_realtime")
      .map((r) => r.tablename),
  );
  for (const t of inv.pubAdds.supabase_realtime || [])
    if (!pubProd.has(t)) line("MISSING_PUBLICATION_TABLE", t);
  for (const t of pubProd)
    if (!(inv.pubAdds.supabase_realtime || []).includes(t)) note.push(`PUBLICATION_PROD_ONLY ${t}`);

  // ---- cron ----
  for (const [j, e] of Object.entries(inv.cron)) {
    const p = prod.cron_jobs.find((x) => x.jobname === j);
    if (!p) {
      line("MISSING_CRON", j);
      continue;
    }
    if (p.jobs > 1) note.push(`CRON_DUPLICATES ${j} x${p.jobs}`);
    if (S(p.command) !== S(e.cmd)) soft.push(`CRON_CMD ${j}`);
    const prodSchedules = (p.schedules || []).map((s) => S(s));
    if (!prodSchedules.includes(S(e.schedule)))
      line("DIFFERS_CRON_SCHEDULE", j, `file=${e.schedule} prod=${JSON.stringify(p.schedules)}`);
    for (const s of e.schedules || [])
      if (!prodSchedules.includes(S(s))) note.push(`CRON_SCHEDULE_SUPERSEDED ${j} ${s}`);
  }
  for (const j of prod.cron_jobs)
    if (!inv.cron[j.jobname]) note.push(`CRON_PROD_ONLY ${j.jobname}`);

  // ---- enum types ----
  const prodEnums = {};
  for (const e of prod.enums || []) prodEnums[e.name] = e.labels;
  for (const [name, labels] of Object.entries(inv.enums)) {
    const p = prodEnums[name];
    if (!p) {
      line("MISSING_ENUM", name);
      continue;
    }
    if (JSON.stringify(p) !== JSON.stringify(labels))
      line("DIFFERS_ENUM", name, `file=${labels.join("|")} prod=${p.join("|")}`);
  }
  for (const name of Object.keys(prodEnums))
    if (!inv.enums[name]) line("EXTRA_ENUM_PROD_ONLY", name);

  // ---- extensions ----
  const prodExts = new Set((prod.extensions || []).map((e) => e.extname));
  for (const x of inv.extensions) if (!prodExts.has(x)) line("MISSING_EXTENSION", x);

  // ---- views ----
  const prodViews = {};
  for (const v of prod.views || []) prodViews[v.name] = v;
  for (const [name, e] of Object.entries(inv.views)) {
    const p = prodViews[name];
    if (!p) {
      line("MISSING_VIEW", name);
      continue;
    }
    const pOpts = new Set((p.opts || []).map((o) => squash(String(o))));
    const eOpts = new Set(e.opts);
    const optDiff = [...eOpts]
      .filter((o) => !pOpts.has(o))
      .concat([...pOpts].filter((o) => !eOpts.has(o)));
    if (p.owner !== "postgres") line("DIFFERS_VIEW_OWNER", name, `prod owner=${p.owner}`);
    if (optDiff.length)
      line(
        "DIFFERS_VIEW_OPTS",
        name,
        `file=[${e.opts.join(",")}] prod=[${(p.opts || []).join(",")}]`,
      );
  }
  for (const name of Object.keys(prodViews))
    if (!inv.views[name]) line("EXTRA_VIEW_PROD_ONLY", name);
  // view output columns (catches a view that was never redefined to the current definition)
  const prodViewCols = {};
  for (const r of prod.view_columns || [])
    (prodViewCols[r.table_name] ||= []).push(r.column_name.toLowerCase());
  for (const [name, e] of Object.entries(inv.views)) {
    const pc = prodViewCols[name];
    if (!pc) continue;
    const ec = e.cols || [];
    if (!ec.length) {
      note.push(`VIEW_COLS_UNKNOWN ${name}`);
      continue;
    }
    for (const c of ec)
      if (c !== "<expr>" && !pc.includes(c)) line("MISSING_VIEW_COLUMN", `${name}.${c}`);
    for (const c of pc) if (!ec.includes(c)) line("EXTRA_VIEW_COLUMN_PROD", `${name}.${c}`);
  }

  // ---- app_config seed rows ----
  const canon = (v) => {
    if (v && typeof v === "object" && !Array.isArray(v)) {
      const out = {};
      for (const k of Object.keys(v).sort()) out[k] = canon(v[k]);
      return out;
    }
    return v;
  };
  const prodCfg = {};
  for (const r of prod.app_config || []) prodCfg[r.key] = r.value;
  for (const [k, v] of Object.entries(inv.appConfig)) {
    if (!(k in prodCfg)) {
      line("MISSING_APPCONFIG", k);
      continue;
    }
    if (JSON.stringify(canon(prodCfg[k])) !== JSON.stringify(canon(v)))
      line(
        "DIFFERS_APPCONFIG",
        k,
        `${JSON.stringify(canon(v))} vs ${JSON.stringify(canon(prodCfg[k]))}`,
      );
  }
  for (const k of Object.keys(prodCfg))
    if (!(k in inv.appConfig)) line("EXTRA_APPCONFIG_PROD_ONLY", k);

  // ---- CHECK constraint counts (covers unnamed inline CHECKs) ----
  const prodChecks = {};
  for (const r of prod.check_counts || []) prodChecks[r.table_name] = r.n;
  for (const t of new Set([...Object.keys(inv.checkCounts), ...Object.keys(prodChecks)])) {
    const f = inv.checkCounts[t] || 0,
      p = prodChecks[t] || 0;
    if (f !== p) line("CHECK_COUNT_DIFF", t, `file=${f} prod=${p}`);
  }

  // ---- foreign keys / unique / primary key constraints ----
  const fkKey = (o) =>
    "fk:" +
    o.cols.join(",") +
    "->" +
    o.ref +
    "(" +
    o.refCols.join(",") +
    ") del=" +
    o.del +
    " upd=" +
    o.upd;
  const uqKey = (o) => `uq:${o.cols.join(",")}`;
  const pkKey = (o) => `pk:${o.cols.join(",")}`;
  const fileFks = new Map(),
    prodFks = new Map();
  for (const f of inv.fks) fileFks.set(`${f.table}|${fkKey(f)}`, f);
  const fileUqs = new Map();
  for (const u of inv.uniques) fileUqs.set(`${u.table}|${uqKey(u)}`, u);
  const filePks = new Map();
  for (const p of inv.pks) filePks.set(`${p.table}|${pkKey(p)}`, p);
  for (const k of prod.key_constraints || []) {
    const d = k.def || "";
    if (k.contype === "f") {
      const fm = d.match(
        /FOREIGN KEY\s*\(([^)]*)\)\s*REFERENCES\s+([\w."]+)\s*\(([^)]*)\)([\s\S]*)$/i,
      );
      if (!fm) {
        note.push(`FK_UNPARSABLE ${k.table_name}.${k.name} :: ${d.slice(0, 100)}`);
        continue;
      }
      const rest = fm[4];
      const pick = (kw) => {
        const mm = rest.match(
          new RegExp(
            `ON\\s+${kw}\\s+(CASCADE|SET\\s+NULL|SET\\s+DEFAULT|RESTRICT|NO\\s+ACTION)`,
            "i",
          ),
        );
        return mm ? mm[1].toUpperCase().replace(/\s+/g, " ") : "NO ACTION";
      };
      const obj = {
        table: k.table_name,
        cols: fm[1].split(",").map((c) => c.trim().toLowerCase()),
        ref: fm[2].replace(/"/g, "").split(".").pop().toLowerCase(),
        refCols: fm[3].split(",").map((c) => c.trim().toLowerCase()),
        del: pick("DELETE"),
        upd: pick("UPDATE"),
      };
      prodFks.set(`${k.table_name}|${fkKey(obj)}`, obj);
    } else if (k.contype === "u") {
      const um = d.match(/UNIQUE\s*\(([^)]*)\)/i);
      if (!um) {
        note.push(`UQ_UNPARSABLE ${k.table_name}.${k.name}`);
        continue;
      }
      prodFks.set(
        `${k.table_name}|${uqKey({ cols: um[1].split(",").map((c) => c.trim().toLowerCase()) })}`,
        { table: k.table_name, cols: um[1].split(",").map((c) => c.trim().toLowerCase()) },
      );
    } else if (k.contype === "p") {
      const pm = d.match(/PRIMARY KEY\s*\(([^)]*)\)/i);
      if (!pm) {
        note.push(`PK_UNPARSABLE ${k.table_name}.${k.name}`);
        continue;
      }
      prodFks.set(
        `${k.table_name}|${pkKey({ cols: pm[1].split(",").map((c) => c.trim().toLowerCase()) })}`,
        { table: k.table_name, cols: pm[1].split(",").map((c) => c.trim().toLowerCase()) },
      );
    }
  }
  for (const [k] of fileFks) if (!prodFks.has(k)) line("MISSING_FK_OR_KEY", k);
  for (const [k] of fileUqs) if (!prodFks.has(k)) line("MISSING_UNIQUE", k);
  for (const [k] of filePks) if (!prodFks.has(k)) line("MISSING_PRIMARY_KEY", k);
  for (const [k, v] of prodFks) {
    if (!fileFks.has(k) && !fileUqs.has(k) && !filePks.has(k))
      line("EXTRA_KEY_PROD_ONLY", k + (v.ref ? ` -> ${v.ref}` : ""));
  }

  // ---- privileges ----
  // final state with ordered last-write-wins
  const tab = {}; // table/priv/grantee -> bool
  const col = {}; // table/col/priv/grantee -> bool
  const fn = {}; // fnsig/grantee -> bool  (EXECUTE)
  for (const s of inv.privs) {
    const val = s.expected;
    if (s.kind === "TABLE") {
      if (s.cols) for (const c of s.cols) col[`${s.target}/${c}/${s.priv}/${s.grantee}`] = val;
      else
        for (const p of [
          "SELECT",
          "INSERT",
          "UPDATE",
          "DELETE",
          "TRUNCATE",
          "REFERENCES",
          "TRIGGER",
        ])
          tab[`${s.target}/${p}/${s.grantee}`] = val;
    } else if (s.kind === "FUNCTION") {
      const sig = normFnSig(s.target.slice(s.target.indexOf("(") + 1).replace(/\)$/, ""));
      const nm = s.target.slice(0, s.target.indexOf("(")).split(".").pop();
      fn[`${nm}/${sig}/${s.grantee}`] = val;
    } else if (s.kind === "SEQUENCE" || s.kind === "SCHEMA" || s.kind === "DATABASE") {
      /* skip */
    }
  }
  const prodTab = new Set(
    prod.table_privileges.map((r) => `${r.table_name}/${r.privilege_type}/${r.grantee}`),
  );
  const prodCol = new Set(
    prod.column_privileges.map(
      (r) => `${r.table_name}/${r.column_name}/${r.privilege_type}/${r.grantee}`,
    ),
  );
  const prodFn = new Set(
    prod.routine_privileges.map(
      (r) => `${r.name}/${normFnSigFromIdentity(r.identity_args)}/${r.grantee}`,
    ),
  );
  for (const [k, v] of Object.entries(tab))
    if (v && !prodTab.has(k)) line("PRIV_MISSING_TABLE_GRANT", k);
    else if (!v && prodTab.has(k)) line("PRIV_UNEXPECTED_TABLE_GRANT", k);
  for (const [k, v] of Object.entries(col))
    if (v && !prodCol.has(k)) line("PRIV_MISSING_COLUMN_GRANT", k);
    else if (!v && prodCol.has(k)) line("PRIV_UNEXPECTED_COLUMN_GRANT", k);
  for (const [k, v] of Object.entries(fn))
    if (v && !prodFn.has(k)) line("PRIV_MISSING_FN_GRANT", k);
    else if (!v && prodFn.has(k)) line("PRIV_UNEXPECTED_FN_GRANT", k);

  fs.writeFileSync(
    REPORT,
    report.join("\n") +
      "\n\nSOFT (" +
      soft.length +
      "):\n" +
      soft.join("\n") +
      "\n\nPAREN-ONLY / TOKEN-IDENTICAL (" +
      parenOnly.length +
      "):\n" +
      parenOnly.join("\n") +
      "\n\nNOTES (" +
      note.length +
      "):\n" +
      note.join("\n") +
      "\n",
  );
  console.log(`HARD findings: ${hard.length}`);
  console.log(hard.slice(0, 60).join("\n"));
  console.log(`SOFT: ${soft.length}  NOTES: ${note.length}`);
  if (soft.length) console.log(`SOFT first 30:\n${soft.slice(0, 30).join("\n")}`);
  if (note.length) console.log(`NOTES first 20:\n${note.slice(0, 20).join("\n")}`);
}
