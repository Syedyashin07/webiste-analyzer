import { greeting } from "../../lib/scan-status";

export function DashboardHeader() {
  return (
    <div className="min-w-0">
      <p className="text-sm text-slate-500">{greeting()}</p>
      <h1 className="mt-0.5 text-2xl font-semibold tracking-tight text-slate-900">Dashboard</h1>
      <p className="mt-1 max-w-xl text-sm text-slate-500">
        Monitor website quality, scan health, and issues from one place.
      </p>
    </div>
  );
}
