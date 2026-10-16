import { UnrecoverableError } from "bullmq";

export const PLAYWRIGHT_INSTALL_HINT = "Playwright Chromium is missing. Run: npx playwright install chromium";

export function mapScanJobError(error: unknown): Error {
  if (error instanceof Error && error.name === "CancelledError") return error;
  if (error instanceof UnrecoverableError) return error;
  const message = error instanceof Error ? error.message : "Scan failed";
  const lowered = message.toLowerCase();
  if (
    message.includes("Executable doesn't exist") ||
    lowered.includes("playwright chromium is missing") ||
    lowered.includes("npx playwright install")
  ) {
    return new UnrecoverableError(PLAYWRIGHT_INSTALL_HINT);
  }
  if (lowered.includes("login did not succeed") || lowered.includes("no record was found for an update")) {
    return new UnrecoverableError(message);
  }
  return error instanceof Error ? error : new Error(message);
}
