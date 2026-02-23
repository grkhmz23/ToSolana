# Deploy ToSolana on Replit

## Quick Start

1. **Create a new Replit**
   - Go to [replit.com](https://replit.com)
   - Click "Create" → "Import from GitHub"
   - Paste your repository URL

2. **Configure Environment Variables**
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

3. **Deploy**
   - Click the "Deploy" button in the top right
   - Replit will automatically run:
     ```
     npm run db:push
     npm run build
     npm start
     ```

## Important Notes

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

## Testing Locally on Replit

1. Click the "Run" button (not Deploy)
2. Wait for the build to complete
3. Click the URL in the webview tab

## Troubleshooting

### "No bridge providers configured" error
- Add at least one API key in the Secrets tab
- Refresh the page after adding secrets

### Database errors
- Run `npm run db:push` in the Shell tab
- Or delete `prisma/dev.db` and re-run

### Build fails
- Check the Console for errors
- Make sure all environment variables are set
- Try `npm install` in the Shell tab

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
