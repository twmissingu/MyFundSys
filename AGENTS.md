# AGENTS.md - AI Coding Agent Guide

Personal fund investment management system - mobile web app.

**Tech Stack**: React 18 + TypeScript + Vite + Ant Design Mobile + Supabase (PostgreSQL + Edge Functions) + IndexedDB (Dexie.js)

**Deployment**: GitHub Pages (`npm run deploy`)

---

## Commands (all from `frontend/`)

```bash
npm run dev                    # http://localhost:5173/
npm run build                  # tsc -b && vite build → dist/
npm run preview                # Preview production build
npm run deploy                 # Push to gh-pages branch

# Unit Tests (Vitest)
npm test                       # Run all tests
npx vitest run src/__tests__/services/fundApi.test.ts    # Single file
npx vitest run -t "test name"  # By name

# E2E Tests (Playwright)
npm run test:e2e               # All E2E tests
npx playwright test e2e/fund-search.spec.ts              # Single file
npx playwright test -g "test name"                       # By name

# Edge Functions (from repo root)
SUPABASE_ACCESS_TOKEN=<token> supabase functions deploy fund-nav --project-ref xeddgyxugpwmgwmeetme
```

---

## Architecture

### API Call Chain (REQUIRED)

```
Frontend → supabase.functions.invoke(fnName, {body: {...}})
         → Supabase Edge Function (Deno, server-side)
         → EastMoney API
```

- **Always use POST** for `invoke`. Edge Functions read from `req.json()` body, NOT URL path/query
- EastMoney requires mobile UA: `EMProjJijin/8.4.6 (iPhone; iOS 16.0; Scale/3.00)` + `Referer: https://fund.eastmoney.com/`
- **Never** call EastMoney API directly from frontend (CORS blocked)

### Dual Storage Priority

```
Supabase configured → Read/Write Supabase, sync to IndexedDB
Supabase not configured → IndexedDB offline mode only
```

- Use `isSupabaseConfigured()` to check, never hardcode environment checks
- **Never** use `if (isGitHubPages)` workarounds
- Supabase anon key must be JWT format (starts with `eyJ`). `sb_publishable_` format causes 401 on Edge Functions

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
- Functional components with hooks, export default at bottom
- Props interfaces defined above component

```typescript
interface FundCardProps { fund: Fund; onSelect: (code: string) => void; }

const FundCard: React.FC<FundCardProps> = ({ fund, onSelect }) => {
  return <div onClick={() => onSelect(fund.code)}>...</div>;
};

export default FundCard;
```

### Data Operations
- Read: `useSync.ts` hooks (handles dual storage automatically)
- Write local: `db.table.add/update/delete()` from Dexie
- Write cloud: `useSupabase.ts` functions

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
- Uses system Chrome (`channel: 'chrome'`), auto-starts dev server
- Password from `.env` (`TEST_PASSWORD`) - never hardcode

---

## Key Files

| File | Purpose |
|------|---------|
| `frontend/src/pages/Layout.tsx` | Main layout + bottom Tab navigation |
| `frontend/src/db/index.ts` | IndexedDB schema (Dexie v7) |
| `frontend/src/lib/supabase.ts` | Supabase client + `isSupabaseConfigured()` |
| `frontend/src/services/fundApi.ts` | Fund data API (search/nav/cache) |
| `frontend/src/hooks/useSync.ts` | Dual storage sync hooks |
| `frontend/src/hooks/useSupabase.ts` | Supabase CRUD hooks |
| `frontend/src/types/index.ts` | Global TypeScript types |
| `frontend/src/types/database.ts` | Supabase database types |
| `frontend/vitest.config.ts` | Test config (separate from vite.config.ts) |
| `supabase/functions/*/index.ts` | Edge Functions (Deno) |

## Environment Variables

### 前端环境变量（`frontend/.env`，不提交）
- `VITE_SUPABASE_URL` - Supabase 远程项目 URL
- `VITE_SUPABASE_ANON_KEY` - Supabase 匿名公钥（JWT 格式，以 `eyJ` 开头）
- `VITE_APP_PASSWORD` - 应用登录密码（用于 `AuthPage.tsx`）
- `TEST_PASSWORD` - Playwright E2E 测试密码

### 本地开发环境变量（`.env.local`，不提交）
- `NEXT_PUBLIC_SUPABASE_URL` - 本地 Supabase URL（`http://localhost:54321`）
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` - 本地 Supabase 匿名公钥
- `SUPABASE_SERVICE_ROLE_KEY` - 本地 Supabase 服务端密钥（敏感信息）
- `LOG_LEVEL` - 日志级别（`debug`/`info`/`warn`/`error`）
- `DEBUG` - 调试模式开关
- `API_TIMEOUT` - API 请求超时时间（毫秒）
- `CACHE_DURATION` - 数据缓存时间（秒）

### 环境变量管理规则
1. **前端敏感信息**：放在 `frontend/.env`（Vite 前端构建时使用）
2. **后端/CLI 敏感信息**：放在 `.env.local`（Python 后端、Supabase CLI 使用）
3. **服务端密钥**：永远不要放在前端可访问的文件中
4. **本地 vs 远程**：前端默认使用远程 Supabase，本地 Supabase 配置仅用于后端/CLI

## Database Schema

| Table | Description |
|-------|-------------|
| `holdings` | Positions (fund_code UNIQUE) |
| `transactions` | Trade records (buy/sell) |
| `favorite_funds` | Watchlist |
| `fund_cache` | Search cache |

RLS enabled with ALLOW ALL policy (single-user mode).

## Decision Framework

- **Autonomous**: Code style, bug fixes, obvious optimizations
- **Quick consult**: Technical choices, architecture patterns (timeout = auto-decision)
- **Must confirm**: Business logic changes, data structure modifications
