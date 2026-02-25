// Debug script for LI.FI
import { fetchWithTimeout } from "../src/lib/fetch-utils";

const LIFI_BASE_URL = "https://li.quest/v1";

async function testLiFi() {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Accept: "application/json",
  };
  
  if (process.env.LIFI_API_KEY) {
    headers["x-lifi-api-key"] = process.env.LIFI_API_KEY;
  }
  
  // Test without fromAddress first
  const bodyWithoutFromAddress = {
    fromChainId: 1,
    toChainId: 1151111081099710, // Solana
    fromTokenAddress: "0x0000000000000000000000000000000000000000",
    toTokenAddress: "11111111111111111111111111111111",
    fromAmount: "10000000000000000",
    toAddress: "H3TgN7c7H9o6D6i3npydq8gqVPSYwJm1g7y1uK8bS5mP",
    options: {
      integrator: process.env.LIFI_INTEGRATOR || "tosolana-dev",
      slippage: 0.03,
    },
  };
  
  console.log("Testing LI.FI without fromAddress...");
  console.log("Request body:", JSON.stringify(bodyWithoutFromAddress, null, 2));
  
  try {
    const res = await fetchWithTimeout(`${LIFI_BASE_URL}/advanced/routes`, {
      method: "POST",
      headers,
      body: JSON.stringify(bodyWithoutFromAddress),
    });
    
    const text = await res.text();
    console.log(`\nStatus: ${res.status}`);
    console.log(`Response: ${text.slice(0, 1000)}`);
    
    if (res.ok) {
      const data = JSON.parse(text);
      console.log(`\n✅ Success! Found ${data.routes?.length || 0} routes`);
    }
  } catch (error) {
    console.error("Error:", error);
  }
}

testLiFi();
