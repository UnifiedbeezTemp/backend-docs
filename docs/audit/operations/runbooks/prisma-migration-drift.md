---
sidebar_position: 3
---

# Runbook: Prisma Migration Drift

**Trigger:** `prisma migrate dev` refuses to proceed, reports drift or checksum mismatch, and offers to reset the database.

---

## Symptom

Running `npx prisma migrate dev` outputs one of:

```
✖ There is a discrepancy between the migration files in your local prisma/migrations
  folder and the migration records in the _prisma_migrations table.
```

or:

```
✖ Your local migration history is different from the database's migration history.
  Drift detected
```

and then offers a database reset.

---

## Stop. Do Not Run the Reset.

`prisma migrate reset` drops the entire database. **Do not run it against any environment that has real data** without explicit confirmation and a backup.

---

## Diagnosis

### Step 1 — See the full status

```bash
npx prisma migrate status
```

This shows:
- Which migrations are applied in the DB
- Which migration files are unapplied
- Which applied migrations have a checksum mismatch (edited after application)

### Step 2 — Identify the cause

| Symptom in `migrate status` | Likely cause |
|---|---|
| Migration file exists but not applied | SQL was run out-of-band (e.g., `db push`, `psql` directly) before the migration file was created |
| Checksum mismatch on an applied migration | Migration file was edited after it was applied |
| Migration applied in DB but file is missing | File was deleted from the repo |

### Step 3 — Confirm the DB already has the effect

For unapplied migration files where the DB already has the schema change:

```bash
# Connect to the DB and check
psql $DATABASE_URL -c "\d table_name"
```

---

## Resolution

### Case A — Migration file exists but DB already has the effect (most common)

The migration was applied out-of-band. Mark it as applied without running it:

```bash
npx prisma migrate resolve --applied "<migration-name>"
# Example:
npx prisma migrate resolve --applied "20260417075018_add_channel_account_status"
```

This records the migration as applied in `_prisma_migrations` without executing its SQL. Run `prisma migrate status` to confirm it's resolved.

### Case B — Checksum mismatch (migration was edited after application)

**Do not edit the migration file again.** Write a new corrective migration instead:

```bash
# Generate a corrective migration
npx prisma migrate dev --name fix_<description> --create-only
# Review the generated SQL
# Apply it
npx prisma migrate dev
```

### Case C — Migration file is missing (deleted from repo)

1. Restore the file from git history: `git log --all --full-history -- prisma/migrations/`.
2. If the file is unrecoverable, write a new idempotent migration with `IF NOT EXISTS` guards that matches what's in the DB, then mark it as applied with `--applied`.

---

## Prevention

- Never run `prisma db push`, `prisma db execute`, or raw `psql` DDL against any environment. All schema changes must go through `prisma migrate dev --create-only` → review → `prisma migrate dev`.
- Never edit a migration file after it has been applied anywhere.
- If working with an agent (Claude Code, Copilot), confirm it is going through the migration path and not suggesting `db push`.

---

## Related

- [Deployment](../../infrastructure/deployment) — migration apply order in production
- [Coding Standards](../../backend/coding-standards) — database standards section
