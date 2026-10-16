import { Card } from "../ui/Ui";

export interface MetricItem {
  label: string;
  value: number | string;
  hint?: string;
}

function MetricIcon({ name }: { name: string }) {
  const common = "h-4 w-4 text-brand-700";
  if (name === "pages") {
    return (
      <svg className={common} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
        <path d="M7 3h7l5 5v13H7z" />
        <path d="M14 3v6h6" />
      </svg>
    );
  }
  if (name === "links") {
    return (
      <svg className={common} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
        <path d="M10 13a5 5 0 0 0 7 0l2-2a5 5 0 0 0-7-7l-1 1" />
        <path d="M14 11a5 5 0 0 0-7 0l-2 2a5 5 0 0 0 7 7l1-1" />
      </svg>
    );
  }
  if (name === "images") {
    return (
      <svg className={common} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
        <rect x="3" y="5" width="18" height="14" rx="2" />
        <circle cx="9" cy="10" r="1.5" />
        <path d="m21 16-5-5-9 8" />
      </svg>
    );
  }
  if (name === "bugs") {
    return (
      <svg className={common} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
        <circle cx="12" cy="12" r="4" />
        <path d="M12 2v3M12 19v3M2 12h3M19 12h3M5 5l2 2M17 17l2 2M19 5l-2 2M7 17l-2 2" />
      </svg>
    );
  }
  if (name === "api") {
    return (
      <svg className={common} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
        <path d="M4 8h16M4 16h16M8 4v4M16 16v4" />
      </svg>
    );
  }
  return (
    <svg className={common} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <rect x="4" y="6" width="16" height="12" rx="2" />
      <path d="M8 10h8M8 14h5" />
    </svg>
  );
}

export function MetricGrid({ items }: { items: Array<MetricItem & { icon: string }> }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
      {items.map((item) => (
        <Card key={item.label} className="p-4">
          <div className="flex items-start justify-between gap-3">
            <p className="text-sm font-medium text-slate-500">{item.label}</p>
            <span className="rounded-md bg-brand-50 p-1.5" aria-hidden="true">
              <MetricIcon name={item.icon} />
            </span>
          </div>
          <p className="mt-2 text-3xl font-semibold tracking-tight text-slate-900">{item.value}</p>
          {item.hint ? <p className="mt-1 text-xs text-slate-500">{item.hint}</p> : null}
        </Card>
      ))}
    </div>
  );
}
