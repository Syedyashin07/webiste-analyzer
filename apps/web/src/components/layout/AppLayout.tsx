import { useEffect, useState } from "react";
import { Link, NavLink, Navigate, Outlet, useLocation } from "react-router-dom";
import { api, type AuthUser } from "../../api/client";
import { LogoLockup, LogoMark } from "../brand/Logo";
import { t } from "../../i18n/en";
import { clearAuth, readAuthUser } from "../../lib/auth";

const SIDEBAR_KEY = "qa-sidebar-collapsed";
const APP_VERSION = "1.0.0";

type NavIcon = "dashboard" | "sites" | "scans" | "bugs" | "reports" | "settings";

const links: Array<{ to: string; label: string; end: boolean; icon: NavIcon }> = [
  { to: "/dashboard", label: t.nav.dashboard, end: true, icon: "dashboard" },
  { to: "/sites", label: t.nav.sites, end: false, icon: "sites" },
  { to: "/scans", label: t.nav.scans, end: false, icon: "scans" },
  { to: "/bugs", label: t.nav.bugs, end: false, icon: "bugs" },
  { to: "/reports", label: t.nav.reports, end: true, icon: "reports" },
  { to: "/settings", label: t.nav.settings, end: true, icon: "settings" },
];

function Icon({ name }: { name: NavIcon }) {
  const common = "h-5 w-5 shrink-0";
  if (name === "dashboard") {
    return (
      <svg className={common} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
        <rect x="3" y="3" width="8" height="8" rx="1.5" />
        <rect x="13" y="3" width="8" height="5" rx="1.5" />
        <rect x="13" y="10" width="8" height="11" rx="1.5" />
        <rect x="3" y="13" width="8" height="8" rx="1.5" />
      </svg>
    );
  }
  if (name === "sites") {
    return (
      <svg className={common} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
        <path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7z" />
      </svg>
    );
  }
  if (name === "scans") {
    return (
      <svg className={common} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
        <circle cx="11" cy="11" r="6" />
        <path d="M20 20l-3.5-3.5" strokeLinecap="round" />
      </svg>
    );
  }
  if (name === "bugs") {
    return (
      <svg className={common} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
        <path d="M8 9a4 4 0 0 1 8 0v6a4 4 0 0 1-8 0V9z" />
        <path d="M4 10h4M16 10h4M4 15h4M16 15h4M12 5V3" strokeLinecap="round" />
      </svg>
    );
  }
  if (name === "reports") {
    return (
      <svg className={common} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
        <path d="M7 3h7l5 5v13a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1z" />
        <path d="M14 3v5h5M8 13h8M8 17h6" strokeLinecap="round" />
      </svg>
    );
  }
  return (
    <svg className={common} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
      <circle cx="12" cy="12" r="3" />
      <path d="M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6l1.4 1.4M17 17l1.4 1.4M18.4 5.6 17 7M7 17l-1.4 1.4" strokeLinecap="round" />
    </svg>
  );
}

function navClass(isActive: boolean, collapsed: boolean) {
  return [
    "flex items-center gap-3 rounded-xl text-sm font-medium transition-colors",
    collapsed ? "justify-center px-2 py-2.5" : "px-3 py-2.5",
    isActive ? "bg-brand-700 text-white" : "text-slate-300 hover:bg-white/10 hover:text-white",
  ].join(" ");
}

function currentSection(pathname: string) {
  const match = [...links].sort((a, b) => b.to.length - a.to.length).find((link) =>
    link.end ? pathname === link.to : pathname === link.to || pathname.startsWith(`${link.to}/`),
  );
  return match?.label ?? "Website Analyzer";
}

