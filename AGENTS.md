# Agent Instructions

These instructions apply to all agents and delegated subagents working in this repository, regardless of programming language, framework, platform, or project type.

## Instruction Priority

- Follow the human owner's explicit instructions first, then this file, then tool-specific workflows and skills, subject to higher-priority safety constraints.
- Use available workflows such as Superpowers rather than duplicating their methodology here. When a workflow conflicts with an explicit rule in this file, follow this file.
- Delegation never expands permissions: subagents must follow the same instructions and authorization boundaries.

## Discover Before Changing

- Understand the task, relevant architecture, existing conventions, and affected components before modifying files. Investigate available project configuration and relevant documentation; do not assume a particular language, framework, package manager, or command.
- If Graphify is available, **before writing code** read `graphify-out/GRAPH_REPORT.md` and use `graphify query` to investigate the components relevant to the task, their responsibilities, and their connections. Use `graphify explain` and/or `graphify path` when deeper investigation is useful. Prefer Graphify for architectural exploration; inspect source directly when implementation details require it.
- If Graphify is not available, use the project's normal discovery tools and relevant documentation instead.
- Check existing components, utilities, patterns, and conventions before introducing new ones. Prefer reuse and the simplest solution that meets the requirements.
- Investigate before asking questions. Ask when an unresolved ambiguity would materially change the result or when a decision belongs to the owner; do not invent product requirements.

## Scope and Implementation

- Work strictly within the requested scope. Do not make unrelated fixes, refactors, cleanups, upgrades, or enhancements. Report out-of-scope findings rather than changing them; obtain approval before expanding scope.
- Follow applicable Superpowers skills for design, planning, implementation, TDD, debugging, review, and verification. Adapt their Git commit timing to the policy below.
- Resolve issues caused by your own changes. Do not silently repair pre-existing failures outside the task; report them clearly.
- Work autonomously on authorized, reversible steps. Stop and ask only when an approval, material decision, or unresolved blocker requires human input.

## Git and Delivery Boundaries

- Assume the project uses Git. **Before creating or modifying any version-controlled file**, including design documents and plans, create or select a task-specific branch. Never edit or commit directly on `main` or the repository's protected primary branch. The branch name should be descriptive; no particular prefix is required.
- Keep work on the task branch, including Superpowers artifacts. Use worktrees when appropriate under the applicable workflow.
- Preserve pre-existing and other people's changes. Do not overwrite, discard, or include them in your commits. If they overlap with your work and cannot be separated safely, ask the owner.
- **Commit at the end of a completed work turn**, after appropriate verification and before handing the completed result back to the owner. Do not create microcommits for every TDD step or minor edit. If waiting for a decision or permission to finish the work, do not make a premature completion commit.
- Stage only changes belonging to the current task. Inspect staged changes before committing; avoid broad staging commands when unrelated modifications are present. Use English commit messages.
- **Ask for and receive explicit approval before pushing.** Separately **ask for and receive explicit approval before creating a pull request**. Approval for one does not imply approval for the other.
- **Never merge branches.** Only the human owner performs merges. Changes reach the protected primary branch through a pull request and the owner's merge.
- Branch and worktree cleanup may follow the applicable Superpowers workflow, including its safeguards against losing uncommitted work. Do not perform destructive cleanup without the required confirmation.

## Permissions and External Effects

- Read-only inspection of repositories, databases, services, and other resources is permitted within the tools and access provided.
- Obtain explicit authorization **before modifying remote data, database schemas, database policies, or other external resources**, or before sending information to third parties, unless a specific exception has already been authorized.
- Deployments to a designated **staging or non-production environment** are permitted within the task's approved scope. Obtain explicit approval before deploying to **production**. A deployment allowance does not authorize database mutations or unrelated remote changes.
- Obtain explicit approval before destructive, irreversible, or difficult-to-reverse operations, including destructive Git commands, significant deletion, overwriting valuable data, or actions affecting physical devices. Do not assume a general task approval covers such operations.
- Read variable names, configuration schemas, and examples as needed, but never expose credentials or other secrets in responses, logs, artifacts, or commits. Obtain approval before modifying environment files or credential configuration.
- An authorization applies only to the stated operation and scope. Do not infer permission for additional actions.

## Dependencies and Tooling

- Discover the project's actual package manager, dependency files, lockfiles, and verification commands from its configuration. Do not assume a JavaScript or web project.
- You may restore already-declared dependencies using the project's lockfile and deterministic installation mode, without changing dependency declarations or resolved versions.
- Obtain explicit approval before **adding, upgrading, replacing, or removing** dependencies. Review each proposed change individually; do not run blind or bulk upgrades.
- Prefer exact version pinning where the ecosystem supports it, preserve and commit the relevant lockfile when dependency changes are approved, and never bypass established package-manager or lockfile safeguards.
- Before proposing a new dependency, assess its necessity, source, maintenance, release history, publisher/provenance when available, and installation/build scripts. Do not introduce direct Git or tarball dependencies or enable otherwise-restricted install scripts without explicit approval.

## Verification

- Follow the project's available testing conventions and relevant Superpowers TDD workflow. Run focused tests needed to verify the behavior being changed.
- Prefer editor or tool diagnostics for quick feedback on touched files when available. Do not automatically run full lint, typechecking, or broad validation after every small change.
- Run broader checks, including typechecking, when the owner requests them, when a change poses a concrete technical risk, or when focused diagnostics are insufficient.
- Do not declare a task complete if requirements are unmet, your changes introduce unresolved failures, or known safety issues caused by the task remain. Distinguish new failures from pre-existing ones.
- In the final chat response, accurately describe what was verified, what was skipped, and any remaining limitations. Briefly mention skipped validation for small changes.

## Documentation and Language

- Keep Superpowers design documents in `docs/superpowers/specs/` and implementation plans in `docs/superpowers/plans/`, on the task branch.
- Do not create extra documentation for routine changes. For substantial or complex work, you may create useful documentation under `docs/`; explain in the chat what you created and why. Also create documentation when explicitly requested.
- Avoid redundant, scattered, or speculative documentation. Consult existing project documentation when relevant rather than reading everything by default.
- **Use English for all repository artifacts**: source code, identifiers, comments, documentation, tests, commit messages, pull requests, and user-facing strings created for the project unless the task explicitly requires localized content.
- The **interactive chat** may use whichever language the human owner prefers. Explain completed work naturally in the chat; no rigid report template is required.
