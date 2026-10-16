import { useQuery } from "@tanstack/react-query";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { api } from "../api/client";
import { ErrorState, Spinner } from "../components/ui/Ui";
import { BugsPage } from "./BugsPage";
import { ReportsPage } from "./ReportsPage";
import { ScansPage } from "./ScansPage";

const tabs = [
  { id: "scans", label: "Scans" },
  { id: "reports", label: "Reports" },
  { id: "bugs", label: "Bugs" },
] as const;

type TabId = (typeof tabs)[number]["id"];

function tabFromQuery(value: string | null): TabId {
  if (value === "reports" || value === "bugs") return value;
  return "scans";
}

export function SitePage() {
  const { id } = useParams();
  const [params, setParams] = useSearchParams();
  const tab = tabFromQuery(params.get("tab"));
  const site = useQuery({ queryKey: ["site", id], queryFn: () => api.site(id!), enabled: Boolean(id) });

  if (site.isLoading) return <Spinner label="Loading site" />;
  if (site.isError) return <ErrorState message={(site.error as Error).message} />;
  const data = site.data?.site;
  if (!data) return <ErrorState message="Site not found" />;

  return (
    <div className="space-y-4">
      <Link to="/sites" className="text-sm text-brand-800 underline">
        All sites
      </Link>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">{data.name}</h1>
          <p className="mt-1 text-sm text-slate-600">{data.url ?? "Results for this site are stored here."}</p>
        </div>
        <Link
          to={`/scans/new?name=${encodeURIComponent(data.name)}`}
          className="rounded-xl bg-brand-700 px-3 py-2 text-sm font-medium text-white"
        >
          Start a scan
        </Link>
      </div>
      <div className="flex gap-2" role="tablist" aria-label={`${data.name} results`}>
        {tabs.map((item) => {
          const count = item.id === "scans" ? data.scanCount : item.id === "reports" ? data.reportCount : data.bugCount;
          const selected = tab === item.id;
          return (
            <button
              key={item.id}
              type="button"
              role="tab"
              aria-selected={selected}
              className={`rounded-xl px-3 py-2 text-sm font-medium ${selected ? "bg-brand-700 text-white" : "bg-[#FFFBF5] text-slate-700 ring-1 ring-slate-200"}`}
              onClick={() => setParams(item.id === "scans" ? {} : { tab: item.id })}
            >
              {item.label} ({count})
            </button>
          );
        })}
      </div>
      {tab === "scans" ? <ScansPage projectId={data.id} embedded /> : null}
      {tab === "reports" ? <ReportsPage projectId={data.id} embedded /> : null}
      {tab === "bugs" ? <BugsPage projectId={data.id} embedded /> : null}
    </div>
  );
}
