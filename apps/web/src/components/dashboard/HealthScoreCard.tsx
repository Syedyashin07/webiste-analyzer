import { Link } from "react-router-dom";
import { Badge, Card } from "../ui/Ui";
import { healthBandLabel, healthBandTone, healthStroke } from "../../lib/health";

export function HealthScoreCard({
  score,
  website,
  scanId,
  previousScore,
  sourceLabel,
}: {
  score: number | null | undefined;
  website?: string;
  scanId?: string;
  previousScore?: number | null;
  sourceLabel?: string;
}) {
  const value = score ?? null;
  const radius = 52;
  const circumference = 2 * Math.PI * radius;
  const progress = value == null ? 0 : Math.max(0, Math.min(100, value)) / 100;
  const dash = circumference * (1 - progress);
  const delta = value != null && previousScore != null ? value - previousScore : null;

  return (
    <Card className="p-5">
      <div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <p className="text-sm font-medium text-slate-500">Overall health</p>
          <p className="mt-1 text-sm text-slate-500">{sourceLabel ?? "Website Analyzer health score"}</p>
          {website && scanId ? (
            <Link to={`/scans/${scanId}`} className="mt-2 block truncate text-sm font-medium text-brand-800">
              {website}
            </Link>
          ) : null}
          <div className="mt-3">
            <Badge tone={healthBandTone(value)}>{healthBandLabel(value)}</Badge>
          </div>
          {delta != null ? (
            <p className={`mt-3 text-sm ${delta >= 0 ? "text-emerald-700" : "text-red-700"}`}>
              Compared with previous scan: {delta > 0 ? "+" : ""}
              {delta} points
            </p>
          ) : null}
        </div>
        <div className="mx-auto sm:mx-0" aria-hidden={value == null}>
          <svg width="148" height="148" viewBox="0 0 148 148" role="img" aria-label={value == null ? "No health score yet" : `Health score ${value} out of 100, ${healthBandLabel(value)}`}>
            <circle cx="74" cy="74" r={radius} fill="none" stroke="#e2e8f0" strokeWidth="12" />
            <circle
              cx="74"
              cy="74"
              r={radius}
              fill="none"
              stroke={healthStroke(value)}
              strokeWidth="12"
              strokeLinecap="round"
              strokeDasharray={circumference}
              strokeDashoffset={dash}
              transform="rotate(-90 74 74)"
            />
            <text x="74" y="70" textAnchor="middle" className="fill-slate-900" fontSize="28" fontWeight="700">
              {value ?? "—"}
            </text>
            <text x="74" y="92" textAnchor="middle" className="fill-slate-500" fontSize="13">
              /100
            </text>
          </svg>
        </div>
      </div>
    </Card>
  );
}
