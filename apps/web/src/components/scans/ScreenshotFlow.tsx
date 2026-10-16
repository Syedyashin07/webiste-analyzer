import { Link } from "react-router-dom";
import type { PageRow } from "../../api/client";
import { uniqueScreenshotCaptions } from "../../lib/page-flow";

const PAGE_SHOT_KINDS = new Set(["DESKTOP", "TABLET", "MOBILE", "WIDE", "LAPTOP", "COMPACT", "original"]);
const FLOW_SHOT_ORDER = ["DESKTOP", "original", "WIDE", "LAPTOP", "TABLET", "MOBILE", "COMPACT"];

function pageShots(page: PageRow) {
  return (page.screenshots ?? []).filter((shot) => PAGE_SHOT_KINDS.has(shot.kind));
}

function flowShot(page: PageRow) {
  const shots = pageShots(page);
  return FLOW_SHOT_ORDER.map((kind) => shots.find((shot) => shot.kind === kind)).find(Boolean) ?? shots[0];
}

export function hasPageScreenshots(pages: PageRow[]): boolean {
  return pages.some((page) => pageShots(page).length > 0);
}

export function ScreenshotFlow({ scanId, pages }: { scanId: string; pages: PageRow[] }) {
  const steps = uniqueScreenshotCaptions(pages.filter((page) => pageShots(page).length > 0));

  if (steps.length === 0) {
    return <p className="text-sm text-slate-500">Screenshots appear as each page is scanned.</p>;
  }

  return (
    <div className="space-y-6">
      <ol className="flex gap-0 overflow-x-auto pb-2">
        {steps.map((step, index) => {
          const shot = flowShot(step);
          return (
            <li key={step.id} className="flex min-w-[11rem] items-stretch">
              <div className="w-44 shrink-0 rounded-2xl border border-slate-200 bg-[#FFFBF5] p-2 text-center">
                <div className="text-[11px] font-semibold uppercase tracking-wide text-brand-800">
                  {step.step}. {step.caption}
                </div>
                {shot ? (
                  <a href={`/api/evidence/${shot.id}`} target="_blank" rel="noreferrer">
                    <img
                      src={`/api/evidence/${shot.id}`}
                      alt={step.caption}
                      className="mt-2 h-24 w-full rounded object-cover object-top bg-slate-50"
                    />
                  </a>
                ) : null}
              </div>
              {index < steps.length - 1 ? (
                <div className="flex w-8 shrink-0 items-center justify-center text-lg text-slate-400" aria-hidden>
                  →
                </div>
              ) : null}
            </li>
          );
        })}
      </ol>

      <ol className="space-y-6">
        {steps.map((step) => {
          const shot = flowShot(step);
          return (
            <li key={`${step.id}-full`}>
              <h3 className="mb-2 text-sm font-semibold text-slate-900">
                {step.step}. {step.caption}
              </h3>
              {shot ? (
                <figure className="overflow-hidden rounded-2xl border border-slate-200">
                  <a href={`/api/evidence/${shot.id}`} target="_blank" rel="noreferrer">
                    <img
                      src={`/api/evidence/${shot.id}`}
                      alt={step.caption}
                      className="max-h-[480px] w-full object-contain object-top bg-slate-50"
                    />
                  </a>
                  <figcaption className="flex flex-wrap items-center justify-between gap-2 p-2 text-xs text-slate-600">
                    <span>Click the image to open it</span>
                    <Link className="text-brand-800" to={`/scans/${scanId}/pages/${step.id}`}>
                      Open page
                    </Link>
                  </figcaption>
                </figure>
              ) : null}
            </li>
          );
        })}
      </ol>
    </div>
  );
}
