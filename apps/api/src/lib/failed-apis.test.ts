import { describe, expect, it } from "vitest";
import { toFailedApiViews } from "./failed-apis.js";

describe("failed API views", () => {
  it("keeps the API name and drops static assets", () => {
    const views = toFailedApiViews([
      {
        id: "1",
        method: "GET",
        requestUrl: "https://app.example/api/leave",
        statusCode: 500,
        error: null,
        resourceType: "xhr",
        pageId: "p1",
        page: { url: "https://app.example/ess/leave" },
      },
      {
        id: "2",
        method: "GET",
        requestUrl: "https://app.example/logo.png",
        statusCode: 404,
        error: null,
        resourceType: "image",
        pageId: "p1",
        page: { url: "https://app.example/ess/leave" },
      },
      {
        id: "3",
        method: "GET",
        requestUrl: "https://app.example/api/leave",
        statusCode: 500,
        error: null,
        resourceType: "xhr",
        pageId: "p2",
        page: { url: "https://app.example/ess/dashboard" },
      },
    ]);
    expect(views).toHaveLength(1);
    expect(views[0]?.api).toBe("GET /api/leave");
    expect(views[0]?.occurrences).toBe(2);
    expect(views[0]?.pages).toEqual(["https://app.example/ess/leave", "https://app.example/ess/dashboard"]);
  });
});
