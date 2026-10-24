# Graph Report - .roadmap  (2026-10-23)

## Corpus Check
- 19 files · ~72,448 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 118 nodes · 99 edges · 20 communities
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `22fa5b67`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- 16-deployment-metadata.md
- 1. LOCKED DECISIONS
- SILVERCHAT — PROMPT #1: FOUNDATIONS & BACKEND INFRASTRUCTURE
- 2. BFF ARCHITECTURE
- 1. CONTEXT & LOCKED DECISIONS
- SILVERCHAT — PROMPT #15: PRIVACY & SECURITY (WIRING PASS)
- 1. LOCKED DECISIONS
- SILVERCHAT — PROMPT #2: STACK & PROJECT SETUP
- SILVERCHAT — PROMPT #3: DESIGN SYSTEM
- SILVERCHAT — PROMPT #4b-1: RLS POLICIES & STORAGE SECURITY
- SILVERCHAT — PROMPT #4a: DATA MODEL (ENTITIES & RELATIONS)
- SILVERCHAT — PROMPT #7: CHATS LIST
- SILVERCHAT — PROMPT #8a: CHAT LAYOUT, MESSAGE RENDERING & COMPOSER
- SILVERCHAT — PROMPT #8b: MESSAGE ACTIONS & VOICE NOTES
- SILVERCHAT — PROMPT #9: CONTACT PROFILE & CHAT SETTINGS
- SILVERCHAT — PROMPT #11: COMMUNITIES
- SILVERCHAT — PROMPT #12: CALLS (VOICE & VIDEO)
- SILVERCHAT — PROMPT #13: PWA, OFFLINE & PUSH NOTIFICATIONS
- SILVERCHAT — PROMPT #14: INTERNATIONALIZATION & THEME SYSTEM
- SILVERCHAT — PROMPT #16: DEPLOYMENT & METADATA

## God Nodes (most connected - your core abstractions)
1. `SILVERCHAT — PROMPT #1: FOUNDATIONS & BACKEND INFRASTRUCTURE` - 7 edges
2. `1. LOCKED DECISIONS` - 7 edges
3. `SILVERCHAT — PROMPT #15: PRIVACY & SECURITY (WIRING PASS)` - 5 edges
4. `SILVERCHAT — PROMPT #2: STACK & PROJECT SETUP` - 4 edges
5. `SILVERCHAT — PROMPT #3: DESIGN SYSTEM` - 4 edges
6. `SILVERCHAT — PROMPT #5: AUTHENTICATION (SPA + BFF)` - 4 edges
7. `2. BFF ARCHITECTURE` - 4 edges
8. `SILVERCHAT — PROMPT #16: DEPLOYMENT & METADATA` - 4 edges
9. `SILVERCHAT — PROMPT #4a: DATA MODEL (ENTITIES & RELATIONS)` - 3 edges
10. `SILVERCHAT — PROMPT #4b-1: RLS POLICIES & STORAGE SECURITY` - 3 edges

## Surprising Connections (you probably didn't know these)
- None detected - all connections are within the same source files.

## Communities (20 total, 0 thin omitted)

### Community 0 - "16-deployment-metadata.md"
Cohesion: 0.12
Nodes (15): 15. `docs/DEPLOY.md`, 16. `docs/FASE-2.md`, 1. Clone, 1. Create migration locally, 2. Edit the SQL file, 2. Install dependencies (pnpm is enforced), 3. Configure environment, 3. Test locally (+7 more)

### Community 1 - "1. LOCKED DECISIONS"
Cohesion: 0.18
Nodes (10): 1. LOCKED DECISIONS, 2.1 `supabase/migrations/0005_profile_settings.sql`, 2. SUPPLEMENTARY MIGRATIONS, Block A — Identity, Block B — Account & Security, Block C — Privacy, Block D — Appearance, Block E — Notifications (+2 more)

### Community 2 - "SILVERCHAT — PROMPT #1: FOUNDATIONS & BACKEND INFRASTRUCTURE"
Cohesion: 0.25
Nodes (7): 1. INFRASTRUCTURE STACK (LOCKED), 2. DEVELOPER PRIORITIES (IN ORDER), 3. SCALING STRATEGY, 4. KNOWN FREE-TIER CAVEATS (ACKNOWLEDGED, NOT BLOCKERS), 5. WHAT THIS PROMPT DOES **NOT** COVER, 6. HOW TO RESPOND, SILVERCHAT — PROMPT #1: FOUNDATIONS & BACKEND INFRASTRUCTURE

### Community 3 - "2. BFF ARCHITECTURE"
Cohesion: 0.25
Nodes (7): 1. LOCKED DECISIONS, 2.1 Why a BFF, 2.2 Flow overview, 2.3 Folder structure additions, 2. BFF ARCHITECTURE, 3. NETLIFY FUNCTIONS, SILVERCHAT — PROMPT #5: AUTHENTICATION (SPA + BFF)

