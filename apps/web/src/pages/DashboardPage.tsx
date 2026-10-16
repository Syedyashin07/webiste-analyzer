import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { api, type ScanSummary } from "../api/client";
import { ActiveScanCard } from "../components/dashboard/ActiveScanCard";
import { CategoryHealth } from "../components/dashboard/CategoryHealth";
import { DashboardHeader } from "../components/dashboard/DashboardHeader";
import { DashboardSkeleton } from "../components/dashboard/DashboardSkeleton";
import { HealthScoreCard } from "../components/dashboard/HealthScoreCard";
import { IssueSummary } from "../components/dashboard/IssueSummary";
import { LatestScanCard } from "../components/dashboard/LatestScanCard";
import { MetricGrid } from "../components/dashboard/MetricGrid";
import { QuickActions } from "../components/dashboard/QuickActions";
import { CreatePptButton } from "../components/scans/CreatePptButton";
import { Button } from "../components/ui/Ui";
import { isActiveScanStatus } from "../lib/scan-status";

function severityCounts(source?: { counts?: Record<string, number>; bugs?: Array<{ severity: string }> }) {
  const counts = { CRITICAL: 0, HIGH: 0, MEDIUM: 0, LOW: 0 };
  if (source?.counts) {
    for (const key of Object.keys(counts) as Array<keyof typeof counts>) {
      counts[key] = source.counts[key] ?? 0;
    }
    return counts;
  }
  for (const bug of source?.bugs ?? []) {
    if (bug.severity in counts) counts[bug.severity as keyof typeof counts] += 1;
  }
  return counts;
}

