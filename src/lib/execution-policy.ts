import type { RouteStep } from "@/server/schema";

const EXPERIMENTAL_NON_EVM_EXECUTION_CHAINS = ["bitcoin", "cosmos", "ton"] as const;

export type ExperimentalNonEvmExecutionChain =
  (typeof EXPERIMENTAL_NON_EVM_EXECUTION_CHAINS)[number];

function parseBooleanEnv(value: string | undefined): boolean | null {
  if (value === undefined) return null;

  const normalized = value.trim().toLowerCase();
  if (["1", "true", "yes", "on"].includes(normalized)) return true;
  if (["0", "false", "no", "off"].includes(normalized)) return false;
  return null;
}

export function isExperimentalNonEvmExecutionEnabled(): boolean {
  const configured = parseBooleanEnv(
    process.env.NEXT_PUBLIC_ENABLE_EXPERIMENTAL_NON_EVM_EXECUTION,
  );

  if (configured !== null) {
    return configured;
  }

  return process.env.NODE_ENV !== "production";
}

export function isExperimentalNonEvmExecutionChain(
  chainType: string,
): chainType is ExperimentalNonEvmExecutionChain {
  return (EXPERIMENTAL_NON_EVM_EXECUTION_CHAINS as readonly string[]).includes(chainType);
}

export function isChainExecutionDisabledByPolicy(chainType: string): boolean {
  return (
    isExperimentalNonEvmExecutionChain(chainType) &&
    !isExperimentalNonEvmExecutionEnabled()
  );
}

export function getRoutePolicyBlockedChainTypes(
  steps: Array<Pick<RouteStep, "chainType">>,
): ExperimentalNonEvmExecutionChain[] {
  if (isExperimentalNonEvmExecutionEnabled()) {
    return [];
  }

  const blocked = new Set<ExperimentalNonEvmExecutionChain>();
  for (const step of steps) {
    if (isExperimentalNonEvmExecutionChain(step.chainType)) {
      blocked.add(step.chainType);
    }
  }
  return Array.from(blocked);
}

export function formatNonEvmExecutionPolicyMessage(
  chainTypes: string[],
): string {
  const chains = chainTypes.map((c) => c.toUpperCase()).join(", ");
  return `Execution for ${chains} routes is disabled in production until broadcast and server-side finality verification are implemented.`;
}

