import { t } from "../../i18n/en";
import { healthStroke } from "../../lib/health";
import { Card } from "../ui/Ui";

export function CategoryHealth({
  scores,
}: {
  scores: {
    performance: number | null;
    accessibility: number | null;
    seo: number | null;
    security: number | null;
    functional: number | null;
    visual: number | null;
    technical: number | null;
  };
}) {
  const rows = [
    { label: t.scores.performance, value: scores.performance },
    { label: t.scores.accessibility, value: scores.accessibility },
    { label: t.scores.seo, value: scores.seo },
    { label: t.scores.security, value: scores.security },
    { label: t.scores.functional, value: scores.functional },
    { label: t.scores.visual, value: scores.visual },
    { label: t.scores.technical, value: scores.technical },
  ];

  return (
    <Card className="p-5">
      <h2 className="text-base font-semibold text-slate-900">Category health</h2>
      <p className="mt-1 text-sm text-slate-500">QA health scores from the latest completed checks.</p>
      <ul className="mt-4 space-y-3">
        {rows.map((row) => {
          const width = row.value == null ? 0 : Math.max(0, Math.min(100, row.value));
          return (
            <li key={row.label}>
              <div className="mb-1 flex items-center justify-between gap-3 text-sm">
                <span className="text-slate-700">{row.label}</span>
                <span className="font-medium text-slate-900">{row.value ?? "—"}</span>
              </div>
              <div className="h-2 rounded-full bg-slate-100" aria-hidden="true">
                <div
                  className="h-2 rounded-full"
                  style={{ width: `${width}%`, backgroundColor: healthStroke(row.value) }}
                />
              </div>
            </li>
          );
        })}
      </ul>
    </Card>
  );
}