export function DashboardPage() {
  const client = useQueryClient();
  const dashboard = useQuery({
    queryKey: ["dashboard"],
    queryFn: api.dashboard,
    refetchInterval: (query) => (isActiveScanStatus(query.state.data?.latest?.status ?? "") ? 2000 : false),
  });
  const scansQuery = useQuery({
    queryKey: ["scans"],
    queryFn: () => api.scans(),
    refetchInterval: (query) =>
      (query.state.data?.scans ?? []).some((scan) => isActiveScanStatus(scan.status)) ? 2000 : false,
  });

  const scans = scansQuery.data?.scans ?? [];
  const latest = dashboard.data?.latest ?? scans[0] ?? null;
  const active = scans.find((scan) => isActiveScanStatus(scan.status));
  const healthScan = scans.find((scan) => scan.status === "COMPLETED") ?? latest;
  const previous = scans.find((scan) => scan.id !== healthScan?.id && scan.overallScore != null);

  const healthDetail = useQuery({
    queryKey: ["scan", healthScan?.id],
    queryFn: () => api.scan(healthScan!.id),
    enabled: Boolean(healthScan?.id),
    refetchInterval: healthScan && isActiveScanStatus(healthScan.status) ? 2000 : false,
  });
  const activeDetail = useQuery({
    queryKey: ["scan", active?.id],
    queryFn: () => api.scan(active!.id),
    enabled: Boolean(active?.id),
    refetchInterval: 2000,
  });
  const healthBugs = useQuery({
    queryKey: ["scan-bugs", healthScan?.id],
    queryFn: () => api.scanBugs(healthScan!.id),
    enabled: Boolean(healthScan?.id) && healthScan?.id !== latest?.id,
  });

  const pause = useMutation({
    mutationFn: (id: string) => api.pauseScan(id),
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: ["scans"] });
      void client.invalidateQueries({ queryKey: ["dashboard"] });
    },
  });
  const resume = useMutation({
    mutationFn: (id: string) => api.resumeScan(id),
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: ["scans"] });
      void client.invalidateQueries({ queryKey: ["dashboard"] });
    },
  });
  const stop = useMutation({
    mutationFn: (id: string) => api.cancelScan(id),
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: ["scans"] });
      void client.invalidateQueries({ queryKey: ["dashboard"] });
    },
  });

  if ((dashboard.isLoading && !dashboard.data) || (scansQuery.isLoading && !scansQuery.data)) {
    return <DashboardSkeleton />;
  }

  if ((dashboard.isError && !dashboard.data) || (scansQuery.isError && !scansQuery.data && !dashboard.data)) {
    return (
      <div className="space-y-6">
        <DashboardHeader />
        <div role="alert" className="rounded-2xl border border-red-200 bg-red-50 px-5 py-8 text-center">
          <h2 className="text-lg font-semibold text-red-900">Unable to load dashboard data</h2>
          <p className="mt-2 text-sm text-red-800">We couldn&apos;t retrieve the latest QA information.</p>
          <Button
            className="mt-4"
            onClick={() => {
              void dashboard.refetch();
              void scansQuery.refetch();
            }}
          >
            Retry
          </Button>
        </div>
      </div>
    );
  }

  const totalScans = dashboard.data?.totalScans ?? scans.length;
  const health = (healthDetail.data?.scan ?? healthScan) as ScanSummary | null;
  const liveActive = (activeDetail.data?.scan ?? active) as ScanSummary | undefined;
  const inventory = healthDetail.data?.scan.inventory;
  const sameAsLatest = Boolean(healthScan && latest && healthScan.id === latest.id);
  const stats = sameAsLatest ? dashboard.data?.stats : undefined;
  const counts = sameAsLatest
    ? severityCounts({ counts: dashboard.data?.counts })
    : severityCounts({ bugs: healthBugs.data?.bugs });
  const healthSourceLabel = sameAsLatest ? "Website Analyzer health score" : "Latest completed scan";
  const issueSourceLabel = sameAsLatest ? "the latest scan" : "the latest completed scan";

  return (
    <div className="space-y-6">
      <DashboardHeader />

      {scans.some((scan) => scan.coverage === "SCREENSHOTS" && scan.status === "COMPLETED" && scan.pagesScanned > 0) ? (
        <div className="rounded-2xl border border-slate-200 bg-[#FFFBF5] p-5">
          <h2 className="text-lg font-semibold text-slate-900">Website flow PDF</h2>
          <p className="mt-1 text-sm text-slate-600">One file: the flow diagram, then a slide for each screenshot.</p>
          <ul className="mt-3 space-y-2">
            {scans
              .filter((scan) => scan.coverage === "SCREENSHOTS" && scan.status === "COMPLETED" && scan.pagesScanned > 0)
              .slice(0, 6)
              .map((scan) => (
                <li key={scan.id} className="flex flex-wrap items-center justify-between gap-2 text-sm">
                  <span className="font-medium text-slate-800">{scan.project?.name || scan.host}</span>
                  <a className="rounded-xl bg-brand-700 px-3 py-2 font-medium text-white hover:bg-brand-800" href={`/api/scans/${scan.id}/flow.pdf`}>
                    Download PDF
                  </a>
                </li>
              ))}
          </ul>
        </div>
      ) : null}

      {scans.some((scan) => scan.status === "COMPLETED") ? (
        <div className="rounded-2xl border border-slate-200 bg-[#FFFBF5] p-5">
          <h2 className="text-lg font-semibold text-slate-900">Website presentation</h2>
          <p className="mt-1 text-sm text-slate-600">
            Create a PowerPoint from a finished scan. Choose one of four cover designs. Three screens share each slide, and every captured screen is included. Your name stays at the bottom right.
          </p>
          <ul className="mt-3 space-y-2">
            {scans
              .filter((scan) => scan.status === "COMPLETED")
              .slice(0, 6)
              .map((scan) => (
                <li key={scan.id} className="flex flex-wrap items-center justify-between gap-2 text-sm">
                  <span className="font-medium text-slate-800">{scan.project?.name || scan.host}</span>
                  <CreatePptButton scanId={scan.id} className="px-3 py-2" />
                </li>
              ))}
          </ul>
        </div>
      ) : null}

      {totalScans === 0 || !latest ? (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-[#FFFBF5] px-6 py-14 text-center">
          <h2 className="text-lg font-semibold text-slate-900">No scans yet</h2>
          <p className="mx-auto mt-2 max-w-md text-sm text-slate-500">
            Run your first website QA scan to discover broken links, API failures, accessibility issues, SEO problems,
            visual issues, and more.
          </p>
          <Link
            to="/scans/new"
            className="mt-5 inline-flex items-center justify-center rounded-xl bg-brand-700 px-4 py-2 text-sm font-medium text-white hover:bg-brand-800"
          >
            Start Your First Scan
          </Link>
        </div>
      ) : (
        <>
          {liveActive ? (
            <ActiveScanCard
              scan={liveActive}
              pending={pause.isPending || resume.isPending || stop.isPending}
              onPause={() => pause.mutate(liveActive.id)}
              onResume={() => resume.mutate(liveActive.id)}
              onStop={() => stop.mutate(liveActive.id)}
            />
          ) : null}

          <HealthScoreCard
            score={health?.overallScore}
            website={health?.url}
            scanId={health?.id}
            previousScore={previous?.overallScore}
            sourceLabel={healthSourceLabel}
          />

          <MetricGrid
            items={[
              {
                icon: "pages",
                label: "Pages scanned",
                value: health?.pagesScanned ?? 0,
                hint: `${health?.pagesDiscovered ?? 0} discovered · ${health?.pagesFailed ?? 0} failed`,
              },
              {
                icon: "links",
                label: "Broken links",
                value: inventory?.brokenLinks ?? health?.brokenLinks ?? 0,
                hint: `${inventory?.linksFound ?? stats?.links ?? health?.linksTested ?? 0} links found`,
              },
              {
                icon: "images",
                label: "Broken images",
                value: inventory?.brokenImages ?? health?.brokenImages ?? 0,
                hint: `${inventory?.imagesFound ?? health?.imagesFound ?? 0} images found`,
              },
              {
                icon: "bugs",
                label: "Bugs",
                value: health?.issuesFound ?? 0,
                hint: `${health?.confirmedBugs ?? 0} confirmed`,
              },
              {
                icon: "api",
                label: "API failures",
                value: inventory?.apiFailures ?? health?.apiFailures ?? stats?.apiFailures ?? 0,
                hint: `${health?.consoleErrors ?? stats?.consoleErrors ?? 0} console errors`,
              },
              {
                icon: "forms",
                label: "Forms",
                value: inventory?.formsFound ?? health?.formsTested ?? stats?.forms ?? 0,
                hint: `${inventory?.elementsFound ?? stats?.elements ?? 0} elements`,
              },
            ]}
          />

          <LatestScanCard scans={scans.slice(0, 6)} />

          <div className="grid gap-4 xl:grid-cols-[1.4fr_1fr]">
            <CategoryHealth
              scores={{
                performance: health?.performanceScore ?? null,
                accessibility: health?.accessibilityScore ?? null,
                seo: health?.seoScore ?? null,
                security: health?.securityScore ?? null,
                functional: health?.functionalScore ?? null,
                visual: health?.visualScore ?? null,
                technical: health?.technicalScore ?? null,
              }}
            />
            <div className="space-y-4">
              <IssueSummary counts={counts} sourceLabel={issueSourceLabel} />
              <QuickActions />
            </div>
          </div>

          <p className="text-sm text-slate-500">
            {totalScans} {totalScans === 1 ? "scan" : "scans"} in this project.
          </p>
        </>
      )}
    </div>
  );
}
