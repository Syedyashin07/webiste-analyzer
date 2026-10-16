import { Link } from "react-router-dom";
import type { ScanSummary } from "../../api/client";
import { t } from "../../i18n/en";
import { Badge, Button, Card, statusTone } from "../ui/Ui";

export function ActiveScanCard({
  scan,
  onPause,
  onResume,
  onStop,
  pending,
}: {
  scan: ScanSummary;
  onPause: () => void;
  onResume: () => void;
  onStop: () => void;
  pending?: boolean;
}) {
  const pagesTotal = scan.pagesDiscovered || scan.pagesScanned;
  return (
    <Card className="border-brand-700/20 p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-medium text-slate-500">Scan in progress</p>
          <p className="mt-1 truncate text-lg font-semibold text-slate-900">{scan.host || scan.url}</p>
        </div>
        <Badge tone={statusTone(scan.status)}>{scan.status}</Badge>
      </div>
      <div className="mt-4" role="progressbar" aria-valuenow={scan.progress} aria-valuemin={0} aria-valuemax={100} aria-label="Scan progress">
        <div className="h-2 rounded-full bg-slate-200">
          <div className="h-2 rounded-full bg-brand-700" style={{ width: `${Math.max(0, Math.min(100, scan.progress))}%` }} />
        </div>
        <p className="mt-1 text-sm text-slate-600">{scan.progress}%</p>
      </div>
      <p className="mt-3 break-all text-sm text-slate-600">
        Current URL: <span className="font-medium text-slate-800">{scan.currentUrl || scan.url}</span>
      </p>
      {scan.currentAction ? <p className="mt-1 text-sm text-slate-500">{scan.currentAction}</p> : null}
      <p className="mt-3 text-sm text-slate-600">
        Pages: {scan.pagesScanned} / {pagesTotal || "—"} · Bugs: {scan.issuesFound}
      </p>
      <div className="mt-4 flex flex-wrap gap-2">
        <Link
          to={`/scans/${scan.id}`}
          className="inline-flex items-center justify-center rounded-xl bg-brand-700 px-4 py-2 text-sm font-medium text-white hover:bg-brand-800"
        >
          View scan
        </Link>
        {scan.status === "PAUSED" ? (
          <Button variant="secondary" onClick={onResume} disabled={pending}>
            {t.actions.resume}
          </Button>
        ) : scan.status !== "QUEUED" ? (
          <Button variant="secondary" onClick={onPause} disabled={pending}>
            {t.actions.pause}
          </Button>
        ) : null}
        <Button variant="danger" onClick={onStop} disabled={pending}>
          {t.actions.cancel}
        </Button>
      </div>
    </Card>
  );
}