function Sidebar({
  collapsed,
  onToggle,
  onNavigate,
  showCollapse,
}: {
  collapsed: boolean;
  onToggle: () => void;
  onNavigate?: () => void;
  showCollapse: boolean;
}) {
  const workspace = links.filter((link) => link.to !== "/settings");
  const settings = links.filter((link) => link.to === "/settings");

  return (
    <div className="flex h-full flex-col">
      <div className={collapsed ? "flex justify-center px-2 py-5" : "flex items-center gap-3 px-4 py-5"}>
        {collapsed ? (
          <LogoMark className="h-9 w-9" onDark />
        ) : (
          <span>
            <LogoLockup />
            <span className="mt-1 block pl-11 text-[11px] text-slate-400">v{APP_VERSION}</span>
          </span>
        )}
      </div>
      <nav aria-label="Primary" className="flex-1 px-3 pb-4">
        <ul className="space-y-1">
          {workspace.map((link) => (
            <li key={link.to}>
              <NavLink
                to={link.to}
                end={link.end}
                title={link.label}
                onClick={() => onNavigate?.()}
                className={({ isActive }) => navClass(isActive, collapsed)}
              >
                <Icon name={link.icon} />
                {collapsed ? <span className="sr-only">{link.label}</span> : link.label}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>
      <div className="border-t border-white/10 px-3 py-3">
        <ul className="space-y-1">
          {settings.map((link) => (
            <li key={link.to}>
              <NavLink
                to={link.to}
                end={link.end}
                title={link.label}
                onClick={() => onNavigate?.()}
                className={({ isActive }) => navClass(isActive, collapsed)}
              >
                <Icon name={link.icon} />
                {collapsed ? <span className="sr-only">{link.label}</span> : link.label}
              </NavLink>
            </li>
          ))}
        </ul>
        {showCollapse ? (
          <button
            type="button"
            onClick={onToggle}
            title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            className="mt-2 hidden w-full items-center justify-center gap-2 rounded-xl px-3 py-2 text-xs font-medium text-slate-400 hover:bg-white/10 hover:text-white lg:flex"
          >
            <span aria-hidden>{collapsed ? "»" : "«"}</span>
            {collapsed ? null : "Collapse sidebar"}
          </button>
        ) : null}
      </div>
    </div>
  );
}

export function AppLayout() {
  const location = useLocation();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [user, setUser] = useState<AuthUser | null>(() => readAuthUser());
  const section = currentSection(location.pathname);

  useEffect(() => {
    const refresh = () => setUser(readAuthUser());
    refresh();
    window.addEventListener("qa-auth", refresh);
    return () => window.removeEventListener("qa-auth", refresh);
  }, []);

  useEffect(() => {
    setCollapsed(window.localStorage.getItem(SIDEBAR_KEY) === "1");
  }, []);

  function toggleCollapsed() {
    setCollapsed((current) => {
      const next = !current;
      window.localStorage.setItem(SIDEBAR_KEY, next ? "1" : "0");
      return next;
    });
  }

  if (!user) return <Navigate to="/login" replace />;

  return (
    <div className="min-h-screen bg-slate-900 lg:flex">
      <aside className={`sticky top-0 hidden h-screen shrink-0 text-slate-100 lg:block ${collapsed ? "w-[76px]" : "w-64"}`}>
        <Sidebar collapsed={collapsed} onToggle={toggleCollapsed} showCollapse />
      </aside>

      {mobileOpen ? (
        <div className="fixed inset-0 z-40 lg:hidden">
          <button
            type="button"
            className="absolute inset-0 bg-slate-900/60"
            aria-label="Close navigation"
            onClick={() => setMobileOpen(false)}
          />
          <aside id="mobile-nav" className="relative z-50 h-full w-72 bg-slate-900 text-slate-100 shadow-xl">
            <Sidebar collapsed={false} onToggle={toggleCollapsed} onNavigate={() => setMobileOpen(false)} showCollapse={false} />
          </aside>
        </div>
      ) : null}

      <div className="flex min-w-0 flex-1 flex-col lg:py-2 lg:pr-2">
        <div className="flex min-h-screen flex-1 flex-col bg-slate-50 lg:min-h-[calc(100vh-1rem)] lg:overflow-hidden lg:rounded-3xl">
          <header className="sticky top-0 z-30 flex items-center justify-between gap-3 border-b border-slate-200 bg-[#FFFBF5]/95 px-4 py-3 backdrop-blur sm:px-6">
            <div className="flex min-w-0 items-center gap-3">
              <button
                type="button"
                className="rounded-xl border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-800 lg:hidden"
                onClick={() => setMobileOpen(true)}
                aria-expanded={mobileOpen}
                aria-controls="mobile-nav"
              >
                Menu
              </button>
              <div className="min-w-0">
                <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">Website Analyzer</p>
                <p className="truncate text-sm font-semibold text-slate-900">{section}</p>
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-3">
              {user ? (
                <>
                  <span className="hidden text-sm font-medium text-slate-700 sm:inline">{user.name}</span>
                  <button
                    type="button"
                    className="text-sm font-medium text-brand-800 underline"
                    onClick={() => {
                      void api.logout().catch(() => undefined);
                      clearAuth();
                    }}
                  >
                    Log out
                  </button>
                </>
              ) : (
                <>
                  <Link to="/login" className="text-sm font-medium text-brand-800 underline">
                    Log in
                  </Link>
                  <Link to="/register" className="text-sm font-medium text-slate-800">
                    Register
                  </Link>
                </>
              )}
              <Link to="/scans/new" className="rounded-xl bg-brand-700 px-3 py-2 text-sm font-medium text-white hover:bg-brand-800">
                {t.actions.startScan}
              </Link>
            </div>
          </header>
          <main className="min-h-0 min-w-0 flex-1 overflow-y-auto px-5 py-6 sm:px-8 lg:px-10">
            <div className="w-full">
              <Outlet />
            </div>
          </main>
        </div>
      </div>
    </div>
  );
}
