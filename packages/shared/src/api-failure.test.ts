import { describe, expect, it } from "vitest";
import { formatApiCall, isApiResource, pickReplayHeaders, safeRequestBody } from "./api-failure.js";

describe("api failure helpers", () => {
  it("treats xhr and fetch as APIs", () => {
    expect(isApiResource("xhr", "https://app.example/ess/dashboard")).toBe(true);
    expect(isApiResource("fetch", "https://app.example/data")).toBe(true);
  });

  it("treats /api/ and graphql paths as APIs even without xhr type", () => {
    expect(isApiResource("script", "https://app.example/api/leave")).toBe(true);
    expect(isApiResource("other", "https://app.example/graphql")).toBe(true);
    expect(isApiResource("image", "https://app.example/logo.png")).toBe(false);
  });

  it("formats method and path for the failing API", () => {
    expect(formatApiCall("post", "https://hr.example/api/attendance?month=8")).toBe("POST /api/attendance?month=8");
  });

  it("keeps only safe replay headers", () => {
    expect(
      pickReplayHeaders({
        Authorization: "Bearer secret",
        Cookie: "sid=1",
        "Content-Type": "application/json",
        Accept: "application/json",
      }),
    ).toEqual({
      "Content-Type": "application/json",
      Accept: "application/json",
    });
  });

  it("redacts secrets in JSON bodies", () => {
    expect(safeRequestBody(JSON.stringify({ password: "secret", q: "leave" }))).toBe(
      JSON.stringify({ password: "[REDACTED]", q: "leave" }),
    );
  });
});
