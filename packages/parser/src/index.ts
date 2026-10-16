import * as cheerio from "cheerio";
import { isInternalLink, tryParseUrl } from "@qa-scanner/shared";

export interface ParsedLink {
  href: string;
  text: string;
  isInternal: boolean;
}

export interface ParsedImage {
  src: string;
  alt: string | null;
}

export interface ParsedFormField {
  name: string;
  type: string;
  required: boolean;
  label: string | null;
  validation: {
    minLength?: number;
    maxLength?: number;
    min?: number;
    max?: number;
    pattern?: string;
  };
}

export interface ParsedForm {
  action: string | null;
  method: string;
  fields: ParsedFormField[];
  hasSubmit: boolean;
}

export interface ParsedPage {
  title: string | null;
  metaDescription: string | null;
  canonical: string | null;
  robotsMeta: string | null;
  language: string | null;
  headings: { level: number; text: string }[];
  links: ParsedLink[];
  images: ParsedImage[];
  forms: ParsedForm[];
  scripts: string[];
  stylesheets: string[];
  iframes: string[];
  htmlSize: number;
}

function absUrl(value: string | undefined, pageUrl: string): string | null {
  if (!value) return null;
  const parsed = tryParseUrl(value, pageUrl);
  return parsed ? parsed.toString() : null;
}

export function parseHtml(html: string, pageUrl: string): ParsedPage {
  const $ = cheerio.load(html);
  const title = $("title").first().text().trim() || null;
  const metaDescription = $('meta[name="description"]').attr("content")?.trim() || null;
  const canonical = absUrl($('link[rel="canonical"]').attr("href"), pageUrl);
  const robotsMeta = $('meta[name="robots"]').attr("content")?.trim() || null;
  const language = $("html").attr("lang")?.trim() || null;

  const headings = ["h1", "h2", "h3", "h4", "h5", "h6"].flatMap((tag, index) =>
    $(tag)
      .toArray()
      .map((el) => ({
        level: index + 1,
        text: $(el).text().replace(/\s+/g, " ").trim(),
      })),
  );

  const links: ParsedLink[] = [];
  $("a[href], [data-href], [data-to], [data-url], [routerlink], [ng-href]").each((_, el) => {
    const href = absUrl(
      $(el).attr("href") ||
        $(el).attr("data-href") ||
        $(el).attr("data-to") ||
        $(el).attr("data-url") ||
        $(el).attr("routerlink") ||
        $(el).attr("ng-href"),
      pageUrl,
    );
    if (!href) return;
    if (!href.startsWith("http://") && !href.startsWith("https:")) return;
    links.push({
      href,
      text: $(el).text().replace(/\s+/g, " ").trim().slice(0, 200),
      isInternal: isInternalLink(href, pageUrl),
    });
  });

  const images: ParsedImage[] = [];
  $("img").each((_, el) => {
    const src = absUrl($(el).attr("src"), pageUrl);
    if (!src) {
      images.push({ src: $(el).attr("src") ?? "", alt: $(el).attr("alt") ?? null });
      return;
    }
    images.push({ src, alt: $(el).attr("alt") ?? null });
  });

  const forms: ParsedForm[] = [];
  $("form").each((_, formEl) => {
    const $form = $(formEl);
    const fields: ParsedFormField[] = [];
    $form.find("input, textarea, select").each((__, fieldEl) => {
      const $field = $(fieldEl);
      const type = ($field.attr("type") || fieldEl.tagName.toLowerCase()).toLowerCase();
      if (type === "hidden" || type === "submit" || type === "button" || type === "image") return;
      const name = $field.attr("name") || $field.attr("id") || type;
      const id = $field.attr("id");
      const label = id ? $(`label[for="${id}"]`).text().trim() || null : null;
      fields.push({
        name,
        type,
        required: $field.attr("required") !== undefined,
        label,
        validation: {
          minLength: $field.attr("minlength") ? Number($field.attr("minlength")) : undefined,
          maxLength: $field.attr("maxlength") ? Number($field.attr("maxlength")) : undefined,
          min: $field.attr("min") ? Number($field.attr("min")) : undefined,
          max: $field.attr("max") ? Number($field.attr("max")) : undefined,
          pattern: $field.attr("pattern"),
        },
      });
    });
    forms.push({
      action: absUrl($form.attr("action"), pageUrl) ?? $form.attr("action") ?? null,
      method: ($form.attr("method") || "get").toLowerCase(),
      fields,
      hasSubmit: $form.find('button[type="submit"], input[type="submit"], button:not([type])').length > 0,
    });
  });

  const scripts = $("script[src]")
    .toArray()
    .map((el) => absUrl($(el).attr("src"), pageUrl))
    .filter((value): value is string => Boolean(value));
  const stylesheets = $('link[rel="stylesheet"]')
    .toArray()
    .map((el) => absUrl($(el).attr("href"), pageUrl))
    .filter((value): value is string => Boolean(value));
  const iframes = $("iframe[src]")
    .toArray()
    .map((el) => absUrl($(el).attr("src"), pageUrl))
    .filter((value): value is string => Boolean(value));

  return {
    title,
    metaDescription,
    canonical,
    robotsMeta,
    language,
    headings,
    links,
    images,
    forms,
    scripts,
    stylesheets,
    iframes,
    htmlSize: Buffer.byteLength(html, "utf8"),
  };
}

export function extractLinks(html: string, pageUrl: string): string[] {
  return parseHtml(html, pageUrl).links.map((link) => link.href);
}
