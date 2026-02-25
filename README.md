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

# 2. Environment setup (FREE - no signup needed!)
# The .env file is already configured with LIFI_INTEGRATOR for free tier
# Just change "tosolana-app" to your app name if you want

# 3. Push database schema
pnpm db:push

# 4. Start dev server
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000).

**No API keys required!** The app works out of the box with LI.FI's free tier using just an integrator name.

## Environment Variables

### ⚡ Quick Start (Free - No Signup Required!)

Just set `LIFI_INTEGRATOR` to your app name and you're ready to go:

```bash
LIFI_INTEGRATOR="my-app-name"
```

That's it! No API keys needed. LI.FI's free tier works with just an integrator name.

### Full Configuration

| Variable | Required | Description |
|---|---|---|
| `DATABASE_URL` | Yes | SQLite connection string (default: `file:./dev.db`) |
| `NEXT_PUBLIC_SOLANA_RPC_URL` | No | Solana RPC endpoint (defaults to mainnet-beta) |
| `LIFI_INTEGRATOR` | **Recommended** | LI.FI integrator name (free, no signup!) |
| `RANGO_API_KEY` | Optional | Rango Exchange API key (for more routes) |
| `LIFI_API_KEY` | Optional | LI.FI API key (for higher rate limits) |
| `NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID` | No | WalletConnect project ID for mobile wallets |

### Provider Setup Options

| Setup | Cost | Routes |
|---|---|---|
| `LIFI_INTEGRATOR` only | **FREE** | LI.FI + THORChain + IBC + TON |
| `LIFI_INTEGRATOR` + `RANGO_API_KEY` | **FREE + Paid** | All providers (best rates) |
| `LIFI_API_KEY` | Paid/Custom | LI.FI + THORChain + IBC + TON |

**At least one bridge provider must be configured** for quotes to work.

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

## Official 1:1 Bridge (Token Registry)

ToSolana supports "Official 1:1" bridges for projects that have deployed NTT (Native Token Transfer) or OFT (Omnichain Fungible Token) contracts. These routes appear at the top of quote results and offer:

- **No slippage** - Exact 1:1 ratio
- **No bridge fees** - Direct native token transfer
- **Fast settlement** - Typically 2-5 minutes

### How it works

1. **Admin Onboarding**: Project teams register their token via the admin panel (`/admin`)
2. **Verification**: System validates ERC20 contract and Solana mint
3. **Activation**: After verification, the token appears as an "Official 1:1" route
4. **User Flow**: Users select the official route and complete transfer via dedicated bridge UI

### Token Modes

- **NTT** (Native Token Transfer) - Wormhole's native token standard
- **OFT** (Omnichain Fungible Token) - LayerZero's omnichain token standard  
- **WRAPPED** - Traditional wrapped token (not shown as 1:1)

### Admin Setup

1. Set `ADMIN_API_KEY` in `.env` (strong random string)
2. Access `/admin` and enter the key
3. Add tokens with ERC20 address, Solana mint, and mode
4. Verify on-chain metadata
5. Activate to make available to users

## Production Considerations

- Swap `DATABASE_URL` to a PostgreSQL connection string
- Add rate limiting to API routes
- Add proper error monitoring (Sentry, etc.)
- Consider caching quotes with short TTL
- Add transaction receipt verification for bridge completion
- **Protect ADMIN_API_KEY**: Never expose it client-side; it's only used server-side for admin routes

## Migration Campaigns

ToSolana includes a self-service migration system that lets projects snapshot holders and generate claims for Solana distributions.

### How It Works
1. **Create a Project**  
   Go to `/dashboard` and create a project with your Solana owner wallet.

2. **Register Token**  
   Add your source chain token address, symbol, decimals, and total supply.

3. **Create Campaign**  
   Provide a snapshot block number and name the campaign.

4. **Generate Snapshot**  
   The snapshot engine scans token transfer logs at the specified block and stores holder balances.

5. **Generate Merkle Tree**  
   The system builds a Merkle tree from snapshot balances, saves the root, and stores proofs.

6. **Activate Campaign**  
   Move the campaign to `live` to enable claims.

### Claim Flow
Users visit `/claim/[campaignId]`, connect their Solana wallet, and sign a claim authorization. The backend:
- Verifies Merkle proof eligibility
- Validates signatures
- Marks the claim as claimed

### Notes
- Snapshotting is resource-intensive. Use a dedicated RPC and set deployment limits for large holder counts.
- Campaign state transitions are enforced server-side: `draft → snapshotting → ready → live → ended`.
