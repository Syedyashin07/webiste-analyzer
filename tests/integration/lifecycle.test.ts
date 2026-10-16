import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { AddressInfo } from "node:net";
import { createFixtureServer } from "../fixtures/server.js";

describe("fixture website", () => {
  let server: ReturnType<typeof createFixtureServer>;
  let base: string;

  beforeAll(async () => {
    server = createFixtureServer();
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    const address = server.address() as AddressInfo;
    base = `http://127.0.0.1:${address.port}`;
  });

  afterAll(async () => {
    await new Promise<void>((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
  });

  it("contains intentional bugs used by the scanner", async () => {
    const home = await fetch(`${base}/`);
    const html = await home.text();
    expect(home.status).toBe(200);
    expect(html).toContain("missing-image.png");
    expect(html).toContain("Cannot read properties of undefined");
    expect(html).toContain("/broken-page");
    expect(html).not.toContain("<h1>");

    const missing = await fetch(`${base}/broken-page`);
    expect(missing.status).toBe(404);

    const fail = await fetch(`${base}/status/500`);
    expect(fail.status).toBe(500);

    const about = await fetch(`${base}/about`);
    expect(about.status).toBe(200);
    expect((await about.text()).toLowerCase()).toContain("<h1>about</h1>");
  });
});
