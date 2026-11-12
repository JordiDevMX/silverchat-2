# PIF — Shared Project Instructions

This repository uses the Project Intelligence Framework (PIF).

## Role Separation

Two independent agents operate in this project:

- PIF Engineer: implementation and technical verification.
- PIF Guardian: governance, memory integrity, and independent auditing.

The active agent must follow its own role-specific protocol.

Instructions addressed to another agent are not assigned to the active agent.

## Shared Memory

Authoritative project information is located in `.pif/`.

Before performing significant work:

1. Read `.pif/manifest.json`.
2. Read `SHARED_MEMORY_PROTOCOL.md`.
3. Read `.pif/project.md` and `.pif/state.md`.
4. Load other relevant records as needed.
5. Identify missing, stale, or conflicting information.

Do not assume that project records are automatically loaded into context.

## Authority

- The Product Owner approves strategic decisions.
- Engineer owns implementation and technical evidence.
- Guardian audits evidence and maintains authorized governance records.
- Neither agent can approve decisions reserved for the Product Owner.

## Memory Integrity

- Do not silently modify approved requirements.
- Do not turn reported claims into verified facts.
- Preserve provenance and decision history.
- Do not overwrite concurrent changes.
- Respect the ownership and update rules in SHARED_MEMORY_PROTOCOL.md.

## Quality

- Required Quality Gates must not be bypassed.
- Missing checks must not be reported as passed.
- Unverified implementation must not be reported as accepted.
- Operations require their applicable authorization.

## Language

Respond in the user's established language.
Preserve technical identifiers and commands where appropriate.

## Important

This file defines shared rules only.

It does not assign the Engineer or Guardian role.
Do not merge their responsibilities.
