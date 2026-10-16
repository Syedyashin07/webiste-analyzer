import Jimp from "jimp";
import PptxGenJS from "pptxgenjs";

const W = 13.333;
const H = 7.5;
const INK = "1C1916";
const IVORY = "FFFBF5";
const ORANGE = "BF5700";
const SAND = "E39A62";
const MUTED = "7D6E5D";

export interface PptScore {
  label: string;
  value: number | null;
}

export interface PptPage {
  name: string;
  url: string;
}

export interface PptShot {
  name: string;
  url: string;
  png: Buffer;
}

export interface PptBug {
  title: string;
  severity: string;
  category: string;
  url: string;
}

export const PPT_TEMPLATES = ["ink", "ivory", "split", "sand"] as const;
export type PptTemplate = (typeof PPT_TEMPLATES)[number];

export interface ScanPptInput {
  presenterName: string;
  companyName: string;
  siteName: string;
  website: string;
  coverageLabel: string;
  completedAt: string | null;
  pagesScanned: number;
  pagesDiscovered: number;
  issuesFound: number;
  template?: PptTemplate;
  scores: PptScore[];
  pages: PptPage[];
  shots: PptShot[];
  bugs: PptBug[];
}

interface Theme {
  id: PptTemplate;
  accent: string;
  contentBg: string;
  card: string;
  line: string;
}

function clip(value: string, max: number): string {
  const text = value.replace(/\s+/g, " ").trim();
  if (text.length <= max) return text;
  return `${text.slice(0, max - 1)}…`;
}

function coverFont(text: string): number {
  if (text.length > 36) return 26;
  if (text.length > 22) return 32;
  return 40;
}

function themeFor(id: PptTemplate | undefined): Theme {
  if (id === "ivory") return { id, accent: ORANGE, contentBg: IVORY, card: "FFFFFF", line: "E4D7C3" };
  if (id === "split") return { id, accent: "8C3A0F", contentBg: "FFFBF5", card: "FFFFFF", line: "E4D7C3" };
  if (id === "sand") return { id, accent: "8C3A0F", contentBg: "FBF3EA", card: "FFFBF5", line: "E4D7C3" };
  return { id: "ink", accent: ORANGE, contentBg: IVORY, card: "FFFFFF", line: "E4D7C3" };
}

function paintCover(slide: PptxGenJS.Slide, theme: Theme, input: ScanPptInput): void {
  const when = input.completedAt ? new Date(input.completedAt).toLocaleDateString() : "";
  const meta = [input.coverageLabel, when].filter(Boolean).join("  ·  ");
  const company = clip(input.companyName, 80);
  const site = clip(input.siteName, 80);
  const siteUrl = clip(input.website, 120);
  const person = clip(input.presenterName, 80);

  if (theme.id === "ivory") {
    slide.background = { color: IVORY };
    slide.addShape("rect", { x: 0, y: 0, w: W, h: 0.28, fill: { color: ORANGE }, line: { color: ORANGE } });
    slide.addText("WEBSITE ANALYZER", { x: 0.7, y: 0.7, w: 8, h: 0.3, fontFace: "Calibri", fontSize: 13, color: ORANGE, charSpacing: 2.2 });
    slide.addText(company, { x: 0.7, y: 1.9, w: 8.4, h: 1.5, fontFace: "Calibri", fontSize: coverFont(company), bold: true, color: INK });
    slide.addText(site, { x: 0.7, y: 3.55, w: 8.4, h: 0.45, fontFace: "Calibri", fontSize: 22, color: ORANGE });
    slide.addText(siteUrl, { x: 0.7, y: 4.1, w: 8.2, h: 0.4, fontFace: "Calibri", fontSize: 14, color: MUTED });
    slide.addText(meta, { x: 0.7, y: 4.6, w: 8, h: 0.32, fontFace: "Calibri", fontSize: 13, color: MUTED });
    placeName(slide, person, ORANGE, INK);
    return;
  }

  if (theme.id === "split") {
    slide.background = { color: IVORY };
    slide.addShape("rect", { x: 0, y: 0, w: 6.35, h: H, fill: { color: ORANGE }, line: { color: ORANGE } });
    slide.addText("WEBSITE ANALYZER", { x: 0.45, y: 0.55, w: 5.5, h: 0.3, fontFace: "Calibri", fontSize: 13, color: "F3E0CC", charSpacing: 1.6 });
    slide.addText(company, { x: 0.45, y: 2.0, w: 5.5, h: 1.8, fontFace: "Calibri", fontSize: coverFont(company) - 4, bold: true, color: IVORY });
    slide.addText(site, { x: 0.45, y: 4.0, w: 5.5, h: 0.4, fontFace: "Calibri", fontSize: 18, color: INK });
    slide.addText(siteUrl, { x: 6.7, y: 2.3, w: 6.1, h: 0.7, fontFace: "Calibri", fontSize: 18, color: INK });
    slide.addText(meta, { x: 6.7, y: 3.1, w: 6.1, h: 0.4, fontFace: "Calibri", fontSize: 14, color: MUTED });
    placeName(slide, person, ORANGE, INK);
    return;
  }

  if (theme.id === "sand") {
    slide.background = { color: "F3E0CC" };
    slide.addShape("rect", { x: 0, y: 6.15, w: W, h: 1.35, fill: { color: INK }, line: { color: INK } });
    slide.addText("WEBSITE ANALYZER", { x: 0.7, y: 0.5, w: 8, h: 0.3, fontFace: "Calibri", fontSize: 13, color: "8C3A0F", charSpacing: 2.2 });
    slide.addText(company, { x: 0.7, y: 1.7, w: 11.5, h: 1.5, fontFace: "Calibri", fontSize: coverFont(company), bold: true, color: INK });
    slide.addText(site, { x: 0.7, y: 3.4, w: 11, h: 0.45, fontFace: "Calibri", fontSize: 22, color: "8C3A0F" });
    slide.addText(siteUrl, { x: 0.7, y: 4.0, w: 11, h: 0.4, fontFace: "Calibri", fontSize: 14, color: MUTED });
    slide.addText(meta, { x: 0.7, y: 4.5, w: 8, h: 0.32, fontFace: "Calibri", fontSize: 13, color: MUTED });
    placeName(slide, person, SAND, IVORY);
    return;
  }

  slide.background = { color: INK };
  slide.addShape("rect", { x: 0, y: 0, w: 0.22, h: H, fill: { color: ORANGE }, line: { color: ORANGE } });
  slide.addText("WEBSITE ANALYZER", { x: 0.7, y: 0.55, w: 8, h: 0.32, fontFace: "Calibri", fontSize: 13, color: SAND, charSpacing: 2.4 });
  slide.addText(company, { x: 0.7, y: 1.9, w: 8.4, h: 1.5, fontFace: "Calibri", fontSize: coverFont(company), bold: true, color: IVORY });
  slide.addText(site, { x: 0.7, y: 3.55, w: 8.4, h: 0.45, fontFace: "Calibri", fontSize: 22, color: SAND });
  slide.addText(siteUrl, { x: 0.7, y: 4.1, w: 8.2, h: 0.4, fontFace: "Calibri", fontSize: 14, color: "F7F1E6" });
  slide.addText(meta, { x: 0.7, y: 4.6, w: 8, h: 0.32, fontFace: "Calibri", fontSize: 13, color: "C4B8A8" });
  placeName(slide, person, SAND, IVORY);
}

