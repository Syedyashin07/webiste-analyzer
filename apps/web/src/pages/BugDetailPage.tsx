import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useParams } from "react-router-dom";
import { api } from "../api/client";
import { Badge, Button, Card, ErrorState, Spinner, severityTone, statusTone } from "../components/ui/Ui";
import { t } from "../i18n/en";

export function BugDetailPage() {
  const { id } = useParams();
  const client = useQueryClient();
  const query = useQuery({ queryKey: ["bug", id], queryFn: () => api.bug(id!), enabled: Boolean(id) });
  const update = useMutation({
    mutationFn: (status: string) => api.updateBug(id!, { status }),
    onSuccess: () => void client.invalidateQueries({ queryKey: ["bug", id] }),
  });
  const replayApi = useMutation({
    mutationFn: () => api.replayBugApi(id!),
  });

  if (query.isLoading) return <Spinner label="Loading bug" />;
  if (query.isError) return <ErrorState message={(query.error as Error).message} />;
  const bug = query.data?.bug;
  if (!bug) return <ErrorState message="Bug not found" />;

  const screenshots = (bug.evidence ?? []).filter((item) => item.screenshot);
  const videos = (bug.evidence ?? []).filter((item) => item.video);
  const traces = (bug.evidence ?? []).filter((item) => item.trace);

  return (
    <div className="space-y-4">
      <Link
        to={bug.scan?.project ? `/sites/${bug.scan.project.id}?tab=bugs` : "/bugs"}
        className="text-sm text-brand-800 underline"
      >
        {bug.scan?.project ? bug.scan.project.name : "Back to bugs"}
      </Link>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-sm text-slate-500">{bug.bugNumber}</p>
          <h1 className="text-2xl font-semibold">{bug.title}</h1>
        </div>
        <label className="text-sm">
          Status
          <select
            className="ml-2 rounded-md border border-slate-300 px-2 py-1"
            value={bug.status}
            onChange={(event) => update.mutate(event.target.value)}
          >
            {["OPEN", "CONFIRMED", "FALSE_POSITIVE", "RESOLVED", "IGNORED", "UNVERIFIED"].map((status) => (
              <option key={status}>{status}</option>
            ))}
          </select>
        </label>
      </div>
      <div className="flex flex-wrap gap-2">
        <Badge tone={severityTone(bug.severity)}>{bug.severity}</Badge>
        <Badge>{bug.priority}</Badge>
        <Badge tone={statusTone(bug.status)}>{bug.status}</Badge>
        <Badge tone="teal">{bug.category}</Badge>
      </div>
      {bug.category === "NETWORK" ? (
        <Card>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="font-semibold">Failed API</h2>
              <p className="mt-1 break-all text-sm text-red-800">{bug.title}</p>
              <p className="break-all text-xs text-slate-500">{bug.url}</p>
            </div>
            <Button variant="secondary" onClick={() => replayApi.mutate()} disabled={replayApi.isPending}>
              {replayApi.isPending ? "Replaying…" : t.actions.fastReplay}
            </Button>
          </div>
          {replayApi.data ? (
            <p className={`mt-2 text-sm ${replayApi.data.results[0]?.replayOk ? "text-emerald-700" : "text-red-700"}`}>
              {replayApi.data.results[0]?.replayOk
                ? `Recovered in ${replayApi.data.results[0]?.durationMs}ms`
                : `${replayApi.data.results[0]?.replayError ?? "Still failing"} (${replayApi.data.results[0]?.durationMs}ms)`}
            </p>
          ) : null}
          {replayApi.isError ? <p className="mt-2 text-sm text-red-700">{(replayApi.error as Error).message}</p> : null}
        </Card>
      ) : null}
      <Card>
        <p className="text-sm text-slate-500">URL</p>
        <p className="break-all">{bug.url}</p>
      </Card>
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <h2 className="font-semibold">Expected</h2>
          <p className="mt-1 text-sm">{bug.expected ?? "—"}</p>
        </Card>
        <Card>
          <h2 className="font-semibold">Actual</h2>
          <p className="mt-1 text-sm">{bug.actual ?? "—"}</p>
        </Card>
      </div>
      <Card>
        <h2 className="font-semibold">Steps to reproduce</h2>
        <pre className="mt-2 whitespace-pre-wrap text-sm">{bug.stepsToReproduce ?? "—"}</pre>
      </Card>
      <Card>
        <h2 className="font-semibold">Technical details</h2>
        <p className="text-sm">Browser: {bug.browser ?? "chromium"} · Viewport: {bug.viewport ?? "—"} · Occurrences: {bug.occurrences}</p>
        <p className="mt-2 text-sm">Root cause: {bug.rootCause ?? "Likely cause not determined from available evidence."}</p>
      </Card>
      <Card>
        <h2 className="font-semibold">AI analysis</h2>
        <p className="mt-1 text-sm">{bug.aiAnalysis ?? "Deterministic rule engine finding. AI analysis was not required or not configured."}</p>
        <p className="mt-2 text-sm">Recommended action: {bug.recommendedAction ?? "—"}</p>
      </Card>
      <Card>
        <h2 className="font-semibold">Affected pages</h2>
        <ul className="mt-2 list-disc pl-5 text-sm">
          {(bug.affectedUrls ?? []).map((url) => (
            <li key={url}>{url}</li>
          ))}
        </ul>
      </Card>
      <Card>
        <h2 className="mb-3 font-semibold">Evidence</h2>
        {screenshots.length === 0 && videos.length === 0 && traces.length === 0 ? (
          <p className="text-sm text-slate-500">No evidence files are attached yet.</p>
        ) : null}
        <div className="grid gap-4 md:grid-cols-2">
          {screenshots.map((item) => (
            <figure key={item.id}>
              <img src={`/api/evidence/${item.screenshot?.id}`} alt={`${item.screenshot?.kind ?? "screenshot"} evidence`} className="rounded border border-slate-200" />
              <figcaption className="mt-1 text-xs text-slate-500">{item.screenshot?.kind} screenshot</figcaption>
            </figure>
          ))}
        </div>
        {videos.map((item) => (
          <video key={item.id} controls className="mt-4 w-full rounded border border-slate-200" src={`/api/evidence/${item.video?.id}`} />
        ))}
        {traces.map((item) => (
          <p key={item.id} className="mt-3 text-sm">
            <a className="text-brand-800 underline" href={`/api/evidence/${item.trace?.id}`}>
              Download Playwright trace
            </a>
          </p>
        ))}
      </Card>
    </div>
  );
}
