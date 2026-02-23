# ToSolana - Cross-Chain Bridge to Solana

## Overview
Non-custodial cross-chain bridge application for moving assets from EVM, Bitcoin, TON, and Cosmos ecosystems to Solana. Aggregates routes from multiple bridge providers (LI.FI, Rango Exchange, THORChain, Symbiosis).

## Tech Stack
- **Framework**: Next.js 16 (App Router), TypeScript
- **Styling**: Tailwind CSS 4, Framer Motion
- **Web3**: Wagmi v3, Viem, Solana Wallet Adapter, WalletConnect v2
- **Database**: Prisma ORM with SQLite
- **Validation**: Zod
- **Package Manager**: pnpm
- **Runtime**: Node.js 22

## Project Structure
```
src/
├── app/                  # Next.js App Router pages & API routes
│   ├── page.tsx          # Main landing page with BridgeWidget
│   ├── globals.css       # Global styles + Tailwind CSS v4 (source(none) to avoid node_modules scanning)
│   ├── admin/            # Admin panel for token registry
│   └── api/              # API endpoints (quote, execute)
├── components/           # React components
│   └── bridge/           # Bridge-specific UI components
├── server/               # Server-side logic
│   ├── providers/        # Bridge provider implementations (lifi, rango, thorchain, ton, ibc)
│   └── schema.ts         # Zod schemas for API
prisma/
└── schema.prisma         # Database schema (QuoteSession, Step, ProjectToken)
```

## Replit Environment Notes
- Dev server runs on port 5000 (Replit webview requirement)
- Tailwind CSS v4 uses `@import "tailwindcss" source(none)` + `@source "../../src"` to prevent scanning node_modules (which causes CSS parse errors from invalid utility class names in dependencies)
- `next.config.ts` includes `allowedDevOrigins: ["*"]` for Replit's proxy/iframe setup
- SQLite database stored at `prisma/dev.db`

## Running
- Dev: `npx next dev -p 5000 -H 0.0.0.0`
- Database: SQLite at `file:./dev.db`
- Prisma commands: `pnpm run db:push`, `pnpm run db:generate`

## Environment Variables
- `DATABASE_URL` - Database connection (managed by runtime)
- `NEXT_PUBLIC_SOLANA_RPC_URL` - Solana RPC endpoint
- `LIFI_INTEGRATOR` - LI.FI integrator name
- `RANGO_API_KEY` / `LIFI_API_KEY` - Bridge provider API keys (optional, at least one needed for quotes)
- `NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID` - WalletConnect project ID (optional)
- `ADMIN_API_KEY` - Admin panel access
