import { useState } from "react";
import { t } from "../../i18n/en";
import { Card, Modal } from "../ui/Ui";

const CRITERIA: Record<string, string> = {
  overall: "Weighted average of category scores. Critical findings deduct more than low findings.",
  performance: "Navigation timing, transfer size, request count, and available web vitals.",
  accessibility: "Labels, names, heading structure, duplicate IDs, and measurable contrast.",
  seo: "Title, meta description, canonical, headings, language, and indexability checks.",
  security: "Passive HTTPS, mixed content, headers, and insecure form checks.",
  functional: "Safe interaction failures and form validation gaps.",
  visual: "Overflow, clipping, overlap, and viewport layout defects.",
  technical: "HTTP failures, JavaScript exceptions, broken links/images, and network errors.",
};

export function ScoreCard({
  label,
  value,
  issues,
  recommendations,
}: {
  label: string;
  value: number | null;
  issues?: string[];
  recommendations?: string[];
}) {
  const [open, setOpen] = useState(false);
  const key = label.toLowerCase().split(" ")[0] ?? "overall";
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className="w-full text-left">
        <Card>
          <p className="text-sm text-slate-500">{label}</p>
          <p className="mt-1 text-3xl font-semibold">{value ?? "—"}</p>
        </Card>
      </button>
      <Modal open={open} title={label} onClose={() => setOpen(false)}>
        <p className="text-3xl font-semibold">{value ?? "—"} / 100</p>
        <p className="mt-2 text-sm text-slate-600">{CRITERIA[key] ?? CRITERIA.overall}</p>
        {issues && issues.length > 0 ? (
          <ul className="mt-3 list-disc pl-5 text-sm">
            {issues.slice(0, 8).map((issue) => (
              <li key={issue}>{issue}</li>
            ))}
          </ul>
        ) : (
          <p className="mt-3 text-sm text-slate-500">No issues are currently affecting this score.</p>
        )}
        <p className="mt-4 text-sm font-medium">Recommendations</p>
        <ul className="mt-1 list-disc pl-5 text-sm text-slate-700">
          {(recommendations ?? [t.scan.publicOnly]).map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </Modal>
    </>
  );
}
