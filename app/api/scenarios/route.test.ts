import { describe, expect, it } from "vitest";
import { GET } from "./route";

describe("GET /api/scenarios", () => {
  it("returns a stable public catalog without exposing recovery correctness", async () => {
    const response = GET();
    const body = await response.json();
    expect(response.status).toBe(200);
    expect(body.meta).toEqual({ simulation: true, deterministic: true, count: 3 });
    expect(body.data).toHaveLength(3);
    expect(JSON.stringify(body)).not.toContain("isCorrect");
  });
});
