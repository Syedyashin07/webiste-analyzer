import { describe, expect, it } from "vitest";
import { UnrecoverableError } from "bullmq";
import { PLAYWRIGHT_INSTALL_HINT, mapScanJobError } from "./scan-error.js";

describe("mapScanJobError", () => {
  it("does not retry a missing Playwright browser", () => {
    const mapped = mapScanJobError(
      new Error("browserType.launch: Executable doesn't exist at C:\\ms-playwright\\chrome-headless-shell.exe"),
    );
    expect(mapped).toBeInstanceOf(UnrecoverableError);
    expect(mapped.message).toBe(PLAYWRIGHT_INSTALL_HINT);
  });

  it("keeps cancel errors cancellable", () => {
    const error = new Error("Scan cancelled");
    error.name = "CancelledError";
    expect(mapScanJobError(error).name).toBe("CancelledError");
  });

  it("does not retry a failed login", () => {
    const mapped = mapScanJobError(new Error("Login did not succeed. Check username and password."));
    expect(mapped).toBeInstanceOf(UnrecoverableError);
  });
});
