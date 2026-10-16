import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { api } from "../api/client";
import { EmptyState, ErrorState, Spinner } from "../components/ui/Ui";
import { t } from "../i18n/en";

export function SitesPage() {
  const sites = useQuery({ queryKey: ["sites"], queryFn: api.sites });
  if (sites.isLoading) return <Spinner label="Loading sites" />;
  if (sites.isError) return <ErrorState message={(sites.error as Error).message} />;
  const rows = sites.data?.sites ?? [];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Sites</h1>
          <p className="mt-1 text-sm text-slate-600">Each name holds that website’s scans, reports, and bugs.</p>
        </div>
        <Link to="/scans/new" className="rounded-xl bg-brand-700 px-3 py-2 text-sm font-medium text-white">
          {t.actions.startScan}
        </Link>
      </div>
      {rows.length === 0 ? (
        <EmptyState title={t.empty.sites} />
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {rows.map((site) => (
            <Link key={site.id} to={`/sites/${site.id}`} className="rounded-2xl border border-slate-200 bg-[#FFFBF5] p-4 hover:border-brand-700">
              <h2 className="text-lg font-semibold text-slate-900">{site.name}</h2>
              <p className="mt-1 truncate text-sm text-slate-500">{site.url ?? "No website yet"}</p>
              <p className="mt-3 text-sm text-slate-700">
                {site.scanCount} scans · {site.reportCount} reports · {site.bugCount} bugs
              </p>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
