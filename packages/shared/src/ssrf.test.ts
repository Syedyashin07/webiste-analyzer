import { describe, expect, it } from "vitest";
import { assertSafeScanTarget, isBlockedIp, isPrivateIpv4 } from "./ssrf.js";

describe("ssrf protection", () => {
  it("blocks private IPv4 ranges", () => {
    expect(isPrivateIpv4("10.0.0.8")).toBe(true);
    expect(isPrivateIpv4("192.168.1.1")).toBe(true);
    expect(isPrivateIpv4("172.16.0.1")).toBe(true);
    expect(isPrivateIpv4("127.0.0.1")).toBe(true);
    expect(isPrivateIpv4("169.254.169.254")).toBe(true);
    expect(isPrivateIpv4("8.8.8.8")).toBe(false);
  });

  it("blocks loopback and metadata IPs", () => {
    expect(isBlockedIp("127.0.0.1")).toBe(true);
    expect(isBlockedIp("0.0.0.0")).toBe(true);
    expect(isBlockedIp("169.254.169.254")).toBe(true);
    expect(isBlockedIp("::1")).toBe(true);
  });

  it("rejects non-http protocols", async () => {
    const result = await assertSafeScanTarget("ftp://example.com");
    expect(result.ok).toBe(false);
  });

  it("rejects localhost by hostname", async () => {
    const result = await assertSafeScanTarget("http://localhost:3000");
    expect(result.ok).toBe(false);
  });

  it("allows localhost when explicitly enabled", async () => {
    const result = await assertSafeScanTarget("http://127.0.0.1:4545", { allowLocal: true });
    expect(result.ok).toBe(true);
  });
});
