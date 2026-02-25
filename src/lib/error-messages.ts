/**
 * User-Friendly Error Messages
 * 
 * This module provides human-readable error messages for common errors
 * that users might encounter during bridging operations.
 */

export interface ErrorMessageResult {
  title: string;
  message: string;
  action?: string;
}

/**
 * Map technical error messages to user-friendly versions
 */
export function getUserFriendlyErrorMessage(error: unknown): ErrorMessageResult {
  const errorMessage = error instanceof Error ? error.message : String(error);
  const lowerMessage = errorMessage.toLowerCase();

  // Rate limiting
  if (lowerMessage.includes("rate limit") || errorMessage.includes("429")) {
    return {
      title: "Too Many Requests",
      message: "We're experiencing high traffic. Please wait a moment and try again.",
      action: "Try again in a few seconds",
    };
  }

  // Route/Quote errors
  if (lowerMessage.includes("no routes found") || lowerMessage.includes("no routes available")) {
    return {
      title: "No Routes Available",
      message: "We couldn't find any bridge routes for this transfer. This might be due to low liquidity or temporary provider issues.",
      action: "Try a different amount or token",
    };
  }

  // Insufficient funds
  if (lowerMessage.includes("insufficient funds") || lowerMessage.includes("insufficient balance")) {
    return {
      title: "Insufficient Balance",
      message: "Your wallet doesn't have enough funds to complete this transaction, including gas fees.",
      action: "Add more funds to your wallet or reduce the amount",
    };
  }

  // User rejected
  if (lowerMessage.includes("rejected") || lowerMessage.includes("user denied") || lowerMessage.includes("cancelled")) {
    return {
      title: "Transaction Cancelled",
      message: "You declined the transaction in your wallet.",
      action: "Try again when you're ready to proceed",
    };
  }

  // Slippage/Price impact
  if (lowerMessage.includes("slippage") || lowerMessage.includes("price impact")) {
    return {
      title: "Price Impact Too High",
      message: "The price impact for this trade is higher than your slippage tolerance.",
      action: "Increase slippage tolerance in settings or reduce the amount",
    };
  }

  // Network/Chain errors
  if (lowerMessage.includes("network") || lowerMessage.includes("chain")) {
    if (lowerMessage.includes("unsupported")) {
      return {
        title: "Unsupported Network",
        message: "The selected network is not supported for this operation.",
        action: "Select a different network",
      };
    }
    return {
      title: "Network Error",
      message: "We're having trouble connecting to the network. This might be temporary.",
      action: "Check your connection and try again",
    };
  }

  // Wallet connection errors
  if (lowerMessage.includes("wallet") || lowerMessage.includes("connect")) {
    if (lowerMessage.includes("not connected")) {
      return {
        title: "Wallet Not Connected",
        message: "Please connect your wallet to continue.",
        action: "Connect your wallet using the button above",
      };
    }
    return {
      title: "Wallet Error",
      message: "There was an issue with your wallet. Please try again.",
      action: "Check that your wallet is unlocked and try again",
    };
  }

  // Session/Auth errors
  if (lowerMessage.includes("session") || lowerMessage.includes("auth")) {
    return {
      title: "Session Expired",
      message: "Your bridge session has expired. Please start a new quote.",
      action: "Request a new quote",
    };
  }

  // Route verification errors
  if (lowerMessage.includes("route verification") || lowerMessage.includes("tampered")) {
    return {
      title: "Security Check Failed",
      message: "The route information appears to have been modified. For your safety, we cannot proceed.",
      action: "Request a fresh quote",
    };
  }

  // Non-EVM execution disabled
  if (lowerMessage.includes("disabled") && (lowerMessage.includes("bitcoin") || lowerMessage.includes("cosmos") || lowerMessage.includes("ton"))) {
    return {
      title: "Feature Coming Soon",
      message: "Bitcoin, Cosmos, and TON bridging is currently in development and will be available soon.",
      action: "Use EVM chains (Ethereum, Polygon, etc.) for now",
    };
  }

  // Provider errors
  if (lowerMessage.includes("provider") || lowerMessage.includes("api")) {
    return {
      title: "Service Temporarily Unavailable",
      message: "One of our bridge providers is experiencing issues. Please try again later.",
      action: "Try again in a few minutes",
    };
  }

  // Transaction failed
  if (lowerMessage.includes("transaction failed") || lowerMessage.includes("execution reverted")) {
    return {
      title: "Transaction Failed",
      message: "The transaction could not be completed. This might be due to network congestion or insufficient gas.",
      action: "Try again with higher gas settings",
    };
  }

  // Deadline/timeout
  if (lowerMessage.includes("timeout") || lowerMessage.includes("deadline") || lowerMessage.includes("expired")) {
    return {
      title: "Transaction Timeout",
      message: "The transaction took too long to complete. Your funds are safe.",
      action: "Try again when the network is less congested",
    };
  }

  // Default fallback
  return {
    title: "Something Went Wrong",
    message: "An unexpected error occurred. Please try again.",
    action: "Contact support if the issue persists",
  };
}

/**
 * Format error for display in the UI
 */
export function formatErrorForDisplay(error: unknown): string {
  const { title, message } = getUserFriendlyErrorMessage(error);
  return `${title}: ${message}`;
}

/**
 * Check if an error is retryable
 */
export function isRetryableError(error: unknown): boolean {
  const errorMessage = error instanceof Error ? error.message : String(error);
  const lowerMessage = errorMessage.toLowerCase();

  // User rejections are not retryable (user made a choice)
  if (lowerMessage.includes("rejected") || lowerMessage.includes("denied")) {
    return false;
  }

  // Rate limits are retryable after waiting
  if (lowerMessage.includes("rate limit")) {
    return true;
  }

  // Network errors are retryable
  if (lowerMessage.includes("network") || lowerMessage.includes("timeout")) {
    return true;
  }

  // Provider errors are retryable (might work next time)
  if (lowerMessage.includes("provider") || lowerMessage.includes("api")) {
    return true;
  }

  // Most other errors are retryable
  return true;
}
