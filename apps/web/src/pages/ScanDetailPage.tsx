import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useState } from "react";
import { api, type ReplayApisResult } from "../api/client";
import { hasPageScreenshots, ScreenshotFlow } from "../components/scans/ScreenshotFlow";
import { WorkflowMap } from "../components/scans/WorkflowMap";
import { CreatePptButton } from "../components/scans/CreatePptButton";
import { ScoreCard } from "../components/scores/ScoreCard";
import { Badge, Button, Card, ErrorState, Modal, Spinner, statusTone } from "../components/ui/Ui";
import { useScanEvents } from "../hooks/useScanEvents";
import { t } from "../i18n/en";
import { isActiveScanStatus } from "../lib/scan-status";

function reportDownloadLabel(format: string, fileName: string): string {
  if (fileName.includes("bug-details")) return "Bug details PDF — location, steps, how to check";
  if (format === "PDF") return "Summary PDF";
  return format;
}

function eventMark(type: string, message: string): string {
  if (type.includes("failed") || message.toLowerCase().includes("failed")) return "✗";
  if (type.includes("issue") || type.includes("paused") || message.toLowerCase().includes("error")) return "⚠";
  return "✓";
}

function ProgressBar({ label, current, total }: { label: string; current: number; total: number }) {
  const pct = total > 0 ? Math.min(100, Math.round((current / total) * 100)) : 0;
  return (
    <div>
      <div className="mb-1 flex justify-between text-sm">
        <span>{label}</span>
        <span className="text-slate-500">
          {current} / {total || current}
        </span>
      </div>
      <div className="h-2 rounded-full bg-slate-200">
        <div className="h-2 rounded-full bg-brand-700" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

export function ScanDetailPage() {
  const { id } = useParams();
  const client = useQueryClient();
  const navigate = useNavigate();
  const [replay, setReplay] = useState<ReplayApisResult | null>(null);
  const [confirm, setConfirm] = useState<"cancel" | "delete" | null>(null);
  const scan = useQuery({
    queryKey: ["scan", id],
    queryFn: () => api.scan(id!),
    enabled: Boolean(id),
    refetchInterval: (query) => (isActiveScanStatus(query.state.data?.scan.status ?? "") ? 2000 : false),
  });
  const pages = useQuery({ queryKey: ["pages", id], queryFn: () => api.pages(id!), enabled: Boolean(id), refetchInterval: 3000 });
  const bugs = useQuery({ queryKey: ["scan-bugs", id], queryFn: () => api.scanBugs(id!), enabled: Boolean(id), refetchInterval: 3000 });
  const { events, connected } = useScanEvents(id);
  const workflow = useQuery({
    queryKey: ["workflow", id],
    queryFn: () => api.workflow(id!),
    enabled: Boolean(id) && scan.data?.scan.coverage === "WORKFLOW",
    refetchInterval: () => (isActiveScanStatus(scan.data?.scan.status ?? "") ? 2000 : false),
  });

  const cancel = useMutation({
    mutationFn: () => api.cancelScan(id!),
    onSuccess: () => {
      setConfirm(null);
      void client.invalidateQueries({ queryKey: ["scan", id] });
    },
  });
  const pause = useMutation({
    mutationFn: () => api.pauseScan(id!),
    onSuccess: () => void client.invalidateQueries({ queryKey: ["scan", id] }),
  });
  const resume = useMutation({
    mutationFn: () => api.resumeScan(id!),
    onSuccess: () => void client.invalidateQueries({ queryKey: ["scan", id] }),
  });
  const restart = useMutation({
    mutationFn: () => api.restartScan(id!),
    onSuccess: (data) => navigate(`/scans/${data.scanId}`),
  });
  const replayApis = useMutation({
    mutationFn: (ids?: string[]) => api.replayScanApis(id!, ids),
    onSuccess: (data) => setReplay(data),
  });
  const remove = useMutation({
    mutationFn: () => api.deleteScan(id!),
    onSuccess: () => {
      const projectId = scan.data?.scan.project?.id;
      window.location.href = projectId ? `/sites/${projectId}` : "/scans";
    },
  });

  if (scan.isLoading) return <Spinner label="Loading scan" />;
  if (scan.isError) return <ErrorState message={(scan.error as Error).message} />;
  const data = scan.data?.scan;
  if (!data) return <ErrorState message="Scan not found" />;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          {data.project ? (
            <Link to={`/sites/${data.project.id}`} className="text-sm text-brand-800 underline">
              {data.project.name}
            </Link>
          ) : null}
          <h1 className="text-2xl font-semibold">{data.url}</h1>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <Badge tone={statusTone(data.status)}>{data.status}</Badge>
            <Badge tone={data.coverage === "LANDING" ? "blue" : "teal"}>
              {data.coverageLabel ??
                (data.coverage === "LANDING"
                  ? "Landing page only"
                  : data.coverage === "SCREENSHOTS"
                    ? "Screenshot every page"
                    : data.coverage === "INSIDE"
                      ? "Inside every page"
                      : data.coverage === "WORKFLOW"
                        ? "Autonomous workflow"
                        : "Full website (end to end)")}
            </Badge>
            {connected ? <span className="text-xs text-emerald-700">Live</span> : <span className="text-xs text-slate-500">Reconnecting…</span>}
          </div>
          {data.status === "QUEUED" ? (
            <p className="mt-2 max-w-xl text-sm text-amber-800">
              {data.currentAction || "Waiting for the worker. Another scan may be running first."}
            </p>
          ) : null}
        </div>
        <div className="flex flex-wrap gap-2">
          {data.status === "PAUSED" ? (
            <Button variant="secondary" onClick={() => resume.mutate()} disabled={resume.isPending}>
              {t.actions.resume}
            </Button>
          ) : isActiveScanStatus(data.status) && data.status !== "QUEUED" ? (
            <Button variant="secondary" onClick={() => pause.mutate()} disabled={pause.isPending}>
              {t.actions.pause}
            </Button>
          ) : null}
          {isActiveScanStatus(data.status) ? (
            <Button variant="secondary" onClick={() => setConfirm("cancel")}>
              {t.actions.cancel}
            </Button>
          ) : (
            <Button type="button" variant="secondary" onClick={() => restart.mutate()} disabled={restart.isPending}>
              {restart.isPending ? "Starting…" : t.actions.restart}
            </Button>
          )}
          {data.status === "COMPLETED" ? <CreatePptButton scanId={data.id} /> : null}
          <Button type="button" variant="danger" onClick={() => setConfirm("delete")}>
            {t.actions.delete}
          </Button>
        </div>
      </div>
      {restart.isError ? <ErrorState message={(restart.error as Error).message} /> : null}
      {remove.isError ? <ErrorState message={(remove.error as Error).message} /> : null}
      {cancel.isError ? <ErrorState message={(cancel.error as Error).message} /> : null}
      {data.coverage === "WORKFLOW" ? (
        <Card>
          <h2 className="text-lg font-semibold">Website flow</h2>
          <p className="mt-1 text-sm text-slate-600">
            For someone new to this site: the picture shows the pages in order, the fields on each page, and the dummy data that goes in those fields.
            Filled {workflow.data?.counts.completed ?? 0} · Blocked {workflow.data?.counts.blocked ?? 0} · Failed {workflow.data?.counts.failed ?? 0}
          </p>
          <div className="mt-4">
            <WorkflowMap nodes={workflow.data?.graph.nodes ?? []} edges={workflow.data?.graph.edges ?? []} />
          </div>
          {workflow.data?.registry.length ? (
            <div className="mt-4">
              <h3 className="text-sm font-medium">Shared synthetic data</h3>
              <ul className="mt-2 space-y-1 text-sm text-slate-700">
                {workflow.data.registry.map((entry) => (
                  <li key={`${entry.entityKey}:${entry.fieldKey}`}>
                    {entry.entityKey}.{entry.fieldKey}: {entry.value} ({entry.source})
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
          {workflow.data?.steps.length ? (
            <ul className="mt-4 max-h-48 space-y-1 overflow-auto text-sm">
              {workflow.data.steps.map((step) => (
                <li key={step.id}>
                  {step.status} {step.actionType} — {step.reason || step.observed || step.pageUrl}
                </li>
              ))}
            </ul>
          ) : null}
        </Card>
      ) : null}

      <Card>
        <p className="text-sm text-slate-500">{data.coverageLabel ?? "Website Analyzer"}</p>
        <p className="mt-2 text-sm">
          Current URL: <span className="break-all font-medium">{data.currentUrl || data.url}</span>
        </p>
        <p className="text-sm">Current action: {data.currentAction || data.status}</p>
        <p className="mt-2 text-sm">
          Pages {data.pagesScanned} / {data.pagesDiscovered || data.pagesScanned} · Links {data.inventory?.linksFound ?? data.linksTested ?? 0} ·
          Images {data.inventory?.imagesFound ?? data.imagesFound ?? 0} · Forms {data.inventory?.formsFound ?? data.formsTested ?? 0} ·
          Bugs {data.confirmedBugs}
        </p>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-md border border-slate-200 p-3">
            <p className="text-xs text-slate-500">Pages discovered</p>
            <p className="text-xl font-semibold">{data.inventory?.pagesDiscovered ?? data.pagesDiscovered}</p>
          </div>
          <div className="rounded-md border border-slate-200 p-3">
            <p className="text-xs text-slate-500">Pages scanned / failed</p>
            <p className="text-xl font-semibold">
              {data.inventory?.pagesScanned ?? data.pagesScanned} / {data.inventory?.pagesFailed ?? data.pagesFailed}
            </p>
          </div>
          <div className="rounded-md border border-slate-200 p-3">
            <p className="text-xs text-slate-500">Links found / broken</p>
            <p className="text-xl font-semibold">
              {data.inventory?.linksFound ?? data.linksTested ?? 0} / {data.inventory?.brokenLinks ?? data.brokenLinks ?? 0}
            </p>
          </div>
          <div className="rounded-md border border-slate-200 p-3">
            <p className="text-xs text-slate-500">Images found / broken</p>
            <p className="text-xl font-semibold">
              {data.inventory?.imagesFound ?? data.imagesFound ?? 0} / {data.inventory?.brokenImages ?? data.brokenImages ?? 0}
            </p>
          </div>
          <div className="rounded-md border border-slate-200 p-3">
            <p className="text-xs text-slate-500">Forms</p>
            <p className="text-xl font-semibold">{data.inventory?.formsFound ?? data.formsTested ?? 0}</p>
          </div>
          <div className="rounded-md border border-slate-200 p-3">
            <p className="text-xs text-slate-500">Elements</p>
            <p className="text-xl font-semibold">{data.inventory?.elementsFound ?? data.elementsDiscovered ?? 0}</p>
          </div>
          <div className="rounded-md border border-slate-200 p-3">
            <p className="text-xs text-slate-500">API failures</p>
            <p className="text-xl font-semibold">{data.inventory?.apiFailures ?? data.apiFailures ?? 0}</p>
          </div>
          <div className="rounded-md border border-slate-200 p-3">
            <p className="text-xs text-slate-500">Confirmed bugs</p>
            <p className="text-xl font-semibold">{data.confirmedBugs}</p>
          </div>
        </div>
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          <ProgressBar label="Pages" current={data.pagesScanned} total={data.pagesDiscovered || data.pagesScanned} />
          <ProgressBar label="Forms" current={data.formsTested ?? 0} total={Math.max(data.formsTested ?? 0, 1)} />
          <ProgressBar label="Links" current={data.linksTested ?? 0} total={Math.max(data.linksTested ?? 0, 1)} />
          <ProgressBar label="Elements" current={data.elementsDiscovered ?? 0} total={Math.max(data.elementsDiscovered ?? 0, 1)} />
        </div>
        <div className="mt-3 h-2 rounded-full bg-slate-200">
          <div className="h-2 rounded-full bg-brand-700" style={{ width: `${data.progress}%` }} />
        </div>
        <p className="mt-1 text-sm text-slate-600">Overall progress: {data.progress}%</p>
        {data.errorMessage ? <p className="mt-2 text-sm text-red-700">{data.errorMessage}</p> : null}
        <p className="mt-2 text-xs text-slate-500">
          Mode {data.configuration?.testMode ?? "STANDARD"} · Browser {data.configuration?.browserEngine ?? "chromium"}
        </p>
      </Card>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Card>
          <p className="text-sm text-slate-500">API failures</p>
          <p className="text-2xl font-semibold">{data.apiFailures ?? 0}</p>
          {(data.failedApis ?? []).slice(0, 3).map((item) => (
            <p key={item.id} className="mt-1 truncate text-xs text-red-700" title={item.requestUrl}>
              {item.api}
              {item.statusCode ? ` → ${item.statusCode}` : item.error ? ` → ${item.error}` : ""}
            </p>
          ))}
        </Card>
        <Card>
          <p className="text-sm text-slate-500">Console errors</p>
          <p className="text-2xl font-semibold">{data.consoleErrors ?? 0}</p>
        </Card>
        <Card>
          <p className="text-sm text-slate-500">Accessibility</p>
          <p className="text-2xl font-semibold">{data.accessibilityIssues ?? 0}</p>
        </Card>
        <Card>
          <p className="text-sm text-slate-500">Visual issues</p>
          <p className="text-2xl font-semibold">{data.visualIssues ?? 0}</p>
        </Card>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <ScoreCard label={t.scores.overall} value={data.overallScore} />
        <ScoreCard label={t.scores.functional} value={data.functionalScore} />
        <ScoreCard label={t.scores.visual} value={data.visualScore} />
        <ScoreCard label={t.scores.security} value={data.securityScore} />
        <ScoreCard label={t.scores.performance} value={data.performanceScore} />
        <ScoreCard label={t.scores.accessibility} value={data.accessibilityScore} />
        <ScoreCard label={t.scores.technical} value={data.technicalScore} />
        <ScoreCard label={t.scores.seo} value={data.seoScore} />
      </div>

      <Card>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-semibold">Failed APIs</h2>
          <Button
            variant="secondary"
            onClick={() => replayApis.mutate(undefined)}
            disabled={replayApis.isPending || (data.failedApis ?? []).length === 0}
          >
            {replayApis.isPending ? "Replaying…" : t.actions.fastReplay}
          </Button>
        </div>
        <p className="mb-3 text-sm text-slate-500">
          Shows the exact API that failed. Fast replay re-calls those APIs over HTTP without crawling the site again.
          Logged-in APIs may return 401 because the session is not replayed.
        </p>
        {replay ? (
          <p className="mb-3 text-sm">
            Replayed {replay.replayed}: <span className="text-emerald-700">{replay.recovered} recovered</span> ·{" "}
            <span className="text-red-700">{replay.stillFailing} still failing</span>
          </p>
        ) : null}
        {replayApis.isError ? <p className="mb-3 text-sm text-red-700">{(replayApis.error as Error).message}</p> : null}
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead>
              <tr className="text-slate-500">
                <th className="py-2">API</th>
                <th>Original</th>
                <th>Seen on</th>
                <th>Replay</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {(data.failedApis ?? []).map((item) => {
                const replayed = replay?.results.find((row) => row.id === item.id);
                return (
                  <tr key={item.id} className="border-t border-slate-100 align-top">
                    <td className="py-2">
                      <div className="font-medium text-red-800">{item.api}</div>
                      <div className="break-all text-xs text-slate-500">{item.requestUrl}</div>
                    </td>
                    <td>{item.statusCode ?? item.error ?? "failed"}</td>
                    <td className="max-w-xs break-all text-xs text-slate-600">{item.pageUrl || item.pages[0] || "—"}</td>
                    <td>
                      {replayed ? (
                        <span className={replayed.replayOk ? "text-emerald-700" : "text-red-700"}>
                          {replayed.replayOk ? "OK" : replayed.replayError ?? `HTTP ${replayed.replayStatus}`} · {replayed.durationMs}ms
                        </span>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td>
                      <Button variant="secondary" onClick={() => replayApis.mutate([item.id])} disabled={replayApis.isPending}>
                        {t.actions.replay}
                      </Button>
                    </td>
                  </tr>
                );
              })}
              {(data.failedApis ?? []).length === 0 ? (
                <tr>
                  <td className="py-3 text-slate-500" colSpan={5}>
                    No API failures captured yet.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <h2 className="mb-2 font-semibold">Live events</h2>
          <ul className="max-h-64 space-y-1 overflow-auto text-sm">
            {events.slice(-40).reverse().map((event, index) => (
              <li key={event.id ?? `${event.type}-${index}`}>
                <span className="mr-1">{eventMark(event.type, event.message)}</span>
                <span className="font-medium">{event.type}</span> — {event.message}
              </li>
            ))}
          </ul>
        </Card>
        <Card>
          <h2 className="mb-2 font-semibold">Reports</h2>
          <ul className="space-y-2 text-sm">
            {(data.reports ?? []).map((report) => (
              <li key={report.id}>
                <a className="text-brand-800 underline" href={`/api/reports/${report.id}/download`}>
                  {reportDownloadLabel(report.format, report.fileName)}
                </a>
                <div className="text-xs text-slate-500">{report.fileName}</div>
              </li>
            ))}
            {(data.reports ?? []).length === 0 ? <li className="text-slate-500">Reports appear when the scan completes.</li> : null}
          </ul>
        </Card>
      </div>

      <Card>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="font-semibold">Page screenshots</h2>
            <p className="text-sm text-slate-600">
              {data.coverage === "SCREENSHOTS"
                ? "Flowchart of every listed page: login screenshot, then dashboard screenshot, then each next screen."
                : "Screenshots in visit order, named like login screenshot then dashboard screenshot."}
            </p>
          </div>
          {hasPageScreenshots(pages.data?.pages ?? []) ? (
            <a className="text-sm text-brand-800 underline" href={`/api/scans/${id}/screenshots.zip`}>
              {data.coverage === "SCREENSHOTS" ? "Download zip (login, dashboard, and the rest)" : "Download all screenshots"}
            </a>
          ) : null}
        </div>
        <ScreenshotFlow scanId={id!} pages={pages.data?.pages ?? []} />
      </Card>

      <Card>
        <h2 className="mb-3 font-semibold">Site tree</h2>
        <ul className="max-h-72 space-y-1 overflow-auto font-mono text-xs">
          {(pages.data?.pages ?? [])
            .slice()
            .sort((a, b) => (a.depth ?? 0) - (b.depth ?? 0) || a.url.localeCompare(b.url))
            .map((page) => (
              <li key={page.id} style={{ paddingLeft: `${Math.min(page.depth ?? 0, 8) * 12}px` }}>
                <Link className="text-brand-800" to={`/scans/${id}/pages/${page.id}`}>
                  {page.title || page.url}
                </Link>
                <span className="ml-2 text-slate-500">{page.status}</span>
              </li>
            ))}
        </ul>
      </Card>

      <Card>
        <h2 className="mb-3 font-semibold">Pages</h2>
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead>
              <tr className="text-slate-500">
                <th className="py-2">URL</th>
                <th>HTTPS / SSL</th>
                <th>Status</th>
                <th>HTTP</th>
                <th>Title</th>
              </tr>
            </thead>
            <tbody>
              {(pages.data?.pages ?? []).map((page) => (
                <tr key={page.id} className="border-t border-slate-100">
                  <td className="py-2">
                    <Link className="text-brand-800" to={`/scans/${id}/pages/${page.id}`}>
                      {page.url}
                    </Link>
                  </td>
                  <td>
                    {page.httpsOk === true ? (
                      <span className="text-emerald-700">HTTPS OK</span>
                    ) : page.httpsOk === false ? (
                      <span className="text-red-700">HTTPS/SSL fail</span>
                    ) : page.url.startsWith("https://") ? (
                      <span className="text-slate-500">HTTPS</span>
                    ) : (
                      <span className="text-red-700">HTTP</span>
                    )}
                  </td>
                  <td>{page.status}</td>
                  <td>{page.httpStatus ?? "—"}</td>
                  <td>{page.title ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <Card>
        <h2 className="mb-3 font-semibold">Issues</h2>
        <ul className="divide-y divide-slate-100">
          {(bugs.data?.bugs ?? []).map((bug) => {
            const shot = bug.evidence?.find((item) => item.screenshot)?.screenshot;
            return (
              <li key={bug.id} className="flex items-start gap-3 py-2">
                {shot ? (
                  <img
                    src={`/api/evidence/${shot.id}`}
                    alt=""
                    className="h-16 w-24 rounded border border-slate-200 object-cover"
                  />
                ) : (
                  <span className="flex h-16 w-24 items-center justify-center rounded border border-dashed border-slate-200 text-xs text-slate-400">
                    No shot
                  </span>
                )}
                <div>
                  <Link to={`/bugs/${bug.id}`} className="font-medium text-brand-800">
                    {bug.bugNumber} — {bug.title}
                  </Link>
                  <p className="text-sm text-slate-500">
                    {bug.severity} · {bug.category} · {bug.status}
                  </p>
                </div>
              </li>
            );
          })}
        </ul>
      </Card>

      <Modal open={confirm !== null} title={confirm === "delete" ? "Delete scan?" : "Cancel scan?"} onClose={() => setConfirm(null)}>
        <p className="text-sm text-slate-600">
          {confirm === "delete"
            ? "This removes database records and stored screenshots, videos, traces, and reports."
            : "The worker will stop Playwright work and keep evidence already collected."}
        </p>
        <div className="mt-4 flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={() => setConfirm(null)}>
            Keep
          </Button>
          <Button
            type="button"
            variant="danger"
            disabled={remove.isPending || cancel.isPending}
            onClick={() => (confirm === "delete" ? remove.mutate() : cancel.mutate())}
          >
            {remove.isPending || cancel.isPending ? "Working…" : t.actions.confirm}
          </Button>
        </div>
      </Modal>
    </div>
  );
}
