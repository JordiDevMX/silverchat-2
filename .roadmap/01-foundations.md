# SILVERCHAT — PROMPT #1: FOUNDATIONS & BACKEND INFRASTRUCTURE

You are a senior full-stack architect advising on the initial infrastructure
setup for a production-grade messaging web app called **SilverChat** — a
privacy-focused WhatsApp alternative with a futuristic silver + electric blue
design language.

The developer you are advising is **frontend-only** (React / TypeScript /
Tailwind). They have never built a backend before. Every decision below is
final and has been mutually agreed upon. **Do not propose alternatives unless
you identify a genuine blocker** — in that case, explain it and propose the
minimal fix.

---

## 1. INFRASTRUCTURE STACK (LOCKED)

| Layer                                          | Provider          | Plan      | Cost (MVP) |
| ---------------------------------------------- | ----------------- | --------- | ---------- |
| Backend · Database · Auth · Storage · Realtime | **Supabase**      | Free tier | $0         |
| Voice & video calls                            | **LiveKit Cloud** | Free tier | $0         |
| Transactional email (magic links)              | **Resend**        | Free tier | $0         |
| Frontend hosting                               | **Netlify**       | Free tier | $0         |

**Total MVP cost: $0/month. No credit card required on any provider at launch.**

---

## 2. DEVELOPER PRIORITIES (IN ORDER)

1. **Zero cost during MVP phase** (prototype will be tested by the developer,
   a friend, and their mother — literally ~3 users).
2. **Total technical control** (no black boxes; data must be exportable at any
   time; no hard vendor lock-in on the frontend).
3. **MVP speed** (ship fast, iterate faster).

---

## 3. SCALING STRATEGY

The architecture must support a **hassle-free upgrade path** from ~3 users to
~10,000 concurrent users **without rewriting code**. Scaling must mean
**"change the billing plan"**, not **"rewrite the backend"**.

Concrete expectations:

- Adding paying users → upgrade Supabase to Pro ($25/mo), LiveKit paid tier,
  Resend paid tier. **Zero code changes required.**
- Frontend must be portable: if the developer wants to migrate from Netlify
  to Cloudflare Pages (unlimited bandwidth, free), it must be a matter of
  changing the deploy target — **no code rewrite**.
- Database must be standard Postgres: `pg_dump` produces a complete,
  restorable export at any time.

**Reality check to always keep in mind:** "ready for millions of users" is not
achievable without real engineering effort. The goal here is to make the
**0 → 10k users** leap painless (billing only, no rewrite). Beyond that,
scaling becomes an engineering project — not a "plan change".

---

## 4. KNOWN FREE-TIER CAVEATS (ACKNOWLEDGED, NOT BLOCKERS)

These are understood and accepted. Include mitigations when relevant:

1. **Supabase pauses free projects after 7 days of inactivity.**
   - Mitigation: developer logs into the Supabase dashboard once a week during
     the prototype phase. No code needed.
   - Disappears permanently on Supabase Pro plan.

2. **Supabase's built-in SMTP is rate-limited (~3–4 emails/hour) and lands in
   spam.**
   - Mitigation: **Resend** is mandatory and must be connected before magic
     link auth is considered "working". Configured once via Supabase dashboard
     → Auth → SMTP settings.

3. **LiveKit requires server-generated JWT access tokens.** Cannot be created
   from the frontend.
   - Mitigation: a **Supabase Edge Function** of ~30 lines will generate tokens
     on demand. This is the ONLY backend code the developer will write. It is
     covered in a later prompt (section: Calls).
   - The developer is aware this Edge Function exists and understands its
     purpose. It is **not** "building a backend" — it's a small serverless
     script.

---

## 5. WHAT THIS PROMPT DOES **NOT** COVER

Do not output code in response to this prompt. This is a **decision document**
only. Implementation details are covered in subsequent prompts:

- #2 Stack & Project Setup (Vite, TanStack Router, pnpm, folder structure)
- #3 Design System (tokens, palette, typography, motion)
- #4 Data Model (entities, fields, relationships)
- #5 Authentication (magic link, 2FA TOTP, backup codes, recovery)
- #6 Profile & User Settings
- #7–#9 Chats (list, layout, message actions, contact profile)
- #10 Novedades (Stories + Channels)
- #11 Communities
- #12 Calls (LiveKit integration + call UI)
- #13 PWA & Offline
- #14 i18n & Theming
- #15 Privacy & Security
- #16 Deployment & Metadata

---

## 6. HOW TO RESPOND

Acknowledge this infrastructure decision. Then produce:

1. A **one-paragraph summary** confirming your understanding of the stack and
   priorities (this verifies alignment before we proceed to Prompt #2).

2. A **pre-flight checklist** of the accounts the developer must create BEFORE
   Prompt #2 can be executed, with:
   - Provider name
   - What to sign up for (free tier, no card)
   - What to configure (minimal settings)
   - What credentials/keys to extract and store securely
   - Estimated setup time per provider

3. Any **one-time configuration** that must be done in the Supabase dashboard
   for a smooth developer experience (e.g., RLS enabled by default, email
   templates, auth redirect URLs for `localhost` and the production domain).

4. A **plain-language explanation** (for a frontend developer with no backend
   experience) of what RLS is, why it matters for a privacy-focused app, and
   the single mental model they must internalize before writing a single line
   of code touching the database.

**Do not generate any application code yet.**
