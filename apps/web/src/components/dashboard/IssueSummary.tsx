import { Link } from "react-router-dom";
import { Card } from "../ui/Ui";

const SEVERITIES = [
  { key: "CRITICAL", label: "Critical", className: "text-red-700" },
  { key: "HIGH", label: "High", className: "text-amber-700" },
  { key: "MEDIUM", label: "Medium", className: "text-sky-700" },
  { key: "LOW", label: "Low", className: "text-slate-700" },
] as const;

export function IssueSummary({
  counts,
  sourceLabel = "the latest scan",
}: {
  counts: Record<string, number>;
  sourceLabel?: string;
}) {
  const total = SEVERITIES.reduce((sum, item) => sum + (counts[item.key] ?? 0), 0);
  return (
    <Card className="p-5">
      <h2 className="text-base font-semibold text-slate-900">Issues requiring attention</h2>
      <p className="mt-1 text-sm text-slate-500">
        {total === 0 ? `No bugs on ${sourceLabel}.` : `${total} bugs on ${sourceLabel}, grouped by severity.`}
      </p>
      <ul className="mt-4 divide-y divide-slate-100">
        {SEVERITIES.map((item) => (
          <li key={item.key}>
            <Link
              to={`/bugs?severity=${item.key}`}
              className="flex items-center justify-between py-2.5 text-sm hover:text-brand-800"
            >
              <span className={item.className}>{item.label}</span>
              <span className="font-semibold text-slate-900">{counts[item.key] ?? 0}</span>
            </Link>
          </li>
        ))}
      </ul>
    </Card>
  );
}
