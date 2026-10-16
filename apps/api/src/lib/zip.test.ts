import { describe, expect, it } from "vitest";
import { crc32, zipStoredFiles } from "./zip.js";

describe("zipStoredFiles", () => {
  it("packs files so names and bytes can be read back", () => {
    const hello = Buffer.from("hello screenshot");
    const zip = zipStoredFiles([
      { name: "DESKTOP/home.png", data: hello },
      { name: "MOBILE/list.png", data: Buffer.from("mobile") },
    ]);
    expect(zip.subarray(0, 4).toString("binary")).toBe("PK\u0003\u0004");
    expect(zip.includes(Buffer.from("DESKTOP/home.png"))).toBe(true);
    expect(zip.includes(hello)).toBe(true);
    expect(crc32(Buffer.from("123456789"))).toBe(0xcbf43926);
  });
});
