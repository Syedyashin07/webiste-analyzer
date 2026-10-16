import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { api, type BugSummary } from "../api/client";
import { Badge, EmptyState, ErrorState, Spinner, severityTone, statusTone } from "../components/ui/Ui";
import { t } from "../i18n/en";
import { groupBySite } from "../lib/sites";

function BugTable({ rows }: { rows: BugSummary[] }) {
  return (
    <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-[#FFFBF5]">
      <table className="min-w-full text-left text-sm">
        <thead className="bg-slate-50">
          <tr>
            <th className="px-3 py-2">Evidence</th>
            <th className="px-3 py-2">Bug</th>
            <th className="px-3 py-2">Severity</th>
            <th className="px-3 py-2">Status</th>
            <th className="px-3 py-2">Category</th>
            <th className="px-3 py-2">URL</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((bug) => {
            const shot = bug.evidence?.find((item) => item.screenshot)?.screenshot;
            return (
              <tr key={bug.id} className="border-t border-slate-100">
                <td className="px-3 py-2">
                  {shot ? (
                    <img src={`/api/evidence/${shot.id}`} alt="" className="h-12 w-20 rounded border border-slate-200 object-cover" />
                  ) : (
                    <span className="text-xs text-slate-400">—</span>
                  )}
                </td>
                <td className="px-3 py-2">
                  <Link className="font-medium text-brand-800" to={`/bugs/${bug.id}`}>
                    {bug.bugNumber} — {bug.title}
                  </Link>
                </td>
                <td className="px-3 py-2">
                  <Badge tone={severityTone(bug.severity)}>{bug.severity}</Badge>
                </td>
                <td className="px-3 py-2">
                  <Badge tone={statusTone(bug.status)}>{bug.status}</Badge>
                </td>
                <td className="px-3 py-2">{bug.category}</td>
                <td className="px-3 py-2">{bug.url}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export function BugsPage({ projectId, embedded = false }: { projectId?: string; embedded?: boolean }) {
  const [searchParams] = useSearchParams();
  const [filters, setFilters] = useState({
    q: searchParams.get("q") ?? "",
    severity: searchParams.get("severity") ?? "",
    status: searchParams.get("status") ?? "",
    category: searchParams.get("category") ?? "",
  });
  const params = useMemo(() => {
    const search = new URLSearchParams();
    if (filters.q) search.set("q", filters.q);
    if (filters.severity) search.set("severity", filters.severity);
    if (filters.status) search.set("status", filters.status);
    if (filters.category) search.set("category", filters.category);
    if (projectId) search.set("projectId", projectId);
    return search;
  }, [filters, projectId]);
  const bugs = useQuery({ queryKey: ["bugs", params.toString()], queryFn: () => api.bugs(params) });

  if (bugs.isLoading) return <Spinner label="Loading bugs" />;
  if (bugs.isError) return <ErrorState message={(bugs.error as Error).message} />;
  const rows = bugs.data?.bugs ?? [];

  return (
    <div className="space-y-4">
      {embedded ? null : <h1 className="text-2xl font-semibold">Bugs</h1>}
      <div className="grid gap-3 md:grid-cols-4">
        <input
          className="rounded-md border border-slate-300 px-3 py-2 text-sm"
          placeholder="Search title, URL, error, fingerprint"
          value={filters.q}
          onChange={(event) => setFilters({ ...filters, q: event.target.value })}
        />
        <select className="rounded-md border border-slate-300 px-3 py-2 text-sm" value={filters.severity} onChange={(event) => setFilters({ ...filters, severity: event.target.value })}>
          <option value="">All severities</option>
          {["CRITICAL", "HIGH", "MEDIUM", "LOW"].map((item) => (
            <option key={item}>{item}</option>
          ))}
        </select>
        <select className="rounded-md border border-slate-300 px-3 py-2 text-sm" value={filters.status} onChange={(event) => setFilters({ ...filters, status: event.target.value })}>
          <option value="">All statuses</option>
          {["OPEN", "CONFIRMED", "FALSE_POSITIVE", "RESOLVED", "IGNORED", "UNVERIFIED"].map((item) => (
            <option key={item}>{item}</option>
          ))}
        </select>
        <select className="rounded-md border border-slate-300 px-3 py-2 text-sm" value={filters.category} onChange={(event) => setFilters({ ...filters, category: event.target.value })}>
          <option value="">All categories</option>
          {["FUNCTIONAL", "VISUAL", "ACCESSIBILITY", "SEO", "PERFORMANCE", "SECURITY", "TECHNICAL", "BROKEN_LINK", "BROKEN_IMAGE", "JAVASCRIPT", "NETWORK"].map((item) => (
            <option key={item}>{item}</option>
          ))}
        </select>
      </div>
      {rows.length === 0 ? (
        <EmptyState title={t.empty.bugs} />
      ) : projectId ? (
        <BugTable rows={rows} />
      ) : (
        groupBySite(rows, (bug) => bug.scan?.project).map((group) => (
          <section key={group.id} className="space-y-2">
            <h2 className="text-lg font-semibold">
              <Link className="text-brand-800" to={`/sites/${group.id}?tab=bugs`}>
                {group.name}
              </Link>
            </h2>
            <BugTable rows={group.items} />
          </section>
        ))
      )}
    </div>
  );
}
