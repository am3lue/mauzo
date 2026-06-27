# Mauzo POS — Agent Context

## Environment (.env)

Required variables (live Turso credentials in `.env`):

```
TURSO_DATABASE_URL=your-db.aws-us-east-2.turso.io
TURSO_AUTH_TOKEN=eyJ...
IMGBB_API_KEY=...
CORS_ORIGINS=http://localhost:5173,http://localhost:3000
```

## Build & Run

```sh
npm run build    # esbuild (server.cjs) + Vite (client dist/)
npm run dev      # Vite dev server only
node dist/server.cjs   # Production server on :3000
```

## Architecture

- **Primary storage**: Turso (libSQL over HTTP) — authoritative data store.
- **Offline fallback**: browser localStorage, used only when Turso unreachable.
- **Sync model**: client-side merge by `updatedAt` timestamp (not always-overwrite).
- **Locking**: per-store-code lease-based lock via `locks` table.

## Critical: esbuild CJS bundle ordering

`esbuild` places all imported modules' code **before** the entry module's body.
This means `dotenv.config()` in `api/index.ts` runs after any module-level calls
in `syncHandlers.ts` or `session.ts`.

**Fix**: use lazy initialization instead of module-level `const`:

```ts
// ❌ Bad — runs before dotenv.config()
const db = getDbRepository();

// ✅ Good — defers until first API request
let _db: IDbRepository | null = null;
function db(): IDbRepository {
  if (!_db) _db = getDbRepository();
  return _db;
}
```

## Turso/libSQL transaction rule

❌ Do NOT use `BEGIN` / `COMMIT` / `ROLLBACK` as standalone SQL strings.
The Turso HTTP (Hrana) protocol treats each `execute()` as an implicit
transaction. These statements silently no-op, then `ROLLBACK` fails with
`cannot rollback - no transaction is active`.

✅ Use `client.batch(statements, 'write')` for atomic multi-statement ops.

## Turso Schema

```sql
CREATE TABLE IF NOT EXISTS selling_logs (
  id TEXT PRIMARY KEY, store_code TEXT, items TEXT, total REAL,
  amount_received REAL, change_given REAL, seller_id TEXT,
  seller_name TEXT, created_at TEXT, updated_at TEXT,
  is_debt INTEGER DEFAULT 0, debtor_name TEXT, debtor_phone TEXT,
  debt_status TEXT, debt_paid_amount REAL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS products (
  id TEXT PRIMARY KEY, store_code TEXT, name TEXT, price REAL,
  category TEXT, image TEXT, stock REAL, created_at TEXT, updated_at TEXT
);

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY, store_code TEXT, name TEXT, role TEXT, pin TEXT, created_at TEXT
);

CREATE TABLE IF NOT EXISTS sessions (
  store_code TEXT PRIMARY KEY, updated_at TEXT,
  sales_data TEXT, products_data TEXT, users_data TEXT
);

CREATE TABLE IF NOT EXISTS locks (
  store_code TEXT PRIMARY KEY, client_id TEXT, expires_at INTEGER
);
```

## Passive polling for multi-device visibility

Every 45s, each device fetches data from Turso (read-only pull) and
merges it into local state via timestamp comparison. This ensures
changes made on one device (e.g. boss adding products) appear on
other devices without manual sync.

Merge strategy: cloud items not in local → add; local items not in
cloud → keep; conflicts → newest `updatedAt` wins.

## Key files

| File | Role |
|---|---|
| `src/lib/dbRepository.ts` | Turso SQL operations (batch, lock, session CRUD) |
| `src/server/syncHandlers.ts` | Thin handlers wrapping dbRepository |
| `src/server/session.ts` | Session validation & persistence |
| `api/index.ts` | Express routes, CORS, dotenv loading |
| `server.ts` | HTTP + WebSocket entry point |
| `src/App.tsx` | Client sync engine, Turso-first mount, CSPRNG IDs |
