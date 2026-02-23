# Deploy ToSolana on Replit

## Quick Start

1. **Create a new Replit**
   - Go to [replit.com](https://replit.com)
   - Click "Create" → "Import from GitHub"
   - Paste your repository URL: `https://github.com/grkhmz23/ToSolana`

2. **Wait for Nix Environment Setup**
   - Replit will automatically configure the environment
   - This may take 1-2 minutes on first load
   - If it fails, try clicking "Try Again" or reload the page

3. **Configure Environment Variables**
   In Replit's "Secrets" tab (the lock icon in left sidebar), add:

   | Secret | Value | Required? |
   |--------|-------|-----------|
   | `DATABASE_URL` | `file:./dev.db` | ✅ Yes |
   | `RANGO_API_KEY` | Your Rango API key | ⚠️ At least one provider |
   | `LIFI_API_KEY` | Your LI.FI API key | ⚠️ At least one provider |
   | `LIFI_INTEGRATOR` | `tosolana-replit` | ⚠️ Alternative to LI.FI key |
   | `NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID` | Your WC project ID | ❌ Optional |

   **Get API Keys:**
   - Rango: https://app.rango.exchange/
   - LI.FI: https://li.fi/
   - WalletConnect: https://cloud.walletconnect.com/

4. **Run the App**
   - Click the "Run" button (▶️) at the top
   - First run will install dependencies (may take 2-3 minutes)
   - The webview will open automatically on port 3000

## Deployment

1. Click the "Deploy" button in the top right
2. Replit will automatically run:
   ```
   pnpm run db:push
   pnpm run build
   pnpm start
   ```

## Troubleshooting Nix Environment

### "Nix environment failed to build"

**Solution 1: Reload the Repl**
1. Click the three dots (⋮) next to your Repl name
2. Select "Restart" or reload the page
3. Wait for the environment to rebuild

**Solution 2: Clear Cache**
1. Open the Shell tab
2. Run:
   ```bash
   rm -rf node_modules .next
   pnpm install
   ```

**Solution 3: Check Nix Configuration**
The `replit.nix` file should contain:
```nix
{ pkgs }: {
  deps = [
    pkgs.nodejs_20
    pkgs.pnpm
    pkgs.git
  ];
}
```

### "Cannot find module" errors

**Solution:**
```bash
pnpm install
pnpm run db:generate
```

### "No bridge providers configured" error

- Add at least one API key in the Secrets tab
- Refresh the page after adding secrets

### Database errors

**Solution:**
```bash
pnpm run db:push
```

Or reset the database:
```bash
rm -f prisma/dev.db
pnpm run db:push
```

### Build fails on Replit

**Check available memory:**
```bash
free -h
```

**Clear build cache:**
```bash
rm -rf .next
pnpm run build
```

## Important Notes

### Package Manager
This project uses **pnpm** (not npm). The lockfile is `pnpm-lock.yaml`.

### Database
- Uses SQLite by default (`file:./dev.db`)
- Database is persisted in Replit's filesystem
- For production, consider migrating to PostgreSQL

### Provider Configuration
**At least one bridge provider must be configured** for quotes to work:
- Set `RANGO_API_KEY` for Rango Exchange
- Set `LIFI_API_KEY` OR `LIFI_INTEGRATOR` for LI.FI

If no providers are configured, the app will show an error message.

### WalletConnect (Optional)
- Required for mobile wallet support
- Without it, only browser extension wallets work

## Architecture for Replit

```
User → Replit Cloud Run → Next.js App
                              ↓
                    ┌────────┴────────┐
                    ↓                 ↓
                SQLite DB    Bridge APIs (LI.FI/Rango)
```

- **Non-custodial**: Your app never holds private keys
- **Serverless-friendly**: SQLite works but PostgreSQL recommended for scale

## Local Development (Non-Replit)

If you want to run locally:

```bash
# Clone
git clone https://github.com/grkhmz23/ToSolana.git
cd ToSolana

# Install dependencies
pnpm install

# Setup database
pnpm run db:push

# Run dev server
pnpm run dev
```

Visit http://localhost:3000