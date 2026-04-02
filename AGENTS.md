# AGENTS.md - AI Coding Agent Guide

This document provides guidance for AI coding agents working in this repository.

## Project Overview

Personal fund investment management system - a mobile web application.

**Tech Stack**: React 18 + TypeScript + Vite + Ant Design Mobile + Supabase (PostgreSQL + Edge Functions) + IndexedDB (Dexie.js)

**Deployment**: GitHub Pages (`npm run deploy`)

---

## Commands

All commands run from `frontend/` directory:

```bash
# Development
npm run dev                    # Start dev server at http://localhost:5173/
npm run build                  # TypeScript compile + Vite build → dist/
npm run preview                # Preview production build locally
npm run deploy                 # Push to gh-pages branch

# Unit Tests (Vitest)
npm test                       # Run all tests once
npm run test:watch             # Watch mode
npx vitest run src/__tests__/services/fundApi.test.ts    # Single file
npx vitest run -t "test name"  # Run test by name pattern

# E2E Tests (Playwright)
npm run test:e2e               # Run all E2E tests
npm run test:e2e:ui            # Open Playwright UI mode
npx playwright test e2e/fund-search.spec.ts              # Single file
npx playwright test -g "test name"                       # Run by name

# Edge Functions (from repo root)
SUPABASE_ACCESS_TOKEN=<token> supabase functions deploy fund-nav --project-ref xeddgyxugpwmgwmeetme
```

---

## Architecture

### API Call Chain (REQUIRED)

```
Frontend → supabase.functions.invoke(fnName, {body: {...}})
         → Supabase Edge Function (Deno, server-side)
         → EastMoney API (no CORS)
```

- **Always use POST** for `invoke`. Edge Functions read from `req.json()` body, NOT URL path/query
- **Never** call EastMoney API directly from frontend (CORS blocked)

### Dual Storage Priority

```
Supabase configured → Read/Write Supabase, sync to IndexedDB
Supabase not configured → IndexedDB offline mode only
```

- Use `isSupabaseConfigured()` to check, never hardcode environment checks

---

## Code Style

### File Naming
- Components/Pages: PascalCase (`FundDetail.tsx`)
- Hooks: `use` prefix (`useSync.ts`)
- Services/Utils: camelCase (`fundApi.ts`)
- Tests: `*.test.ts` or `*.spec.ts`

### Imports
- React imports first, then third-party, then local
- Use `import type { ... }` for type-only imports
- Relative paths for local imports (`../hooks/useSync`)

```typescript
import React, { useState, useEffect } from 'react';
import { Button, Toast } from 'antd-mobile';
import { db } from '../db';
import type { Holding, Transaction } from '../types';
```

### TypeScript
- Strict mode enabled - avoid `any` except for third-party API responses
- Supabase insert operations may need `as any` due to client type limitations
- Define interfaces in `src/types/index.ts` for global types

### Components
- Use functional components with hooks
- Export default at bottom of file
- Props interfaces defined above component

```typescript
interface FundCardProps {
  fund: Fund;
  onSelect: (code: string) => void;
}

const FundCard: React.FC<FundCardProps> = ({ fund, onSelect }) => {
  return <div onClick={() => onSelect(fund.code)}>...</div>;
};

export default FundCard;
```

### Data Operations
- Read: Use hooks from `useSync.ts` (handles dual storage automatically)
- Write local: Use `db.table.add/update/delete()` from Dexie
- Write cloud: Use functions from `useSupabase.ts`

---

## Testing

### Unit Tests (Vitest)
- Framework: Vitest v4 + @testing-library/react + fake-indexeddb
- Setup file: `src/__tests__/setup.ts`

**Mock pattern** - use `vi.hoisted()` for mocks that must exist before module load:

```typescript
const mockInsert = vi.hoisted(() => vi.fn());
vi.mock('../../lib/supabase', () => ({
  isSupabaseConfigured: vi.fn(() => true),
  supabase: { from: () => ({ insert: mockInsert }) }
}));
```

**Test isolation** - always reset mocks and clear IndexedDB in `beforeEach`:

```typescript
beforeEach(async () => {
  vi.clearAllMocks();
  await db.holdings.clear();
});
```

### E2E Tests (Playwright)
- Uses system Chrome browser (`channel: 'chrome'`)
- Auto-starts dev server via `webServer` config
- Password from `.env` file (`TEST_PASSWORD` variable)
- Never hardcode passwords in test files

---

## Key Files

| File | Purpose |
|------|---------|
| `frontend/src/pages/Layout.tsx` | Main layout + bottom Tab navigation |
| `frontend/src/db/index.ts` | IndexedDB schema (Dexie v7) |
| `frontend/src/lib/supabase.ts` | Supabase client + `isSupabaseConfigured()` |
| `frontend/src/services/fundApi.ts` | Fund data API (search/nav/cache) |
| `frontend/src/hooks/useSync.ts` | Dual storage sync hooks |
| `frontend/src/types/index.ts` | Global TypeScript types |
| `supabase/functions/*/index.ts` | Edge Functions (Deno) |

## Environment Variables

Stored in `frontend/.env` (not committed to git):
- `VITE_SUPABASE_URL` - Supabase project URL
- `VITE_SUPABASE_ANON_KEY` - Supabase anon key (JWT format, starts with `eyJ`)
- `VITE_APP_PASSWORD` - Application login password
- `TEST_PASSWORD` - Playwright test password

## Database Schema

| Table | Description |
|-------|-------------|
| `holdings` | Positions (fund_code UNIQUE) |
| `transactions` | Trade records (buy/sell) |
| `favorite_funds` | Watchlist |
| `fund_cache` | Search cache |

RLS enabled with ALLOW ALL policy (single-user mode).
