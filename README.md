[![English](https://img.shields.io/badge/English-blue.svg)](README.md)
[![中文](https://img.shields.io/badge/中文-red.svg)](README_zh.md)

---

# MyFundSys

**Lot-level fund portfolio with NAV auto-reconciliation, dashboard cockpit, and grid trading** — every buy is tracked as an independent lot, sells match per-lot (explicit lot → grid execution → lowest cost), pending trades auto-confirm, and grid strategies execute with full traceability.

[Live Demo](https://twmissingu.github.io/MyFundSys/) · [Architecture](#architecture) · [Quick Start](#quick-start)

## Why?

Most fund tracking apps show you a single average cost per fund. MyFundSys tracks **each buy as a separate lot**, so you know exactly which lots are profitable, which are underwater, and your true realized P&L when you sell. Pending trades (T+1 settlement) are handled automatically — no manual NAV entry needed.

## Features

- **Portfolio Cockpit** — dashboard with action cards, risk dashboard (deployment rate, concentration, valuation signal), total asset trend
- **Lot-based accounting** — each buy is an independent lot with its own cost basis
- **Lot Lifecycle Traceability** — per-buy timeline showing partial sells, realized P&L, holding days, and remaining floating P&L
- **Smart sell matching** — when selling a specific lot the exact lot is deducted; otherwise grid-execution match, then lowest-cost-first
- **Pending trade auto-confirm** — T+1 trades auto-complete when NAV is published; failure alerts with manual NAV entry fallback
- **Realized P&L tracking** — win rate, cumulative gains, holding days per lot
- **Cloud sync** — Supabase PostgreSQL, multi-device sync
- **Market valuation** — PE/PB temperature gauge, auto-updated every 2 hours
- **Fund search & detail** — search by code/name, historical NAV charts with MACD/KDJ/MA5/10/20
- 🎯 **Grid Trading** — define grid parameters (small/medium/large), ladder chart, auto-detect triggers, one-click execute
- 📤 **CSV/JSON import/export** — full data backup and batch operations
- **Mobile-first UI** — responsive design with Ant Design Mobile

## Architecture

```
Frontend (React 18 + TypeScript)
  → supabase.functions.invoke('fund-nav', { body: { code } })
    → Supabase Edge Function (Deno, server-side)
      → EastMoney API (mobile UA spoofing, no CORS)
```

**Key design decisions:**
- **Supabase is the single source of truth** — holdings are derived from transactions, not stored separately
- **Lot derivation** (`navUpdateService.ts`) — `deriveLots()` builds lots from buy/sell transactions
- **Sell matching** — per-lot: explicit `lotId` → `gridExecutionId` → lowest-cost-first (not FIFO), unified in `matchSellAgainstLots()` (used by `deriveLots`/`deriveRealizedLots`/`matchSellLots`)
- **Hash-based routing** — no react-router, Layout.tsx TabBar with 6 tabs

## Quick Start

### Prerequisites

- Node.js >= 18
- A [Supabase](https://supabase.com) project (free tier works)

### Install & Run

```bash
git clone https://github.com/twmissingu/MyFundSys.git
cd MyFundSys/frontend
npm install

# Configure environment
cp .env.example .env.local
# Edit .env.local with your Supabase credentials

npm run dev     # http://localhost:5173/
```

### Environment Variables

```bash
# frontend/.env.local (not committed)
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGci...          # Must be JWT format (starts with eyJ)
VITE_APP_PASSWORD=your_login_password
```

> **Important**: `VITE_SUPABASE_ANON_KEY` must use JWT format (starts with `eyJ`). The `sb_publishable_` format causes 401 errors on Edge Functions.

### Deploy Edge Functions

```bash
supabase functions deploy fund-nav     --project-ref <your-ref>
supabase functions deploy fund-search  --project-ref <your-ref>
supabase functions deploy fund-history --project-ref <your-ref>
```

## For AI Agents

This project is designed for seamless AI agent interaction:

```bash
# 1. Clone and install
git clone https://github.com/twmissingu/MyFundSys.git
cd MyFundSys/frontend
npm install

# 2. Configure (copy .env.example → .env.local, fill in Supabase creds)
cp .env.example .env.local

# 3. Run tests
npm test                    # 520 unit tests, Vitest
TEST_PASSWORD=<app-password> npm run test:e2e   # 14 Playwright e2e (read-only smoke; needs dev server + Supabase)

# 4. Build
npm run build               # TypeScript compile + Vite build → dist/

# 5. Deploy
npm run deploy              # Push to gh-pages branch
```

**Key files for agents:**
| File | Purpose |
|------|---------|
| `CLAUDE.md` | Full project guidance, architecture, conventions |
| `src/services/navUpdateService.ts` | Core business logic: lot derivation, sell matching, pending processing |
| `src/services/fundApi.ts` | Fund data API with NAV/market/valuation caching |
| `src/services/lotTraceService.ts` | Per-lot lifecycle grouping for traceability view |
| `src/services/alertService.ts` | Pending alert CRUD (nav_date_mismatch / no_nav_data / api_error) |
| `src/services/favoriteService.ts` | Favorite fund helper (`addFavoriteFund`) |
| `src/services/gridService.ts` | Grid strategy CRUD, execution, status derivation |
| `src/hooks/useSync.ts` | Data access hooks (holdings derived from transactions) |
| `src/hooks/useRiskMetrics.ts` | Portfolio risk aggregation (assets, deployment, concentration, valuation signal) |
| `src/hooks/useGrid.ts` | Grid strategy hooks with execution and liquidation

## Testing

```bash
npm test                            # Run all unit tests (Vitest)
npm run test:watch                  # Watch mode
npx vitest run src/__tests__/services/fundApi.test.ts   # Single file
TEST_PASSWORD=<app-password> npm run test:e2e   # Playwright e2e (read-only smoke)
```

**Framework**: Vitest 4 + @testing-library/react — **520 web unit tests** + 24 Android tests.

**E2E**: 14 Playwright specs (navigation / fund-search / holdings / critical-paths) — read-only
smoke tests that verify page reachability and rendering. Mutating flows (transaction add/delete,
pending confirmation, grid execute/sell, CSV import/export, JSON backup-restore) are covered at the
service/unit layer to avoid polluting the shared Supabase test DB. Requires `TEST_PASSWORD` (= app
password) and a reachable Supabase backend; Playwright auto-starts the dev server. In CI, set
`PLAYWRIGHT_CHANNEL=chromium` to use the bundled browser.

**CI**: `.github/workflows/test.yml` runs type-check + unit tests + e2e on push/PR (independent of
`deploy.yml`, so a flaky e2e never blocks a release).

## Android App

React Native (Expo) client in `android-app/`, sharing the same Supabase database and Edge Functions:

```bash
cd android-app
# Fill Supabase credentials in app.json → extra
npx expo start
```

## Database Schema

| Table | Description |
|-------|-------------|
| `transactions` | Trade records (buy/sell, pending/completed) — **primary table** |
| `holdings` | Positions (compatibility, derived from transactions) |
| `favorite_funds` | Watchlist |
| `fund_cache` | Search cache |
| `grid_strategies` | Grid trading strategy configurations |
| `grid_executions` | Grid trade execution records |
| `pending_alerts` | Pending transaction NAV mismatch alerts |

RLS enabled with ALLOW ALL policy (single-user mode).

## Contributing

1. Fork the repo
2. Create a feature branch (`git checkout -b feat/my-feature`)
3. Write tests first (TDD encouraged)
4. Commit with conventional format (`feat:`, `fix:`, `refactor:`)
5. Open a PR

## License

[MIT](LICENSE)

---

**Disclaimer**: This system is for personal investment management only. It does not constitute investment advice. Invest at your own risk.
