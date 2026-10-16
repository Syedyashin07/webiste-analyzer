import { Link } from "react-router-dom";
import { t } from "../../i18n/en";
import { Card } from "../ui/Ui";

const actions = [
  { to: "/scans/new", label: t.actions.startNewScan },
  { to: "/scans", label: "View scans" },
  { to: "/bugs", label: "View bugs" },
  { to: "/reports", label: "View reports" },
];

export function QuickActions() {
  return (
    <Card className="p-5">
      <h2 className="text-base font-semibold text-slate-900">Quick actions</h2>
      <div className="mt-4 grid gap-2 sm:grid-cols-2">
        {actions.map((action) => (
          <Link
            key={action.to}
            to={action.to}
            className="rounded-md border border-slate-200 px-3 py-2 text-center text-sm font-medium text-slate-800 hover:border-brand-700 hover:text-brand-800"
          >
            {action.label}
          </Link>
        ))}
      </div>
    </Card>
  );
}
