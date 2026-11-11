# PIF Shared Memory — Operating Protocol v1.0

## Purpose
Provide a persistent, auditable, recoverable and minimally redundant record of project intent, approved decisions, technical implementation claims, verification evidence and current state. This is a **data/governance contract**, not an autonomous agent persona.

## 1. Roles
- **Product Owner:** approves/rejects scope changes, strategic choices, explicit exceptions and final acceptance where required.
- **PIF Engineer:** reads the current baseline, proposes changes, implements authorized work, submits actual artifact identifiers, checks and results; may not mark its own unverified claims as independently verified.
- **PIF Guardian:** verifies sources when accessible, manages canonical records only with write permission, records findings and gate status, flags contradictions, and withholds positive audit findings when evidence is insufficient.

No role can override the host's instructions, tool permissions, repository protections or applicable safety requirements. Guardian's advisory BLOCKED status does not technically stop Engineer unless the workflow enforces it.

## 2. Canonical files and minimalism
The canonical records are `project.md`, `requirements.md`, `roadmap.md`, `state.md`, `traceability.md`, `decisions/`, `evidence/index.md`, and `history/changes.md`. `inbox/` contains proposals, not accepted truth. `handoffs/` contains portable summaries, not a replacement for the canonical baseline. Small projects may keep sections empty and avoid creating extra files. Never store duplicated authoritative versions of the same fact.

## 3. Claim classification
- `VERIFIED`: independently inspected evidence supporting the *specific claim*, with source and revision.
- `USER_APPROVED`: explicit human authorization; not proof that implementation works.
- `REPORTED`: someone claims an outcome, not independently validated.
- `INFERRED`: derived from evidence, with reasoning and uncertainty.
- `PROPOSED`: not accepted.
- `UNKNOWN`: unavailable or unresolved.
- `STALE`: previously valid evidence potentially invalidated by changes.
- `CONFLICTED`: inconsistent sources, pending reconciliation.

Do not convert REPORTED to VERIFIED by copying the claim. Cite file paths, commits, job URLs/IDs, actual outputs and tested environment when relevant; say when inaccessible. Do not invent evidence.

## 4. Record and link conventions
Use stable IDs: `GOAL-###`, `FR-###`, `NFR-###`, `CON-###`, `TASK-###`, `ADR-###`, `RISK-###`, `TEST-###`, `EVID-###`, `CHG-###`, `AUD-###`. Avoid generating IDs for trivial details. Never reuse IDs. Links are directional: `implements`, `verified_by`, `depends_on`, `affects`, `supersedes`, `derived_from`; they can be queried in reverse without implying symmetric meaning. Identify links as verified, documented or inferred where important.

## 5. Controlled update transaction
1. Read current manifest and affected files; check repository revision and working tree.
2. Identify the requested update, its source and applicable approval.
3. Check impact on requirements, decisions, tasks, tests, risks and evidence.
4. Prepare a proposed diff; preserve previous decision history.
5. Obtain approval for material baseline or scope changes. Guardian may apply authorized clerical corrections and evidence-backed status updates within defined permissions.
6. Re-read affected files before writing; if intervening changes conflict, STOP and reconcile. Prefer a protected governance branch or reviewed PR; do not blindly overwrite.
7. Write the change, update the change log for material changes, and verify files on disk.
8. Record the source revision and any residual uncertainty. Do not claim persistence until the write and its intended persistence mechanism succeed.

Git commits/versioning do not constitute human approval unless explicitly mapped to an approval workflow. Never store secret values or unnecessary personal information.

## 6. State and quality gates
Track `NOT_STARTED`, `READY`, `IN_PROGRESS`, `IMPLEMENTED`, `AWAITING_VERIFICATION`, `VERIFIED`, `AWAITING_ACCEPTANCE`, `ACCEPTED`, `BLOCKED`, `SUPERSEDED`, `CANCELLED`. These are states, not automatic transitions. Check results are `PASS`, `FAIL`, `BLOCKED`, `NOT_RUN`, `N/A`.

Gate labels align with Engineer: G0 isolation; G1 requirements/plan; G2 implementation integrity; G3 AI technical verification; G4 human verification (if applicable); G5 delivery readiness; G6 release/operational acceptance (if applicable). A mandatory applicable check in FAIL, BLOCKED or NOT_RUN prevents a gate from PASS. Separate verified technical status from human acceptance. Unknown or expired evidence must not count as PASS.

## 7. Bidirectional traceability
For each significant requirement, link tasks, decisions, implementation references, test cases and evidence. For each significant implementation component, be able to identify its requirement or legitimate technical purpose and verification. Missing links flag investigation; they do not prove code should be deleted. Review direct and indirect impacts before material changes.

## 8. Evidence freshness
Bind evidence to the relevant artifact version (e.g., full commit SHA), environment, procedure, observed result and timing when important. Changes may invalidate previous evidence; mark as STALE until relevant checks are repeated. A test pass demonstrates only its covered conditions.

## 9. Agent handoff
Engineer submits `inbox/<task>-report.md` containing scope, branch, commits, changes, commands/checks with real results, human checklist, risks and open gates. Guardian compares against baseline and accessible sources, creates `AUD-...` findings and updates canonical state when authorized. If no shared access exists, user transfers files/summaries explicitly; never assume automatic agent communication.

## 10. Recovery
On session start: read manifest → project → state → relevant requirements/decisions/traceability → latest evidence → current Git state if accessible. Report any missing or conflicting sources. Do not reconstruct unknown facts as certainty. For handoffs, include baseline revision, exact task, gate states, blockers, risks and next authorized action.

## 11. Stop conditions
Do not recommend passing a mandatory gate or accepting a task when material approvals, evidence, human checks or required tests are missing. Distinguish a governance recommendation from enforcement through real repository permissions. Safe unrelated investigation can continue.

## 12. Language
Agent-facing protocol is English. Each agent responds in the user's chosen language (initial project description or explicit subsequent preference). Do not translate stable IDs, paths or technical literals. Project records follow the language policy approved for that project.
