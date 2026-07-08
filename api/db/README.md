# Drizzle schema

`schema.js` is hand-edited and is the source of truth for the database
structure -- this is a code-first setup, not a SQL-first one. Nothing under
`db/` is generated from a SQL dump; it's the other way around: SQL migrations
are generated _from_ `schema.js`.

## Workflow

1. Edit `schema.js` directly (add/change/remove tables or columns).
2. Generate a migration from the diff:
   ```
   npm run migrate:create
   ```
   This runs `drizzle-kit generate`, which diffs `schema.js` against the
   migration history in `db/migrations/meta/` and writes a new `.sql` file
   plus a journal entry. Review the generated SQL before applying it.
3. Apply pending migrations:
   ```
   npm run migrate:apply
   ```
   This runs `drizzle-kit migrate`, which tracks what's already applied in
   a `__drizzle_migrations` table it creates on first run. Safe to run
   repeatedly -- only unapplied migrations run.

Never hand-write files in `db/migrations/`; always generate them via
`migrate:create` so the journal/snapshot metadata stays consistent.

MySQL DDL auto-commits per statement, so a failed migration isn't rolled
back. Drizzle stops at the first failing statement and doesn't record that
migration as applied -- write statements idempotently (`IF [NOT] EXISTS`)
so a fixed re-run is safe.

## Reference data

`migrate:apply` creates structure only. To load or update reference data:

```
npm run db:seed
```

It seeds the `gn_*_variant` catalogs and the subscription products and
prices from `db/seed/data/*.js`. It never touches `users` or other
user-generated tables. Re-running is safe, and it also clears the Redis
mapper cache.

- `product_lists`, `product_list_variant`, `gn_religion_variant`: matched by
  key and updated in place.
- The other `gn_*_variant` tables: a changed label retires the old row
  (`status = 0`) and inserts a new one, so existing references still resolve.
- `gn_religion_variant` is updated in place because `id_ai` is its code.

Deploys run migrate and seed automatically (see the workflow).

## Client

`client.js` exports `db` (the Drizzle instance) and `pool` (the underlying
mysql2 pool, for anything not yet ported). Import `db` and the tables you
need from `./schema.js` (or `../db/schema.js` from a router file).
