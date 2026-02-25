// Admin authentication utilities
import { NextRequest, NextResponse } from "next/server";

const ADMIN_API_KEY = process.env.ADMIN_API_KEY;

if (!ADMIN_API_KEY && process.env.NODE_ENV === "production") {
  console.warn("WARNING: ADMIN_API_KEY not set in production!");
}

export function validateAdminKey(request: NextRequest): boolean {
  if (!request) {
    return false;
  }
  const key = request.headers.get("x-admin-key");
  return !!ADMIN_API_KEY && key === ADMIN_API_KEY;
}

export function requireAdminAuth(
  handler: (req: NextRequest) => Promise<NextResponse>
) {
  return async (request: NextRequest): Promise<NextResponse> => {
    if (!validateAdminKey(request)) {
      return NextResponse.json(
        { ok: false, error: { code: "UNAUTHORIZED", message: "Invalid admin key" } },
        { status: 401 }
      );
    }
    return handler(request);
  };
}

// Helper for API route wrappers
export function withAdminAuth(handler: Function) {
  return async (request: NextRequest, ...args: unknown[]) => {
    if (!validateAdminKey(request)) {
      return NextResponse.json(
        { ok: false, error: { code: "UNAUTHORIZED", message: "Invalid admin key" } },
        { status: 401 }
      );
    }
    return handler(request, ...args);
  };
}
