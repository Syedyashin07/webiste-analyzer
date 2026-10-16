import { afterEach, describe, expect, it, vi } from "vitest";
import { replayHttpRequest } from "./http-check.js";

describe("replayHttpRequest", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("returns the failing API status on replay", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("nope", { status: 500 })),
    );
    const result = await replayHttpRequest({
      url: "https://example.com/api/leave",
      method: "GET",
    });
    expect(result.ok).toBe(false);
    expect(result.status).toBe(500);
    expect(result.error).toBe("HTTP 500");
  });
});
