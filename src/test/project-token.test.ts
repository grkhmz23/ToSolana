import { describe, it, expect, vi, beforeEach } from "vitest";
import { z } from "zod";

// Mock Prisma
vi.mock("@/server/db", () => ({
  prisma: {
    projectToken: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    tokenVerificationLog: {
      create: vi.fn(),
    },
  },
  getProjectTokenBySource: vi.fn(),
  createVerificationLog: vi.fn(),
}));

import { getProjectTokenBySource } from "@/server/db";

// Token validation schemas
const projectTokenCreateSchema = z.object({
  sourceChainId: z.number().int().positive(),
  sourceTokenAddress: z.string().regex(/^0x[a-fA-F0-9]{40}$/),
  solanaMint: z.string().min(32).max(44),
  mode: z.enum(["WRAPPED", "NTT", "OFT"]),
  notes: z.string().optional(),
});

const projectTokenUpdateSchema = z.object({
  name: z.string().min(1).optional(),
  symbol: z.string().min(1).optional(),
  decimals: z.number().int().min(0).max(18).optional(),
  solanaMint: z.string().min(32).max(44).optional(),
  mode: z.enum(["WRAPPED", "NTT", "OFT"]).optional(),
  status: z.enum(["DRAFT", "ACTIVE", "DISABLED"]).optional(),
  notes: z.string().optional(),
});

describe("Project Token Registry", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Validation", () => {
    it("should validate correct token creation data", () => {
      const validData = {
        sourceChainId: 1,
        sourceTokenAddress: "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48", // USDC
        solanaMint: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
        mode: "NTT" as const,
      };

      const result = projectTokenCreateSchema.safeParse(validData);
      expect(result.success).toBe(true);
    });

    it("should reject invalid ERC20 address", () => {
      const invalidData = {
        sourceChainId: 1,
        sourceTokenAddress: "invalid-address",
        solanaMint: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
        mode: "NTT" as const,
      };

      const result = projectTokenCreateSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
    });

    it("should reject invalid Solana mint", () => {
      const invalidData = {
        sourceChainId: 1,
        sourceTokenAddress: "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48",
        solanaMint: "too-short",
        mode: "NTT" as const,
      };

      const result = projectTokenCreateSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
    });

    it("should accept valid update data", () => {
      const updateData = {
        name: "USD Coin",
        symbol: "USDC",
        decimals: 6,
        mode: "NTT" as const,
        status: "ACTIVE" as const,
      };

      const result = projectTokenUpdateSchema.safeParse(updateData);
      expect(result.success).toBe(true);
    });
  });

  describe("Official Route Injection", () => {
    it("should inject official route for ACTIVE NTT token", async () => {
      const mockToken = {
        id: "token-123",
        sourceChainId: 1,
        sourceTokenAddress: "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48",
        solanaMint: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
        symbol: "USDC",
        name: "USD Coin",
        decimals: 6,
        mode: "NTT",
        status: "ACTIVE",
        verifiedAt: new Date(),
      };

      vi.mocked(getProjectTokenBySource).mockResolvedValue(mockToken as any);

      const { getOfficialRouteAction } = await import("@/server/official-routes");
      const action = await getOfficialRouteAction(
        1,
        "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48"
      );

      expect(action).not.toBeNull();
      expect(action?.tokenId).toBe("token-123");
      expect(action?.mode).toBe("NTT");
      expect(action?.action.kind).toBe("internal_nav");
      expect(action?.action.href).toBe("/official/token-123");
    });

    it("should NOT inject route for DRAFT token", async () => {
      const mockToken = {
        id: "token-123",
        sourceChainId: 1,
        sourceTokenAddress: "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48",
        status: "DRAFT",
        mode: "NTT",
      };

      vi.mocked(getProjectTokenBySource).mockResolvedValue(mockToken as any);

      const { getOfficialRouteAction } = await import("@/server/official-routes");
      const action = await getOfficialRouteAction(
        1,
        "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48"
      );

      expect(action).toBeNull();
    });

    it("should NOT inject route for WRAPPED mode", async () => {
      const mockToken = {
        id: "token-123",
        sourceChainId: 1,
        sourceTokenAddress: "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48",
        status: "ACTIVE",
        mode: "WRAPPED",
      };

      vi.mocked(getProjectTokenBySource).mockResolvedValue(mockToken as any);

      const { getOfficialRouteAction } = await import("@/server/official-routes");
      const action = await getOfficialRouteAction(
        1,
        "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48"
      );

      expect(action).toBeNull();
    });

    it("should NOT inject route for non-existent token", async () => {
      vi.mocked(getProjectTokenBySource).mockResolvedValue(null);

      const { getOfficialRouteAction } = await import("@/server/official-routes");
      const action = await getOfficialRouteAction(
        1,
        "0x1234567890123456789012345678901234567890"
      );

      expect(action).toBeNull();
    });
  });

  describe("Normalized Route Schema", () => {
    it("should accept route with action field", async () => {
      const { normalizedRouteSchema } = await import("@/server/schema");

      const routeWithAction = {
        provider: "lifi" as const,
        routeId: "official-123",
        steps: [
          { chainType: "evm" as const, chainId: 1, description: "Send token" },
          { chainType: "solana" as const, description: "Receive on Solana" },
        ],
        estimatedOutput: { token: "USDC", amount: "1000000000" },
        fees: [],
        action: {
          kind: "internal_nav" as const,
          href: "/official/123",
          label: "Open Official 1:1 Bridge",
        },
      };

      const result = normalizedRouteSchema.safeParse(routeWithAction);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.action).toBeDefined();
      }
    });

    it("should accept route without action field (backward compat)", async () => {
      const { normalizedRouteSchema } = await import("@/server/schema");

      const routeWithoutAction = {
        provider: "lifi" as const,
        routeId: "route-123",
        steps: [
          { chainType: "evm" as const, chainId: 1, description: "Send token" },
        ],
        estimatedOutput: { token: "USDC", amount: "1000000000" },
        fees: [{ token: "ETH", amount: "1000000000000000" }],
      };

      const result = normalizedRouteSchema.safeParse(routeWithoutAction);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.action).toBeUndefined();
      }
    });
  });
});