function placeName(slide: PptxGenJS.Slide, person: string, labelColor: string, nameColor: string): void {
  slide.addText("Prepared by", {
    x: 7.6,
    y: 6.35,
    w: 5.15,
    h: 0.28,
    fontFace: "Calibri",
    fontSize: 12,
    color: labelColor,
    align: "right",
  });
  slide.addText(person, {
    x: 7.6,
    y: 6.68,
    w: 5.15,
    h: 0.4,
    fontFace: "Calibri",
    fontSize: 20,
    bold: true,
    color: nameColor,
    align: "right",
  });
}

function footer(slide: PptxGenJS.Slide, companyName: string, theme: Theme): void {
  slide.addShape("rect", {
    x: 0,
    y: 7.22,
    w: W,
    h: 0.02,
    fill: { color: theme.line },
    line: { color: theme.line },
  });
  slide.addText(clip(companyName, 48), {
    x: 0.55,
    y: 7.24,
    w: 8,
    h: 0.24,
    fontFace: "Calibri",
    fontSize: 11,
    color: MUTED,
  });
  slide.addText("Website Analyzer", {
    x: 8.5,
    y: 7.24,
    w: 4.3,
    h: 0.24,
    fontFace: "Calibri",
    fontSize: 11,
    color: MUTED,
    align: "right",
  });
}

function contentSlide(pptx: PptxGenJS, companyName: string, theme: Theme): PptxGenJS.Slide {
  const slide = pptx.addSlide();
  slide.background = { color: theme.contentBg };
  slide.addShape("rect", {
    x: 0,
    y: 0,
    w: W,
    h: 0.08,
    fill: { color: theme.accent },
    line: { color: theme.accent },
  });
  footer(slide, companyName, theme);
  return slide;
}

async function jpegData(png: Buffer): Promise<string | null> {
  try {
    const image = await Jimp.read(png);
    image.scaleToFit(720, 480);
    const jpeg = await image.quality(72).getBufferAsync(Jimp.MIME_JPEG);
    return `image/jpeg;base64,${jpeg.toString("base64")}`;
  } catch {
    return null;
  }
}

