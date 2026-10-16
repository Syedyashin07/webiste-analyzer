import { describe, expect, it } from "vitest";
import { crawlSite, parseRobotsTxt, parseSitemapXml } from "./index.js";

describe("crawler", () => {
  it("parses robots.txt allow/disallow", () => {
    const robots = parseRobotsTxt("User-agent: *\nDisallow: /private\nAllow: /private/ok\n");
    expect(robots.allows("/about")).toBe(true);
    expect(robots.allows("/private/secret")).toBe(false);
    expect(robots.allows("/private/ok")).toBe(true);
  });

  it("discovers internal pages and respects max pages", async () => {
    const html: Record<string, string> = {
      "https://example.com/": `<a href="/about">About</a><a href="/contact">Contact</a><a href="https://external.test">x</a>`,
      "https://example.com/about": `<a href="/pricing">Pricing</a>`,
      "https://example.com/contact": `<a href="/">Home</a>`,
      "https://example.com/pricing": `<a href="/about">About</a>`,
    };
    const pages = await crawlSite({
      startUrl: "https://example.com/",
      maxPages: 3,
      maxDepth: 5,
      delayMs: 0,
      respectRobots: false,
      fetchHtml: async (url) => ({ html: html[url] ?? "", finalUrl: url, status: 200 }),
      extractLinks: (pageHtml, pageUrl) => {
        const matches = [...pageHtml.matchAll(/href="([^"]+)"/g)];
        return matches.map((match) => new URL(match[1] ?? "", pageUrl).toString());
      },
    });
    expect(pages.length).toBe(3);
    expect(pages.some((page) => page.normalizedUrl.includes("external"))).toBe(false);
  });

  it("does not loop on duplicate urls", async () => {
    const pages = await crawlSite({
      startUrl: "https://example.com/a",
      maxPages: 10,
      maxDepth: 5,
      delayMs: 0,
      respectRobots: false,
      fetchHtml: async () => ({
        html: `<a href="/a">A</a><a href="/a#frag">A2</a><a href="https://example.com/a/">A3</a>`,
        finalUrl: "https://example.com/a",
        status: 200,
      }),
      extractLinks: (pageHtml, pageUrl) =>
        [...pageHtml.matchAll(/href="([^"]+)"/g)].map((match) => new URL(match[1] ?? "", pageUrl).toString()),
    });
    expect(pages).toHaveLength(1);
  });

  it("landing page mode only discovers the start URL", async () => {
    let htmlFetches = 0;
    const pages = await crawlSite({
      startUrl: "https://example.com/",
      maxPages: 1,
      maxDepth: 0,
      delayMs: 0,
      respectRobots: false,
      fetchText: async () => "<urlset><url><loc>https://example.com/about</loc></url></urlset>",
      fetchHtml: async (url) => {
        htmlFetches += 1;
        return { html: `<a href="/about">About</a>`, finalUrl: url, status: 200 };
      },
      extractLinks: (pageHtml, pageUrl) =>
        [...pageHtml.matchAll(/href="([^"]+)"/g)].map((match) => new URL(match[1] ?? "", pageUrl).toString()),
    });
    expect(pages).toHaveLength(1);
    expect(pages[0]?.normalizedUrl).toBe("https://example.com/");
    expect(htmlFetches).toBe(0);
  });
});
