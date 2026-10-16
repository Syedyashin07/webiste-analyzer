import { CRAWLER_USER_AGENT, assertSafeScanTarget } from "@qa-scanner/shared";
import { env } from "../config.js";

export async function checkResource(
  rawUrl: string,
  timeoutMs = 10000,
): Promise<{ status: number | null; error: string | null; redirectCount: number }> {
  const allowLocal = env.ALLOW_LOCAL_TARGETS;
  let current = rawUrl;
  let redirectCount = 0;

  for (let hop = 0; hop < 6; hop += 1) {
    const safety = await assertSafeScanTarget(current, { allowLocal });
    if (!safety.ok) {
      return { status: null, error: safety.reason ?? "Blocked target", redirectCount };
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      let response = await fetch(current, {
        method: "HEAD",
        redirect: "manual",
        signal: controller.signal,
        headers: { "User-Agent": CRAWLER_USER_AGENT },
      });
      if (response.status === 405 || response.status === 501) {
        response = await fetch(current, {
          method: "GET",
          redirect: "manual",
          signal: controller.signal,
          headers: { "User-Agent": CRAWLER_USER_AGENT },
        });
      }

      if (response.status >= 300 && response.status < 400) {
        const location = response.headers.get("location");
        if (!location) return { status: response.status, error: "Redirect without Location", redirectCount };
        redirectCount += 1;
        current = new URL(location, current).toString();
        continue;
      }

      return { status: response.status, error: null, redirectCount };
    } catch (error) {
      const message = error instanceof Error ? error.message : "Request failed";
      const lowered = message.toLowerCase();
      if (lowered.includes("abort")) return { status: null, error: "timeout", redirectCount };
      if (lowered.includes("enotfound") || lowered.includes("dns")) {
        return { status: null, error: "DNS failure", redirectCount };
      }
      return { status: null, error: "connection failure", redirectCount };
    } finally {
      clearTimeout(timer);
    }
  }

  return { status: null, error: "redirect problems", redirectCount };
}

export async function replayHttpRequest(input: {
  url: string;
  method: string;
  body?: string | null;
  headers?: Record<string, string> | null;
  timeoutMs?: number;
}): Promise<{ ok: boolean; status: number | null; error: string | null; durationMs: number }> {
  const started = Date.now();
  const safety = await assertSafeScanTarget(input.url, { allowLocal: env.ALLOW_LOCAL_TARGETS });
  if (!safety.ok) {
    return { ok: false, status: null, error: safety.reason ?? "Blocked target", durationMs: Date.now() - started };
  }

  const method = (input.method || "GET").toUpperCase();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), input.timeoutMs ?? 8000);
  try {
    const headers: Record<string, string> = { "User-Agent": CRAWLER_USER_AGENT };
    const contentType = input.headers?.["content-type"] ?? input.headers?.["Content-Type"];
    const accept = input.headers?.accept ?? input.headers?.Accept;
    if (contentType) headers["Content-Type"] = contentType;
    if (accept) headers.Accept = accept;
    const canHaveBody = !["GET", "HEAD"].includes(method);
    const response = await fetch(input.url, {
      method,
      headers,
      body: canHaveBody && input.body ? input.body : undefined,
      redirect: "follow",
      signal: controller.signal,
    });
    await response.arrayBuffer().catch(() => undefined);
    const status = response.status;
    return {
      ok: status < 400,
      status,
      error: status >= 400 ? `HTTP ${status}` : null,
      durationMs: Date.now() - started,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Request failed";
    const lowered = message.toLowerCase();
    let errorText = "connection failure";
    if (lowered.includes("abort")) errorText = "timeout";
    else if (lowered.includes("enotfound") || lowered.includes("dns")) errorText = "DNS failure";
    return { ok: false, status: null, error: errorText, durationMs: Date.now() - started };
  } finally {
    clearTimeout(timer);
  }
}

export async function fetchTextSafe(rawUrl: string, timeoutMs = 8000): Promise<string | null> {
  const safety = await assertSafeScanTarget(rawUrl, { allowLocal: env.ALLOW_LOCAL_TARGETS });
  if (!safety.ok) return null;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(rawUrl, {
      signal: controller.signal,
      headers: { "User-Agent": CRAWLER_USER_AGENT },
    });
    if (!response.ok) return null;
    return await response.text();
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}