### Community 4 - "1. CONTEXT & LOCKED DECISIONS"
Cohesion: 0.29
Nodes (6): 1.1 From prior prompts, 1.2 New decisions confirmed for this prompt, 1. CONTEXT & LOCKED DECISIONS, 2.1 `messages` SELECT — allow pending-request recipient to read, 2. POLICY AMENDMENTS (fix gaps from #4b-1), SILVERCHAT — PROMPT #4b-2: BUSINESS LOGIC, RPCs, REALTIME & CRON

### Community 5 - "SILVERCHAT — PROMPT #15: PRIVACY & SECURITY (WIRING PASS)"
Cohesion: 0.29
Nodes (6): 1. LOCKED DECISIONS, 2. FILE STRUCTURE, 3. ROUTES, 4.1 `useSecuritySummary()`, 4. HOOKS, SILVERCHAT — PROMPT #15: PRIVACY & SECURITY (WIRING PASS)

### Community 6 - "1. LOCKED DECISIONS"
Cohesion: 0.33
Nodes (5): 1. LOCKED DECISIONS, 2. MIGRATION `0011_stories_channels.sql`, Channels, SILVERCHAT — PROMPT #10: NOVEDADES (STORIES & CHANNELS), Stories

### Community 7 - "SILVERCHAT — PROMPT #2: STACK & PROJECT SETUP"
Cohesion: 0.40
Nodes (4): 1. STACK (LOCKED), 2. WHY TANSTACK ROUTER (NOT TANSTACK START), 3. TAILWIND CSS v4 — CSS-FIRST CONFIGURATION, SILVERCHAT — PROMPT #2: STACK & PROJECT SETUP

### Community 8 - "SILVERCHAT — PROMPT #3: DESIGN SYSTEM"
Cohesion: 0.40
Nodes (4): 1. TECH CONTEXT, 2. ARCHITECTURE OVERVIEW, 3. INSTALLATION, SILVERCHAT — PROMPT #3: DESIGN SYSTEM

### Community 9 - "SILVERCHAT — PROMPT #4b-1: RLS POLICIES & STORAGE SECURITY"
Cohesion: 0.40
Nodes (4): 1. SECURITY PHILOSOPHY, 2.1 `is_chat_member(p_chat_id uuid, p_user_id uuid) RETURNS boolean`, 2. HELPER FUNCTIONS (SECURITY DEFINER, STABLE), SILVERCHAT — PROMPT #4b-1: RLS POLICIES & STORAGE SECURITY

### Community 10 - "SILVERCHAT — PROMPT #4a: DATA MODEL (ENTITIES & RELATIONS)"
Cohesion: 0.50
Nodes (3): 1. ARCHITECTURE PRINCIPLES, 2. ENUMS, SILVERCHAT — PROMPT #4a: DATA MODEL (ENTITIES & RELATIONS)

### Community 11 - "SILVERCHAT — PROMPT #7: CHATS LIST"
Cohesion: 0.50
Nodes (3): 1. LOCKED DECISIONS, 2. MIGRATION `0007_chat_delete_adjustments.sql`, SILVERCHAT — PROMPT #7: CHATS LIST

### Community 12 - "SILVERCHAT — PROMPT #8a: CHAT LAYOUT, MESSAGE RENDERING & COMPOSER"
Cohesion: 0.50
Nodes (3): 1. LOCKED DECISIONS, 2. MIGRATION `0008_messages_enhancements.sql`, SILVERCHAT — PROMPT #8a: CHAT LAYOUT, MESSAGE RENDERING & COMPOSER

### Community 13 - "SILVERCHAT — PROMPT #8b: MESSAGE ACTIONS & VOICE NOTES"
Cohesion: 0.50
Nodes (3): 1. LOCKED DECISIONS, 2. MIGRATION `0009_message_actions.sql`, SILVERCHAT — PROMPT #8b: MESSAGE ACTIONS & VOICE NOTES

### Community 14 - "SILVERCHAT — PROMPT #9: CONTACT PROFILE & CHAT SETTINGS"
Cohesion: 0.50
Nodes (3): 1. LOCKED DECISIONS, 2. MIGRATION `0010_chat_settings.sql`, SILVERCHAT — PROMPT #9: CONTACT PROFILE & CHAT SETTINGS

### Community 15 - "SILVERCHAT — PROMPT #11: COMMUNITIES"
Cohesion: 0.50
Nodes (3): 1. LOCKED DECISIONS, 2. MIGRATION `0012_communities.sql`, SILVERCHAT — PROMPT #11: COMMUNITIES

### Community 16 - "SILVERCHAT — PROMPT #12: CALLS (VOICE & VIDEO)"
Cohesion: 0.50
Nodes (3): 1. LOCKED DECISIONS, 2. MIGRATION `0013_calls_enhancements.sql`, SILVERCHAT — PROMPT #12: CALLS (VOICE & VIDEO)

### Community 17 - "SILVERCHAT — PROMPT #13: PWA, OFFLINE & PUSH NOTIFICATIONS"
Cohesion: 0.50
Nodes (3): 1. LOCKED DECISIONS, 2. DEPENDENCIES, SILVERCHAT — PROMPT #13: PWA, OFFLINE & PUSH NOTIFICATIONS

### Community 18 - "SILVERCHAT — PROMPT #14: INTERNATIONALIZATION & THEME SYSTEM"
Cohesion: 0.50
Nodes (3): 1. LOCKED DECISIONS, 2. DEPENDENCIES, SILVERCHAT — PROMPT #14: INTERNATIONALIZATION & THEME SYSTEM

### Community 19 - "SILVERCHAT — PROMPT #16: DEPLOYMENT & METADATA"
Cohesion: 0.50
Nodes (4): 1. LOCKED DECISIONS, 2. FILE STRUCTURE, 3. DEPENDENCIES, SILVERCHAT — PROMPT #16: DEPLOYMENT & METADATA

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `SILVERCHAT — PROMPT #16: DEPLOYMENT & METADATA` connect `SILVERCHAT — PROMPT #16: DEPLOYMENT & METADATA` to `16-deployment-metadata.md`?**
  _High betweenness centrality (0.008) - this node is a cross-community bridge._
- **Should `16-deployment-metadata.md` be split into smaller, more focused modules?**
  _Cohesion score 0.125 - nodes in this community are weakly interconnected._