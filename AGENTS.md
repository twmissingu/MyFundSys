# AGENTS.md - AI Coding Agent Guide

Personal fund investment management system - mobile web app.

**Tech Stack**: React 18 + TypeScript + Vite + Ant Design Mobile + Supabase (PostgreSQL + Edge Functions)

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

### Data Source

```
Supabase → 唯一数据源
  ↓
前端从 transactions 派生持仓批次（Lot）
  ↓
批次 → 持仓明细 + 落袋为安
```

- Use `isSupabaseConfigured()` to check, never hardcode environment checks
- Supabase anon key must be JWT format (starts with `eyJ`)

### Environment Isolation

```
frontend/.env          → 生产 Supabase
frontend/.env.local    → 测试 Supabase (本地优先使用)
```

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

### TypeScript
- Strict mode enabled - avoid `any` except for third-party API responses
- Supabase insert operations may need `as any` due to client type limitations
- Define interfaces in `src/types/index.ts` for global types

### Components
- Functional components with hooks, export default at bottom
- Props interfaces defined above component

---

## Testing

### Unit Tests (Vitest)
- Framework: Vitest v4 + @testing-library/react + fake-indexeddb
- Setup file: `src/__tests__/setup.ts`
- 85 tests covering fundApi, transaction date/NAV logic

**Mock pattern** - use `vi.hoisted()` for mocks that must exist before module load:

```typescript
const mockInsert = vi.hoisted(() => vi.fn());
vi.mock('../../lib/supabase', () => ({
  isSupabaseConfigured: vi.fn(() => true),
  supabase: { from: () => ({ insert: mockInsert }) }
}));
```

---

## Key Files

| File | Purpose |
|------|---------|
| `frontend/src/pages/Layout.tsx` | Main layout + bottom Tab navigation |
| `frontend/src/db/index.ts` | Type definitions + Supabase operations |
| `frontend/src/lib/supabase.ts` | Supabase client + `isSupabaseConfigured()` |
| `frontend/src/services/fundApi.ts` | Fund data API (search/nav/cache) |
| `frontend/src/services/navUpdateService.ts` | Lot derivation, sell matching, realized P&L |
| `frontend/src/hooks/useSync.ts` | Data access hooks (holdings from transactions) |
| `frontend/src/types/index.ts` | Global TypeScript types |
| `frontend/src/types/database.ts` | Supabase database types |
| `frontend/vitest.config.ts` | Test config |
| `supabase/functions/*/index.ts` | Edge Functions (Deno) |

## Environment Variables

### 前端环境变量（`frontend/.env`，不提交）
- `VITE_SUPABASE_URL` - Supabase 远程项目 URL
- `VITE_SUPABASE_ANON_KEY` - Supabase 匿名公钥（JWT 格式，以 `eyJ` 开头）
- `VITE_APP_PASSWORD` - 应用登录密码
- `TEST_PASSWORD` - Playwright E2E 测试密码

### 本地开发环境变量（`.env.local`，不提交）
- 本地开发时创建 `frontend/.env.local`，填入测试 Supabase 密钥
- Vite 自动优先读取 `.env.local`

## Database Schema

| Table | Description |
|-------|-------------|
| `transactions` | Trade records (buy/sell, pending/completed) |
| `holdings` | Positions (derived from transactions, kept for compatibility) |
| `favorite_funds` | Watchlist |
| `fund_cache` | Search cache |

RLS enabled with ALLOW ALL policy (single-user mode).

## Core Business Logic

### Lot Derivation
```
deriveLots(transactions) → Lot[]
  - All buy transactions → lots (including pending)
  - Sell transactions match lots by cost (lowest first)
  - Lots with remainingShares > 0 → holdings
  - Lots with remainingShares < 0.01 → realized P&L
```

### Sell Matching
```
Sell shares → find lots for fund (sorted by cost ascending)
  → deduct from each lot until sell amount satisfied
  → create sell transaction
  → lots fully sold → move to realized P&L
```

### Total Assets
```
totalAssets = Σ(lot.remainingShares × currentNav) + pendingBuyAmount
totalCost = Σ(lot.remainingShares × lot.cost) + pendingBuyAmount
floatingPnL = totalAssets - totalCost
realizedPnL = Σ(realizedLots.profit)
cumulativePnL = floatingPnL + realizedPnL
```

## Decision Framework

- **Autonomous**: Code style, bug fixes, obvious optimizations
- **Quick consult**: Technical choices, architecture patterns (timeout = auto-decision)
- **Must confirm**: Business logic changes, data structure modifications
