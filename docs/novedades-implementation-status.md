# Prompt 10 — stopped at local migration failure

Read `.roadmap/10-novedades-stories-channels.md` in full and updated `main`
through commit `c3695b8`, which includes Prompt 09. Work is preserved on
`feat/novedades-stories-channels`.

## Credentials

The current environment exposes `SUPABASE_PROJECT_ID` and
`SUPABASE_ACCESS_TOKEN`. The project ID still identifies production
(`lmzbaxlojgsdwgcxkmzx`), so no staging or production request was attempted.
The developer was asked for the staging ref and a secure access-token binding,
plus confirmation that staging has migrations 0001–0011. No credentials were
read from files, printed, or modified.

## Migration attempt

Prompt 10's migration must be numbered 0012 because 0011 belongs to chat
settings. Its proposed partial index using `WHERE expires_at > now()` cannot
be created in PostgreSQL, so the draft uses an ordinary composite index.

The first local application failed while creating the replacement
`public.can_access_chat_message(uuid,boolean)` function:

```text
ERROR:  syntax error at or near ";"
LINE 9:  );
          ^
```

The migration ran with `BEGIN` and `ON_ERROR_STOP=1` against only the isolated
`supabase_db_silverchat-backend-validation` database. The failing connection
closed before COMMIT. Subsequent read-only checks confirmed rollback:

```text
new_message_column=false
new_story_rpc=false
```

Per the instruction to stop and report a migration failure, no repair or
further migration was attempted. The incomplete file is preserved as
`supabase/migrations/0012_stories_channels.sql.draft`, so migration runners will
not automatically execute it. **Do not apply this draft.**

## Remaining work

- Correct and validate the draft before renaming it to `.sql` and applying it.
- Review story limits/privacy/MFA, channel media and reaction access, and the
  integration with existing message helpers using SQL tests.
- Implement the 16 components, 16 hooks, supporting libraries, routes, and
  existing composer/message-list integration required by Prompt 10.
- Generate types after successful schema application.
- Run unit, SQL, browser, build, lint, and staging/manual end-to-end checks.

No frontend changes or dependency installations were made. Migrations
0001–0011 and all environment files remain unchanged. No PR should be opened
until the required verification passes.
