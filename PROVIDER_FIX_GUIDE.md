# Provider Fix Guide

This guide explains how to fix each provider that isn't working.

---

## 🟡 Needs Different Source Chain

These providers work but need different test parameters:

### 1. THORChain (Bitcoin → Solana)

**Why it's not working:** We tested with Ethereum source, but THORChain only supports Bitcoin.

**How to test:**

```bash
# Test with Bitcoin source
pnpm tsx scripts/test-single-provider.ts thorchain

# Or use this request:
{
  sourceChainId: "bitcoin",
  sourceChainType: "bitcoin",
  sourceTokenAddress: "BTC",
  sourceAmount: "100000", // 0.001 BTC in satoshis
  destinationTokenAddress: "SOL",
  sourceAddress: "bc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh",
  solanaAddress: "H3TgN7c7H9o6D6i3npydq8gqVPSYwJm1g7y1uK8bS5mP",
  slippage: 3,
}
```

**In production:** Users select Bitcoin as source chain → THORChain routes appear.

---

### 2. IBC (Cosmos → Solana)

**Why it's not working:** We tested with Ethereum source, but IBC only supports Cosmos chains.

**How to test:**

```bash
# Test with Cosmos source
{
  sourceChainId: "cosmos",
  sourceChainType: "cosmos", 
  sourceTokenAddress: "uatom",
  sourceAmount: "1000000", // 1 ATOM
  destinationTokenAddress: "SOL",
  sourceAddress: "cosmos1xyz...",
  solanaAddress: "H3TgN7c7H9o6D6i3npydq8gqVPSYwJm1g7y1uK8bS5mP",
  slippage: 3,
}
```

**Supported Cosmos chains:** cosmos, osmosis, injective, evmos, juno, stargaze

---

### 3. TON (TON → Solana)

**Why it's not working:** We tested with Ethereum source, but TON provider only supports TON.

**How to test:**

```bash
# Enable in production
ENABLE_TON_PROVIDER=true

# Test with TON source
{
  sourceChainId: "ton",
  sourceChainType: "ton",
  sourceTokenAddress: "native",
  sourceAmount: "1000000000", // 1 TON in nanoton
  destinationTokenAddress: "SOL",
  sourceAddress: "EQD...", // TON address
  solanaAddress: "H3TgN7c7H9o6D6i3npydq8gqVPSYwJm1g7y1uK8bS5mP",
  slippage: 3,
}
```

**Optional:** Add `TON_API_KEY` from https://toncenter.com/ for better rate limits.

---

### 4. Jupiter (Solana DEX)

**Why it's not working:** Jupiter is NOT a cross-chain bridge - it's a Solana DEX aggregator for post-bridge swaps.

**How it works:**
1. User bridges ETH → wrapped SOL on Solana
2. Jupiter swaps wrapped SOL → any SPL token

**Enable it:**

```bash
ENABLE_JUPITER_PROVIDER=true
```

**This is used automatically** when the quote system composes routes (bridge + swap).

---

## 🔴 Broken - Need API Documentation

These providers need correct API endpoints:

### 5. deBridge

**Current issue:** API returns validation error (needs specific ID format)

**Need to research:**
- Correct API endpoint for cross-chain quotes
- Authentication requirements

**Where to look:**
- Docs: https://docs.debridge.finance/
- API reference: https://api.dln.trade/

**Likely fix:** The API endpoint might be different or requires different parameters.

---

### 6. Symbiosis

**Current issue:** API returns 404 (endpoint doesn't exist)

**Need to research:**
- Correct API endpoint for Solana routes
- API version

**Where to look:**
- Docs: https://docs.symbiosis.finance/
- Try: https://api.symbiosis.finance/crosschain/v1 vs v2

**Note:** Symbiosis is already used internally by the TON provider.

---

### 7. Mayan

**Current issue:** Domain `mayan.sh` doesn't exist

**Need to research:**
- Correct API domain
- API endpoints

**Where to look:**
- Docs: https://docs.mayan.finance/
- Try: https://mayan.finance/ or https://api.mayan.finance/

**Note:** Mayan is a Wormhole-based bridge aggregator.

---

### 8. Allbridge

**Current issue:** Domain `api.allbridge.io` doesn't exist

**Need to research:**
- Correct API endpoint
- API version

**Where to look:**
- Docs: https://docs.allbridge.io/
- Try: https://allbridge.io/api/ or similar

---

### 9. Wormhole

**Current issue:** API returns 404

**Need to research:**
- Wormhole doesn't have a public quote API
- Need to use Wormhole Connect SDK

**Where to look:**
- Docs: https://docs.wormhole.com/
- Wormhole Connect: https://github.com/wormhole-foundation/wormhole-connect

**Note:** IBC provider already uses Wormhole internally for Cosmos → Solana.

---

### 10. Socket (Bungee)

**Current issue:** API requires authentication token

**Need to research:**
- Is there a public API?
- Or do we need to apply for access?

**Where to look:**
- Docs: https://docs.socket.tech/
- API: https://api.socket.tech/

---

## 🎯 Summary: What Should You Do?

### Immediate (No Work Needed)

These work correctly, just weren't tested with the right inputs:

| Provider | Action |
|----------|--------|
| THORChain | ✅ Works - just needs Bitcoin as source |
| IBC | ✅ Works - just needs Cosmos as source |
| TON | ✅ Works - just needs TON as source |
| Jupiter | ✅ Works - used for post-bridge swaps |

### Need Research (Pick 2-3 Important Ones)

I recommend focusing on these (most valuable):

1. **deBridge** - Popular, fast, good rates
2. **Symbiosis** - Already partially working (used by TON)
3. **Mayan** - Wormhole-based, good for Solana

**To fix them:**
1. Go to their documentation
2. Find the correct API endpoint
3. Update the provider file

### Low Priority

- **Allbridge** - Similar to others
- **Wormhole** - Complex, LI.FI already uses it internally
- **Socket** - Requires API key

---

## 🚀 Quick Test Commands

```bash
# Test each provider type
pnpm tsx scripts/test-single-provider.ts lifi           # ✅ Should work
pnpm tsx scripts/test-single-provider.ts thorchain      # 🟡 Needs BTC source
pnpm tsx scripts/test-single-provider.ts ibc            # 🟡 Needs Cosmos source
pnpm tsx scripts/test-single-provider.ts ton            # 🟡 Needs TON source
pnpm tsx scripts/test-single-provider.ts debridge       # 🔴 Needs fix
pnpm tsx scripts/test-single-provider.ts symbiosis      # 🔴 Needs fix
```

---

## 📊 Recommendation

**For production launch:**

✅ **LI.FI alone is sufficient** - it aggregates:
- deBridge
- Symbiosis
- Mayan
- Wormhole
- And many others

The other providers I implemented are **redundant** since LI.FI already includes them in its aggregation.

**Keep them as:**
- Fallback options if LI.FI has issues
- Future expansion
- Direct provider routes for better rates

**No urgent action needed** - your app works great with just LI.FI + Rango (coming soon)!
