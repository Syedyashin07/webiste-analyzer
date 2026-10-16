import type { ButtonHTMLAttributes, ReactNode } from "react";

export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <section className={`rounded-2xl border border-slate-200 bg-[#FFFBF5] p-5 shadow-sm ${className}`}>{children}</section>;
}

export function Button({
  children,
  variant = "primary",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "secondary" | "danger" }) {
  const styles = {
    primary: "bg-brand-700 text-white hover:bg-brand-800",
    secondary: "bg-[#FFFBF5] text-slate-800 border border-slate-300 hover:bg-slate-50",
    danger: "bg-red-700 text-white hover:bg-red-800",
  };
  return (
    <button
      {...props}
      className={`inline-flex items-center justify-center rounded-xl px-4 py-2 text-sm font-medium disabled:opacity-50 ${styles[variant]} ${props.className ?? ""}`}
    >
      {children}
    </button>
  );
}

export function Badge({ children, tone = "slate" }: { children: ReactNode; tone?: "slate" | "red" | "amber" | "green" | "blue" | "teal" }) {
  const map = {
    slate: "bg-slate-100 text-slate-700",
    red: "bg-red-100 text-red-800",
    amber: "bg-amber-100 text-amber-800",
    green: "bg-emerald-100 text-emerald-800",
    blue: "bg-sky-100 text-sky-800",
    teal: "bg-brand-100 text-brand-900",
  };
  return <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${map[tone]}`}>{children}</span>;
}

export function Spinner({ label = "Loading" }: { label?: string }) {
  return (
    <div role="status" className="flex items-center gap-2 text-sm text-slate-600">
      <span className="h-4 w-4 animate-spin rounded-full border-2 border-slate-300 border-t-brand-700" />
      {label}
    </div>
  );
}

export function EmptyState({ title, body }: { title: string; body?: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-slate-300 bg-[#FFFBF5] px-6 py-12 text-center">
      <p className="font-medium text-slate-800">{title}</p>
      {body ? <p className="mt-1 text-sm text-slate-500">{body}</p> : null}
    </div>
  );
}

export function ErrorState({ message }: { message: string }) {
  return (
    <div role="alert" className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
      {message}
    </div>
  );
}

export function Modal({
  open,
  title,
  children,
  onClose,
}: {
  open: boolean;
  title: string;
  children: ReactNode;
  onClose: () => void;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4" role="dialog" aria-modal="true" aria-labelledby="modal-title">
      <div className="max-h-[90vh] w-full max-w-lg overflow-auto rounded-2xl bg-[#FFFBF5] p-5 shadow-lg">
        <div className="mb-3 flex items-start justify-between gap-4">
          <h2 id="modal-title" className="text-lg font-semibold">
            {title}
          </h2>
          <button type="button" onClick={onClose} className="text-slate-500 hover:text-slate-800" aria-label="Close">
            ×
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function severityTone(severity: string) {
  if (severity === "CRITICAL") return "red" as const;
  if (severity === "HIGH") return "amber" as const;
  if (severity === "MEDIUM") return "blue" as const;
  return "slate" as const;
}

export function statusTone(status: string) {
  if (status === "COMPLETED" || status === "CONFIRMED" || status === "RESOLVED") return "green" as const;
  if (status === "FAILED") return "red" as const;
  if (status === "QUEUED") return "amber" as const;
  if (status === "PAUSED") return "amber" as const;
  if (status === "CANCELLED" || status === "FALSE_POSITIVE" || status === "IGNORED") return "slate" as const;
  return "teal" as const;
}