export async function buildScanPpt(input: ScanPptInput): Promise<Buffer> {
  const pptx = new PptxGenJS();
  const theme = themeFor(input.template);
  pptx.defineLayout({ name: "WIDE", width: W, height: H });
  pptx.layout = "WIDE";
  pptx.author = input.presenterName;
  pptx.title = `${input.companyName} — ${input.siteName}`;
  pptx.subject = input.website;

  const cover = pptx.addSlide();
  paintCover(cover, theme, input);

  const summary = contentSlide(pptx, input.companyName, theme);
  summary.addText("What the scan found", {
    x: 0.55,
    y: 0.28,
    w: 12,
    h: 0.42,
    fontFace: "Calibri",
    fontSize: 26,
    bold: true,
    color: INK,
  });
  const facts = [
    ["Pages opened", String(input.pagesScanned)],
    ["Pages discovered", String(input.pagesDiscovered)],
    ["Issues", String(input.issuesFound)],
    ["Screens", String(input.shots.length)],
  ];
  facts.forEach((fact, index) => {
    const x = 0.55 + index * 3.15;
    summary.addShape("roundRect", {
      x,
      y: 0.85,
      w: 2.95,
      h: 1.15,
      fill: { color: theme.card },
      line: { color: theme.line },
      rectRadius: 0.1,
    });
    summary.addText(fact[1], {
      x,
      y: 0.92,
      w: 2.95,
      h: 0.58,
      align: "center",
      fontFace: "Calibri",
      fontSize: 26,
      bold: true,
      color: theme.accent,
    });
    summary.addText(fact[0], {
      x,
      y: 1.5,
      w: 2.95,
      h: 0.32,
      align: "center",
      fontFace: "Calibri",
      fontSize: 12,
      color: MUTED,
    });
  });
  const scored = input.scores.filter((score) => score.value != null).slice(0, 4);
  scored.forEach((score, index) => {
    const x = 0.55 + index * 3.15;
    summary.addText(String(score.value), {
      x,
      y: 2.2,
      w: 2.95,
      h: 0.42,
      fontFace: "Calibri",
      fontSize: 22,
      bold: true,
      color: theme.accent,
    });
    summary.addText(score.label, {
      x,
      y: 2.6,
      w: 2.95,
      h: 0.28,
      fontFace: "Calibri",
      fontSize: 12,
      color: INK,
    });
  });
  const path = input.pages.slice(0, 12).map((page) => page.name).join("  →  ");
  summary.addText(path || "No pages were stored for this scan.", {
    x: 0.55,
    y: scored.length ? 3.15 : 2.3,
    w: 12.2,
    h: 1.2,
    fontFace: "Calibri",
    fontSize: 16,
    bold: true,
    color: theme.accent,
  });

  const prepared: Array<{ name: string; url: string; data: string }> = [];
  for (const shot of input.shots) {
    const data = await jpegData(shot.png);
    if (data) prepared.push({ name: shot.name, url: shot.url, data });
  }
  chunk(prepared, 3).forEach((group, slideIndex) => {
    const slide = contentSlide(pptx, input.companyName, theme);
    const start = slideIndex * 3;
    slide.addText(`Screens ${start + 1}–${start + group.length} of ${prepared.length}`, {
      x: 0.35,
      y: 0.18,
      w: 12.6,
      h: 0.32,
      fontFace: "Calibri",
      fontSize: 14,
      bold: true,
      color: INK,
    });
    group.forEach((shot, index) => {
      const x = 0.35 + index * 4.3;
      slide.addText(clip(shot.name, 32), {
        x,
        y: 0.52,
        w: 4.05,
        h: 0.28,
        fontFace: "Calibri",
        fontSize: 13,
        bold: true,
        color: INK,
      });
      slide.addImage({
        data: shot.data,
        x,
        y: 0.86,
        w: 4.05,
        h: 5.15,
        sizing: { type: "contain", x, y: 0.86, w: 4.05, h: 5.15 },
      });
      slide.addText(clip(shot.url, 70), {
        x,
        y: 6.08,
        w: 4.05,
        h: 0.95,
        fontFace: "Calibri",
        fontSize: 10,
        color: MUTED,
      });
    });
  });

  const bugGroups = chunk(input.bugs.slice(0, 12), 12);
  bugGroups.forEach((group) => {
    const slide = contentSlide(pptx, input.companyName, theme);
    slide.addText(input.bugs.length > 12 ? `Issues to look at (first 12 of ${input.bugs.length})` : "Issues to look at", {
      x: 0.55,
      y: 0.28,
      w: 12,
      h: 0.4,
      fontFace: "Calibri",
      fontSize: 24,
      bold: true,
      color: INK,
    });
    const header = { fill: { color: theme.accent }, color: "FFFFFF", bold: true, align: "left" as const };
    slide.addTable(
      [
        [
          { text: "Severity", options: header },
          { text: "Category", options: header },
          { text: "Issue", options: header },
          { text: "Page", options: header },
        ],
        ...group.map((bug) => [bug.severity, clip(bug.category, 18), clip(bug.title, 48), clip(bug.url, 42)]),
      ],
      {
        x: 0.55,
        y: 0.9,
        w: 12.2,
        colW: [1.6, 2.1, 4.7, 3.8],
        border: { type: "solid", color: theme.line, pt: 0.5 },
        fontFace: "Calibri",
        fontSize: 12,
        color: INK,
        valign: "middle",
      },
    );
  });

  const output = await pptx.write({ outputType: "nodebuffer" });
  return Buffer.isBuffer(output) ? output : Buffer.from(output as Uint8Array);
}

function chunk<T>(items: T[], size: number): T[][] {
  const groups: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    groups.push(items.slice(index, index + size));
  }
  return groups;
}
