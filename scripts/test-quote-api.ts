// Test the quote API with 1 ETH
import { fetchWithTimeout } from "../src/lib/fetch-utils";

async function testQuote() {
  const requestBody = {
    sourceChainId: 1, // Ethereum
    sourceTokenAddress: "0x0000000000000000000000000000000000000000",
    sourceAmount: "1000000000000000000", // 1 ETH in wei
    destinationTokenAddress: "SOL",
    sourceAddress: "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb5",
    solanaAddress: "H3TgN7c7H9o6D6i3npydq8gqVPSYwJm1g7y1uK8bS5mP",
    slippage: 3,
  };
  
  console.log("Request:", JSON.stringify(requestBody, null, 2));
  
  try {
    const response = await fetchWithTimeout("http://localhost:3000/api/quote", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(requestBody),
    });
    
    const data = await response.json();
    console.log("\nResponse status:", response.status);
    console.log("\nResponse:", JSON.stringify(data, null, 2));
    
    if (data.routes && data.routes.length > 0) {
      const route = data.routes[0];
      console.log("\n✅ First route:");
      console.log("  Provider:", route.provider);
      console.log("  Output amount:", route.estimatedOutput.amount);
      console.log("  Output token:", route.estimatedOutput.token);
      console.log("  Calculated SOL:", parseFloat(route.estimatedOutput.amount) / 1e9);
    } else {
      console.log("\n❌ No routes returned");
      if (data.errors) {
        console.log("  Errors:", data.errors);
      }
    }
  } catch (error) {
    console.error("Error:", error);
  }
}

testQuote();
