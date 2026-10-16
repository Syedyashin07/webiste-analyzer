import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { api } from "../api/client";
import { EmptyState, ErrorState, Spinner } from "../components/ui/Ui";
import { t } from "../i18n/en";
import { groupBySite } from "../lib/sites";

type ReportRow = {
  id: string;
  format: string;
  fileName: string;
  createdAt: string;
  scan: { url: string; overallScore: number | null; project?: { id: string; name: string } };
};

function ReportTable({ rows }: { rows: ReportRow[] }) {
  return (
    <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-[#FFFBF5]">
      <table className="min-w-full text-left text-sm">
        <thead className="bg-slate-50">
          <tr>
            <th className="px-3 py-2">Website</th>
            <th className="px-3 py-2">Format</th>
            <th className="px-3 py-2">Health</th>
            <th className="px-3 py-2">Created</th>
            <th className="px-3 py-2">Download</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((report) => (
            <tr key={report.id} className="border-t border-slate-100">
              <td className="px-3 py-2">{report.scan.url}</td>
              <td className="px-3 py-2">{report.fileName.includes("bug-details") ? "Bug details PDF" : report.format}</td>
              <td className="px-3 py-2">{report.scan.overallScore ?? "—"}</td>
              <td className="px-3 py-2">{new Date(report.createdAt).toLocaleString()}</td>
              <td className="px-3 py-2">
                <a className="text-brand-800 underline" href={`/api/reports/${report.id}/download`}>
                  {report.fileName}
                </a>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function ReportsPage({ projectId, embedded = false }: { projectId?: string; embedded?: boolean }) {
  const reports = useQuery({ queryKey: ["reports", projectId ?? "all"], queryFn: () => api.reports(projectId) });
  if (reports.isLoading) return <Spinner label="Loading reports" />;
  if (reports.isError) return <ErrorState message={(reports.error as Error).message} />;
  const rows = reports.data?.reports ?? [];

  return (
    <div className="space-y-4">
      {embedded ? null : <h1 className="text-2xl font-semibold">Reports</h1>}
      {rows.length === 0 ? (
        <EmptyState title={t.empty.reports} />
      ) : projectId ? (
        <ReportTable rows={rows} />
      ) : (
        groupBySite(rows, (report) => report.scan.project).map((group) => (
          <section key={group.id} className="space-y-2">
            <h2 className="text-lg font-semibold">
              <Link className="text-brand-800" to={`/sites/${group.id}?tab=reports`}>
                {group.name}
              </Link>
            </h2>
            <ReportTable rows={group.items} />
          </section>
        ))
      )}
    </div>
  );
}
