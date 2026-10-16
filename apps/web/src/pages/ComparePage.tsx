import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { api } from "../api/client";
import { Button, Card, ErrorState } from "../components/ui/Ui";

export function ComparePage() {
  const scans = useQuery({ queryKey: ["scans"], queryFn: () => api.scans() });
  const [scanAId, setScanAId] = useState("");
  const [scanBId, setScanBId] = useState("");
  const compare = useQuery({
    queryKey: ["compare", scanAId, scanBId],
    queryFn: () => api.compare(scanAId, scanBId),
    enabled: Boolean(scanAId && scanBId),
  });

  const options = scans.data?.scans ?? [];

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Scan comparison</h1>
      <Card>
        <div className="grid gap-3 md:grid-cols-2">
          <label className="text-sm">
            Previous scan
            <select className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2" value={scanAId} onChange={(event) => setScanAId(event.target.value)}>
              <option value="">Select scan A</option>
              {options.map((scan) => (
                <option key={scan.id} value={scan.id}>
                  {scan.url} · {new Date(scan.createdAt).toLocaleString()}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm">
            Current scan
            <select className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2" value={scanBId} onChange={(event) => setScanBId(event.target.value)}>
              <option value="">Select scan B</option>
              {options.map((scan) => (
                <option key={scan.id} value={scan.id}>
                  {scan.url} · {new Date(scan.createdAt).toLocaleString()}
                </option>
              ))}
            </select>
          </label>
        </div>
        <Button className="mt-4" type="button" onClick={() => void compare.refetch()} disabled={!scanAId || !scanBId}>
          Compare
        </Button>
      </Card>
      {compare.isError ? <ErrorState message={(compare.error as Error).message} /> : null}
      {compare.data ? (
        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <p className="text-sm text-slate-500">Previous</p>
            <p className="text-3xl font-semibold">{compare.data.scanA.overallScore ?? "—"}</p>
          </Card>
          <Card>
            <p className="text-sm text-slate-500">Current</p>
            <p className="text-3xl font-semibold">{compare.data.scanB.overallScore ?? "—"}</p>
          </Card>
          <Card>
            <p className="text-sm text-slate-500">Improvement</p>
            <p className="text-3xl font-semibold">
              {compare.data.healthDelta > 0 ? "+" : ""}
              {compare.data.healthDelta}
            </p>
            <p className="text-sm text-slate-500">Performance {compare.data.performanceDelta} · Pages {compare.data.pageCountDelta}</p>
          </Card>
          <Card>
            <h2 className="font-semibold">New bugs</h2>
            <ul className="mt-2 text-sm">{compare.data.newBugs.map((bug) => <li key={bug.id}>{bug.title}</li>)}</ul>
          </Card>
          <Card>
            <h2 className="font-semibold">Fixed bugs</h2>
            <ul className="mt-2 text-sm">{compare.data.fixedBugs.map((bug) => <li key={bug.id}>{bug.title}</li>)}</ul>
          </Card>
          <Card>
            <h2 className="font-semibold">Regressions</h2>
            <ul className="mt-2 text-sm">{compare.data.regressions.map((bug) => <li key={bug.id}>{bug.title}</li>)}</ul>
          </Card>
        </div>
      ) : null}
    </div>
  );
}
