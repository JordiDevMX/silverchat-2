// Canonical form for SQL expressions (policy quals, index predicates, column
// defaults). Postgres deparses expressions in its own canonical shape, so a
// raw text comparison flags harmless differences: extra parens, explicit
// casts, IN vs = ANY, interval literal spellings, spacing.
// Both sides are canonicalized identically, so a residual difference is a
// genuine candidate for review.

// Interval literal -> total seconds, so '24 hours', '24:00:00' and '86400 seconds' compare equal.
export function intervalSeconds(lit) {
  const s = String(lit).trim().toLowerCase();
  let m = s.match(/^(-?\d+):(\d{1,2}):(\d{1,2}(?:\.\d+)?)$/);
  if (m) return +m[1] * 3600 + +m[2] * 60 + +m[3];
  m = s.match(/^(-?\d+):(\d{1,2}(?:\.\d+)?)$/);
  if (m) return +m[1] * 3600 + +m[2] * 60;
  const units = {
    microsecond: 1e-6,
    microseconds: 1e-6,
    millisecond: 1e-3,
    milliseconds: 1e-3,
    second: 1,
    seconds: 1,
    sec: 1,
    secs: 1,
    s: 1,
    minute: 60,
    minutes: 60,
    min: 60,
    mins: 60,
    m: 60,
    hour: 3600,
    hours: 3600,
    hr: 3600,
    hrs: 3600,
    h: 3600,
    day: 86400,
    days: 86400,
    d: 86400,
    week: 604800,
    weeks: 604800,
    w: 604800,
    month: 2592000,
    months: 2592000,
    mon: 2592000,
    year: 31536000,
    years: 31536000,
    y: 31536000,
  };
  let total = 0,
    matched = false;
  for (const um of s.matchAll(/(-?\d+(?:\.\d+)?)\s*([a-z]+)/g)) {
    const u = units[um[2]];
    if (u === undefined) continue;
    total += parseFloat(um[1]) * u;
    matched = true;
  }
  return matched ? total : null;
}

// Index of the paren matching the one at position i.
export function matchParen(s, i) {
  let depth = 0,
    inQ = false;
  for (; i < s.length; i++) {
    const c = s[i];
    if (inQ) {
      if (c === "'") {
        if (s[i + 1] === "'") {
          i++;
          continue;
        }
        inQ = false;
      }
      continue;
    }
    if (c === "'") {
      inQ = true;
      continue;
    }
    if (c === "(") depth++;
    else if (c === ")") {
      depth--;
      if (depth === 0) return i;
    }
  }
  return -1;
}

// Relation names (and aliases) referenced by an expression, plus an optional
// extra relation (the policy's own table, which postgres qualifies against).
export function relNames(s, extra) {
  const rels = new Set();
  const kw =
    /^(where|on|set|group|order|limit|having|join|left|right|inner|full|cross|outer|union|for|values|using|returning|and|or|not|null|true|false|as|select|from|with|all|any|distinct)$/i;
  for (const m of String(s || "").matchAll(
    /\b(?:from|join|update|into)\s*\(*\s*([\w."]+)(?:\s+(?:as\s+)?(\w+))?/gi,
  )) {
    rels.add(m[1].replace(/"/g, "").split(".").pop().toLowerCase());
    if (m[2] && !kw.test(m[2])) rels.add(m[2].toLowerCase());
  }
  if (extra) rels.add(String(extra).replace(/"/g, "").split(".").pop().toLowerCase());
  return [...rels];
}

// Sentinels that stand in for string literals while the expression is
// normalized. They use the Private Use Area so they cannot collide with SQL
// text and are not control characters.
const LITERAL_OPEN = "\uE000";
const LITERAL_CLOSE = "\uE001";
const LITERAL_PATTERN = new RegExp(`${LITERAL_OPEN}(\\d+)${LITERAL_CLOSE}`, "g");

export function canonExpr(s, ctx) {
  let x = String(s || "");
  // interval literals -> canonical second count (both `interval 'x'` and `'x'::interval`)
  x = x.replace(/\binterval\s*'([^']*)'/gi, (m, lit) => {
    const sec = intervalSeconds(lit);
    return sec === null ? m : `interval#${sec}`;
  });
  x = x.replace(/'([^']*)'::interval\b/gi, (m, lit) => {
    const sec = intervalSeconds(lit);
    return sec === null ? m : `interval#${sec}`;
  });
  // protect single-quoted literals
  const lits = [];
  x = x.replace(/'([^']*)'/g, (_m, g) => {
    lits.push(g);
    return `${LITERAL_OPEN}${lits.length - 1}${LITERAL_CLOSE}`;
  });
  x = x.toLowerCase();
  x = x.replace(/\bpublic\./g, ""); // schema qualification
  x = x.replace(/::[a-z_]+(\[\])?/g, ""); // explicit casts
  x = x.replace(/\bin\s*\(([^()]*)\)/g, (_m, inner) => `=any(array[${inner}])`);
  // postgres deparses scalar subqueries as `( SELECT fn() AS fn)`; drop the alias
  x = x.replace(/\)\s*as\s*[a-z_][a-z0-9_]*/g, ")");
  // drop relation qualification for in-scope relations (postgres qualifies
  // column references that the migration file leaves unqualified)
  if (ctx?.rels) {
    for (const r of ctx.rels) {
      if (!r) continue;
      const esc = r.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      x = x.replace(new RegExp(`\\b(?:[\\w]+\\.)?${esc}\\.`, "g"), "");
    }
  }
  // drop one layer of outer wrapping parens
  while (x.startsWith("(") && matchParen(x, 0) === x.length - 1) x = x.slice(1, -1);
  // drop parens around a single term (keep groups containing AND/OR)
  let prev;
  do {
    prev = x;
    x = x.replace(/\(([^()]*)\)/g, (m, inner) => (/\b(and|or)\b/.test(inner) ? m : inner));
  } while (x !== prev);
  x = x.replace(/\s+/g, "");
  x = x.replace(LITERAL_PATTERN, (_m, i) => `'${lits[+i]}'`);
  return x;
}

// Paren-insensitive variant: postgres wraps WHERE bodies and OR operands in
// explicit parens that the migration source does not spell out. Used as a
// second tier: when only the grouping differs, the difference is reported
// separately from a genuine token difference.
export function canonExprLoose(s, ctx) {
  return canonExpr(s, ctx).replace(/[()]/g, "");
}
