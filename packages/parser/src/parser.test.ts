import { describe, expect, it } from "vitest";
import { parseHtml } from "./index.js";

describe("parser", () => {
  it("extracts links images forms and meta", () => {
    const parsed = parseHtml(
      `<html lang="en"><head><title>Hello world page</title><meta name="description" content="A description that is long enough for tests."/></head>
       <body><h1>Home</h1><a href="/about">About</a><img src="/logo.png" alt="Logo"><form action="/x" method="post"><input name="q" required><button>Go</button></form></body></html>`,
      "https://example.com/",
    );
    expect(parsed.title).toBe("Hello world page");
    expect(parsed.language).toBe("en");
    expect(parsed.links[0]?.href).toBe("https://example.com/about");
    expect(parsed.images[0]?.alt).toBe("Logo");
    expect(parsed.forms[0]?.fields[0]?.required).toBe(true);
  });
});
