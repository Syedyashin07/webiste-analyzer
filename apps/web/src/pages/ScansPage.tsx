import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { api, type ScanSummary } from "../api/client";
import { Badge, EmptyState, ErrorState, Spinner, statusTone } from "../components/ui/Ui";
import { t } from "../i18n/en";
import { groupBySite } from "../lib/sites";

function ScanTable({ rows }: { rows: ScanSummary[] }) {
  return (
    <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-[#FFFBF5]">
      <table className="min-w-full text-left text-sm">
        <thead className="bg-slate-50 text-slate-600">
          <tr>
            <th className="px-3 py-2">Website</th>
            <th className="px-3 py-2">Coverage</th>
            <th className="px-3 py-2">Status</th>
            <th className="px-3 py-2">Health</th>
            <th className="px-3 py-2">Pages</th>
            <th className="px-3 py-2">Issues</th>
            <th className="px-3 py-2">Created</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((scan) => (
            <tr key={scan.id} className="border-t border-slate-100">
              <td className="px-3 py-2">
                <Link className="font-medium text-brand-800" to={`/scans/${scan.id}`}>
                  {scan.url}
                </Link>
              </td>
              <td className="px-3 py-2">
                {scan.coverageLabel ??
                  (scan.coverage === "LANDING"
                    ? "Landing page only"
                    : scan.coverage === "SCREENSHOTS"
                      ? "Screenshot every page"
                      : scan.coverage === "INSIDE"
                        ? "Inside every page"
                        : "Full website")}
              </td>
              <td className="px-3 py-2">
                <Badge tone={statusTone(scan.status)}>{scan.status}</Badge>
              </td>
              <td className="px-3 py-2">{scan.overallScore ?? "—"}</td>
              <td className="px-3 py-2">{scan.pagesScanned}</td>
              <td className="px-3 py-2">{scan.issuesFound}</td>
              <td className="px-3 py-2">{new Date(scan.createdAt).toLocaleString()}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function ScansPage({ projectId, embedded = false }: { projectId?: string; embedded?: boolean }) {
  const scans = useQuery({ queryKey: ["scans", projectId ?? "all"], queryFn: () => api.scans(projectId) });
  if (scans.isLoading) return <Spinner label="Loading scans" />;
  if (scans.isError) return <ErrorState message={(scans.error as Error).message} />;
  const rows = scans.data?.scans ?? [];

  const groups = projectId ? [] : groupBySite(rows, (scan) => scan.project);

  return (
    <div className="space-y-4">
      {embedded ? null : (
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-semibold">Scans</h1>
          <div className="flex gap-3">
            <Link to="/scans/compare" className="text-sm font-medium text-brand-800 underline">
              {t.actions.compare}
            </Link>
            <Link to="/scans/new" className="rounded-xl bg-brand-700 px-3 py-2 text-sm font-medium text-white">
              {t.actions.startScan}
            </Link>
          </div>
        </div>
      )}
      {rows.length === 0 ? (
        <EmptyState title={t.empty.scans} />
      ) : projectId ? (
        <ScanTable rows={rows} />
      ) : (
        groups.map((group) => (
          <section key={group.id} className="space-y-2">
            <h2 className="text-lg font-semibold">
              <Link className="text-brand-800" to={`/sites/${group.id}`}>
                {group.name}
              </Link>
            </h2>
            <ScanTable rows={group.items} />
          </section>
        ))
      )}
    </div>
  );
}
