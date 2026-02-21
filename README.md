# ToSolana

Non-custodial cross-chain bridge: move assets from EVM chains to Solana.

Aggregates routes from **LI.FI** and **Rango Exchange**, lets users compare quotes, then signs and submits transactions client-side.

## Tech Stack

- **Next.js 16** (App Router) + TypeScript + Tailwind CSS 4
- **Solana**: @solana/wallet-adapter-react, @solana/web3.js
- **EVM**: wagmi v3 + viem (injected + WalletConnect v2)
- **Data fetching**: @tanstack/react-query
- **Validation**: zod
- **Database**: Prisma + SQLite (local dev)

## Supported Source Chains

Ethereum, Arbitrum, Optimism, Base, Polygon, BSC

## Quick Start

```bash
# 1. Install dependencies
pnpm install

# 2. Copy env file and fill in API keys
cp .env.example .env

# 3. Push database schema
pnpm db:push

# 4. Start dev server
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000).

## Environment Variables

| Variable | Required | Description |
|---|---|---|
| `DATABASE_URL` | Yes | SQLite connection string (default: `file:./dev.db`) |
| `NEXT_PUBLIC_SOLANA_RPC_URL` | No | Solana RPC endpoint (defaults to mainnet-beta) |
| `RANGO_API_KEY` | At least one provider | Rango Exchange API key |
| `LIFI_API_KEY` | At least one provider | LI.FI API key |
| `LIFI_INTEGRATOR` | Alternative to LI.FI key | LI.FI integrator name |
| `NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID` | No | WalletConnect project ID for mobile wallets |

**At least one bridge provider (Rango or LI.FI) must be configured** for quotes to work. If neither is set, the app shows an actionable error message.

## Scripts

| Command | Description |
|---|---|
| `pnpm dev` | Start development server |
| `pnpm build` | Production build |
| `pnpm lint` | Run ESLint |
| `pnpm typecheck` | TypeScript type check |
| `pnpm format` | Format code with Prettier |
| `pnpm db:push` | Push Prisma schema to database |
| `pnpm db:studio` | Open Prisma Studio |
| `pnpm db:migrate` | Run Prisma migrations |

## Project Structure

```
src/
  app/
    layout.tsx          # Providers wrapper (wagmi, solana, react-query)
    page.tsx            # Main wizard UI
    providers.tsx       # Client-side provider setup
    api/
      quote/route.ts    # POST - get bridge quotes from providers
      execute/step/route.ts  # POST - create session, get tx, update step
      status/route.ts   # GET  - poll session status
  components/
    ConnectEvmWallet.tsx
    ConnectSolanaWallet.tsx
    TokenAmountForm.tsx
    RoutesList.tsx
    ProgressTracker.tsx
  lib/
    chains.ts           # Supported EVM chains + helpers
    tokens.ts           # ERC20 info fetching, address validation
    format.ts           # Amount formatting, address shortening
  server/
    db.ts               # Prisma client singleton
    schema.ts           # Zod schemas for all API payloads
    sessions.ts         # Session CRUD operations
    providers/
      index.ts          # Provider interface + registry
      lifi.ts           # LI.FI REST integration
      rango.ts          # Rango REST integration
prisma/
  schema.prisma         # Database schema (QuoteSession, Step)
```

## User Flow

1. **Connect wallets** - EVM source wallet + Solana destination wallet
2. **Configure transfer** - Select source chain, token, amount, and destination token
3. **Get quotes** - Compare routes from LI.FI and Rango side by side
4. **Execute** - Sign transactions step by step (EVM via wagmi, Solana via wallet adapter)
5. **Track** - Monitor progress with real-time status polling

## Architecture Notes

- **Non-custodial**: The backend never holds private keys or signs transactions. It only fetches quotes and prepares unsigned transaction requests.
- **Solana VersionedTransaction**: Handles base64-encoded versioned transactions via `VersionedTransaction.deserialize()`, wallet signing, and `sendRawTransaction`.
- **Provider abstraction**: Both LI.FI and Rango implement a common `BridgeProvider` interface, making it straightforward to add more providers.
- **Graceful degradation**: If one provider's API key is missing or it fails, the other provider's routes are still shown.

## Production Considerations

- Swap `DATABASE_URL` to a PostgreSQL connection string
- Add rate limiting to API routes
- Add proper error monitoring (Sentry, etc.)
- Consider caching quotes with short TTL
- Add transaction receipt verification for bridge completion
