import { Link } from "react-router-dom";
import type { ScanSummary } from "../../api/client";
import { CreatePptButton } from "../scans/CreatePptButton";
import { Badge, Card, statusTone } from "../ui/Ui";

function coverageText(scan: ScanSummary): string {
  if (scan.coverageLabel) return scan.coverageLabel;
  if (scan.coverage === "LANDING") return "Landing page only";
  if (scan.coverage === "SCREENSHOTS") return "Screenshot every page";
  if (scan.coverage === "INSIDE") return "Inside every page";
  return "Full website (end to end)";
}

export function LatestScanCard({ scans }: { scans: ScanSummary[] }) {
  if (scans.length === 0) return null;
  return (
    <Card className="overflow-hidden p-0">
      <div className="border-b border-slate-100 px-5 py-4">
        <h2 className="text-base font-semibold text-slate-900">Latest scan</h2>
        <p className="mt-1 text-sm text-slate-500">Recent website QA results from the database.</p>
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-full text-left text-sm">
          <thead className="bg-slate-50 text-slate-600">
            <tr>
              <th className="px-5 py-2.5 font-medium">Website</th>
              <th className="px-3 py-2.5 font-medium">Coverage</th>
              <th className="px-3 py-2.5 font-medium">Score</th>
              <th className="px-3 py-2.5 font-medium">Pages</th>
              <th className="px-3 py-2.5 font-medium">Bugs</th>
              <th className="px-3 py-2.5 font-medium">Status</th>
              <th className="px-3 py-2.5 font-medium">Date</th>
              <th className="px-5 py-2.5 font-medium">Action</th>
            </tr>
          </thead>
          <tbody>
            {scans.map((scan) => (
              <tr key={scan.id} className="border-t border-slate-100">
                <td className="max-w-[220px] truncate px-5 py-3 font-medium text-slate-900" title={scan.url}>
                  {scan.host || scan.url}
                </td>
                <td className="whitespace-nowrap px-3 py-3 text-slate-600">{coverageText(scan)}</td>
                <td className="px-3 py-3">{scan.overallScore ?? "—"}</td>
                <td className="px-3 py-3">{scan.pagesScanned}</td>
                <td className="px-3 py-3">{scan.issuesFound}</td>
                <td className="px-3 py-3">
                  <Badge tone={statusTone(scan.status)}>{scan.status}</Badge>
                </td>
                <td className="whitespace-nowrap px-3 py-3 text-slate-500">{new Date(scan.createdAt).toLocaleString()}</td>
                <td className="px-5 py-3">
                  <Link className="font-medium text-brand-800" to={`/scans/${scan.id}`}>
                    Open
                  </Link>
                  {scan.coverage === "SCREENSHOTS" && scan.status === "COMPLETED" && scan.pagesScanned > 0 ? (
                    <a className="ml-3 font-medium text-brand-800" href={`/api/scans/${scan.id}/flow.pdf`}>
                      Flow PDF
                    </a>
                  ) : null}
                  {scan.status === "COMPLETED" ? <CreatePptButton scanId={scan.id} className="ml-3 px-3 py-1.5" /> : null}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
