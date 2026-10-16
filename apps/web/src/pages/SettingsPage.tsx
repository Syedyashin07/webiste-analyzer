import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api, type Settings } from "../api/client";
import { Button, Card, ErrorState, Modal, Spinner } from "../components/ui/Ui";

const fallback: Settings = {
  defaultMaxPages: 100,
  defaultMaxDepth: 5,
  timeoutMs: 30000,
  browser: "chromium",
  viewport: "DESKTOP",
  screenshotEnabled: true,
  videoEnabled: true,
  aiEnabled: true,
  retentionDays: 30,
  concurrency: 3,
  crawlDelayMs: 250,
  maxScanDurationMs: 1800000,
  maxScreenshotBytes: 10485760,
  respectRobotsTxt: true,
};

export function SettingsPage() {
  const client = useQueryClient();
  const navigate = useNavigate();
  const query = useQuery({ queryKey: ["settings"], queryFn: api.settings });
  const [form, setForm] = useState<Settings>(fallback);
  const [confirmReset, setConfirmReset] = useState(false);
  const save = useMutation({
    mutationFn: () => api.saveSettings(form),
    onSuccess: () => void client.invalidateQueries({ queryKey: ["settings"] }),
  });
  const resetData = useMutation({
    mutationFn: () => api.resetAllData(),
    onSuccess: async () => {
      setConfirmReset(false);
      await client.invalidateQueries();
      navigate("/dashboard");
    },
  });

  useEffect(() => {
    if (query.data?.settings && "defaultMaxPages" in query.data.settings) {
      setForm({ ...fallback, ...query.data.settings });
    }
  }, [query.data]);

  if (query.isLoading) return <Spinner label="Loading settings" />;
  if (query.isError) return <ErrorState message={(query.error as Error).message} />;

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <h1 className="text-2xl font-semibold">Settings</h1>
      <Card>
        <form
          className="grid gap-4 sm:grid-cols-2"
          onSubmit={(event) => {
            event.preventDefault();
            save.mutate();
          }}
        >
          <NumberField label="Default max pages" value={form.defaultMaxPages} onChange={(defaultMaxPages) => setForm({ ...form, defaultMaxPages })} />
          <NumberField label="Default depth" value={form.defaultMaxDepth} onChange={(defaultMaxDepth) => setForm({ ...form, defaultMaxDepth })} />
          <p className="sm:col-span-2 text-sm text-slate-600">
            Screenshot every page uses these two values to walk the whole site. Raise them here if you want more pages.
          </p>
          <NumberField label="Timeout (ms)" value={form.timeoutMs} onChange={(timeoutMs) => setForm({ ...form, timeoutMs })} />
          <label className="text-sm font-medium">
            Viewport
            <select className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2" value={form.viewport} onChange={(event) => setForm({ ...form, viewport: event.target.value as Settings["viewport"] })}>
              <option>DESKTOP</option>
              <option>TABLET</option>
              <option>MOBILE</option>
              <option>ALL</option>
            </select>
          </label>
          <NumberField label="Concurrency" value={form.concurrency} onChange={(concurrency) => setForm({ ...form, concurrency })} />
          <NumberField label="Crawl delay (ms)" value={form.crawlDelayMs} onChange={(crawlDelayMs) => setForm({ ...form, crawlDelayMs })} />
          <NumberField label="Max scan duration (ms)" value={form.maxScanDurationMs} onChange={(maxScanDurationMs) => setForm({ ...form, maxScanDurationMs })} />
          <NumberField label="Retention (days)" value={form.retentionDays} onChange={(retentionDays) => setForm({ ...form, retentionDays })} />
          <label className="text-sm font-medium">
            Browser
            <select className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2" value={form.browser} onChange={(event) => setForm({ ...form, browser: event.target.value as Settings["browser"] })}>
              <option value="chromium">Chromium</option>
              <option value="firefox">Firefox</option>
              <option value="webkit">WebKit</option>
            </select>
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={form.screenshotEnabled} onChange={(event) => setForm({ ...form, screenshotEnabled: event.target.checked })} />
            Screenshots
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={form.videoEnabled} onChange={(event) => setForm({ ...form, videoEnabled: event.target.checked })} />
            Videos
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={form.aiEnabled} onChange={(event) => setForm({ ...form, aiEnabled: event.target.checked })} />
            AI analysis
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={form.respectRobotsTxt} onChange={(event) => setForm({ ...form, respectRobotsTxt: event.target.checked })} />
            Respect robots.txt
          </label>
          <div className="sm:col-span-2">
            <Button type="submit" disabled={save.isPending}>
              {save.isPending ? "Saving…" : "Save settings"}
            </Button>
            {save.isSuccess ? <span className="ml-3 text-sm text-emerald-700">Saved</span> : null}
            {save.isError ? <span className="ml-3 text-sm text-red-700">{(save.error as Error).message}</span> : null}
          </div>
        </form>
      </Card>
      <Card>
        <h2 className="text-lg font-semibold text-red-800">Delete all data</h2>
        <p className="mt-2 text-sm text-slate-600">
          This removes every scan, bug, report, screenshot, video, and queued job. Settings and the local user stay.
          The project starts empty so you can run a new scan.
        </p>
        {resetData.isError ? <p className="mt-2 text-sm text-red-700">{(resetData.error as Error).message}</p> : null}
        <div className="mt-4">
          <Button type="button" variant="danger" onClick={() => setConfirmReset(true)}>
            Delete all data
          </Button>
        </div>
      </Card>
      <Modal open={confirmReset} title="Delete all data?" onClose={() => setConfirmReset(false)}>
        <p className="text-sm text-slate-600">
          This cannot be undone. All scans, bugs, reports, and stored files will be deleted. The app will be empty.
        </p>
        <div className="mt-4 flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={() => setConfirmReset(false)}>
            Keep data
          </Button>
          <Button type="button" variant="danger" disabled={resetData.isPending} onClick={() => resetData.mutate()}>
            {resetData.isPending ? "Deleting…" : "Delete all data"}
          </Button>
        </div>
      </Modal>
    </div>
  );
}

function NumberField({ label, value, onChange }: { label: string; value: number; onChange: (value: number) => void }) {
  return (
    <label className="text-sm font-medium">
      {label}
      <input
        type="number"
        className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2"
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
      />
    </label>
  );
}
