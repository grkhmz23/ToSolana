// @vitest-environment node
import { describe, it, expect } from "vitest";
import { POST as createProject } from "@/app/api/migration/projects/route";
import { NextRequest } from "next/server";

describe("API validation", () => {
  it("rejects invalid project payload", async () => {
    const request = new NextRequest("http://localhost/api/migration/projects", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "", slug: "BAD SLUG" }),
    });
    const response = await createProject(request as any);
    expect(response.status).toBe(400);
  });
});
