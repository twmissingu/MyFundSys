# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

个人基金投资管理系统，移动端 Web 应用。

**技术栈**: React 18 + TypeScript + Vite + Ant Design Mobile + Supabase (PostgreSQL + Edge Functions) + IndexedDB (Dexie.js)

**部署**: GitHub Pages (`npm run deploy`)

**API**: 东方财富 (通过 Supabase Edge Functions 代理，解决 CORS)

**文档结构**:
- `docs/deployment/` - 部署和配置文档
- `docs/development/` - 开发指南和测试文档
- `docs/archive/` - 历史文档和归档资料

---

## Common Commands

All commands run from `frontend/` directory:

```bash
# Development
cd frontend && npm run dev          # http://localhost:5173/

# Testing
npm test                            # Run all tests (Vitest)
npm run test:watch                  # Watch mode
npm run test:watch -- src/__tests__/services/fundApi.test.ts   # Single file watch
npx vitest run src/__tests__/services/syncService.test.ts      # Run single test file once

# Build & Deploy
npm run build                       # TypeScript compile + Vite build → dist/
npm run deploy                      # Push to gh-pages branch

# Edge Functions (from repo root)
SUPABASE_ACCESS_TOKEN=<token> supabase functions deploy fund-nav --project-ref xeddgyxugpwmgwmeetme
```

---

## Key Files

| File | Purpose |
|------|---------|
| `frontend/src/pages/Layout.tsx` | Main layout + bottom Tab navigation |
| `frontend/src/db/index.ts` | IndexedDB schema (Dexie v7) |
| `frontend/src/lib/supabase.ts` | Supabase client + `isSupabaseConfigured()` |
| `frontend/src/services/fundApi.ts` | Fund data API (search/nav/cache) |
| `frontend/src/hooks/useSync.ts` | Dual storage sync (Supabase priority, IndexedDB fallback) |
| `frontend/src/hooks/useSupabase.ts` | Supabase CRUD hooks |
| `frontend/src/types/index.ts` | Global TypeScript types |
| `frontend/src/types/database.ts` | Supabase database types |
| `frontend/vitest.config.ts` | Test configuration (separate from vite.config.ts) |
| `supabase/functions/fund-nav/index.ts` | Edge Function: fetch fund NAV |
| `supabase/functions/fund-search/index.ts` | Edge Function: search funds |
| `supabase/functions/fund-history/index.ts` | Edge Function: historical NAV |

---

## Architecture Conventions

### 1. Fund API Call Chain (REQUIRED)

```
Frontend → supabase.functions.invoke(fnName, {body: {...}})
         → Supabase Edge Function (Deno, server-side)
         → EastMoney API (no CORS)
```

- **Always use POST** for `invoke`. Edge Functions must read from `req.json()` body, NOT URL path/query string
- EastMoney API requires mobile UA: `EMProjJijin/8.4.6 (iPhone; iOS 16.0; Scale/3.00)` + `Referer: https://fund.eastmoney.com/`
- **Never** call EastMoney API directly from frontend (CORS blocked)

### 2. Dual Storage Priority

```
Supabase configured → Read/Write Supabase, sync to IndexedDB
Supabase not configured → IndexedDB offline mode only
```

- Use `isSupabaseConfigured()` to check, never hardcode environment checks
- **Never** use `if (isGitHubPages)` workarounds (already removed, do not reintroduce)

### 3. Supabase Key Format

- Must use JWT format anon key (starts with `eyJ`)
- `sb_publishable_` format causes 401 on Edge Functions

---

## Testing

- **Framework**: Vitest v4 + @testing-library/react + fake-indexeddb
- **Mock pattern**: Use `vi.hoisted()` for mocks that must exist before module load:

```typescript
const mockInsert = vi.hoisted(() => vi.fn());
vi.mock('../../lib/supabase', () => ({
  isSupabaseConfigured: vi.fn(() => true),
  supabase: { from: () => ({ insert: mockInsert }) }
}));
```

- **Test isolation**: Always reset mocks and clear IndexedDB in `beforeEach`:

```typescript
beforeEach(async () => {
  vi.clearAllMocks();
  await db.holdings.clear();
});
```

---

## Code Standards

**File naming**:
- Components/Pages: PascalCase (`FundDetail.tsx`)
- Hooks: `use` prefix (`useSync.ts`)
- Services/Utils: camelCase (`fundApi.ts`)

**Data operations**:
- Read: Use `useSync.ts` hooks (handles dual storage automatically)
- Write local: Use `db.table.add/update/delete()` from Dexie
- Write cloud: Use `useSupabase.ts` functions

**TypeScript**:
- Strict mode enabled
- Avoid `any` except for third-party API responses
- Supabase insert operations may need `as any` due to client type limitations

---

## Database Schema

| Table | Description |
|-------|-------------|
| `holdings` | Positions (fund_code UNIQUE) |
| `transactions` | Trade records (buy/sell) |
| `favorite_funds` | Watchlist |
| `fund_cache` | Search cache |

RLS enabled with ALLOW ALL policy (single-user mode, no user_id field).

---

## Decision Framework

- **Autonomous**: Code style, bug fixes, obvious optimizations
- **Quick consult**: Technical choices, architecture patterns (timeout = auto-decision)
- **Must confirm**: Business logic changes, data structure modifications

Stop and ask when conflicts arise or business requirements are unclear.