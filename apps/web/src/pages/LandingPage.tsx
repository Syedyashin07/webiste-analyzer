import { Link } from "react-router-dom";
import { LogoLockup } from "../components/brand/Logo";

const checks = [
  {
    title: "Landing page",
    body: "Open one live URL and score that page: links, images, forms, and APIs.",
  },
  {
    title: "Full website",
    body: "Crawl the reachable pages and report pages, links, images, forms, and the health score.",
  },
  {
    title: "Screenshot every page",
    body: "Capture one image per page, in order, then download the flow as a PDF.",
  },
];

const services = [
  "Screenshots",
  "SEO score",
  "API failures",
  "Broken links",
  "Images",
  "Forms",
  "Accessibility",
  "Performance",
  "Security",
  "Health score",
  "Page flow PDF",
  "Bugs and reports",
];

const keeps = [
  { title: "Health score", body: "A 0–100 score from what the live visit actually found." },
  { title: "Bugs and reports", body: "Each site keeps its own scans, bugs, and reports under the name you give it." },
  { title: "Page flow", body: "Screenshot scans line up as login, dashboard, and the pages after that." },
];

export function LandingPage() {
  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <header className="flex items-center justify-between gap-4 px-6 py-5 sm:px-10 lg:px-14">
        <LogoLockup tone="onLight" />
        <nav className="flex items-center gap-4 text-base font-medium">
          <Link to="/login" className="text-brand-800 underline">
            Log in
          </Link>
          <Link to="/register" className="rounded-full bg-brand-700 px-5 py-2.5 text-white hover:bg-brand-800">
            Register
          </Link>
        </nav>
      </header>

      <main>
        <section className="grid items-center gap-10 px-6 pb-16 pt-6 sm:px-10 lg:min-h-[calc(100vh-5.5rem)] lg:grid-cols-2 lg:px-14 lg:pb-20">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.22em] text-brand-800">Website Analyzer</p>
            <h1 className="mt-4 text-5xl font-semibold tracking-tight sm:text-6xl xl:text-7xl">
              Check a live website, then keep the result.
            </h1>
            <p className="mt-6 max-w-2xl text-lg text-slate-600 sm:text-xl">
              Open a site you are allowed to test. The scanner visits the real pages, scores their health, and stores the scans, bugs, and reports under a name you choose.
            </p>
            <div className="mt-10 flex flex-wrap gap-4">
              <Link to="/scans/new" className="rounded-full bg-brand-700 px-8 py-4 text-base font-semibold text-white hover:bg-brand-800">
                Start a scan
              </Link>
              <Link to="/login" className="rounded-full border border-slate-300 bg-[#FFFBF5] px-8 py-4 text-base font-semibold hover:border-brand-700">
                Log in
              </Link>
            </div>
          </div>
          <div className="rounded-[32px] bg-slate-900 p-8 text-white shadow-xl sm:p-10">
            <p className="text-sm font-semibold uppercase tracking-[0.22em] text-brand-300">What we check</p>
            <ul className="mt-6 grid grid-cols-2 gap-3">
              {services.map((item) => (
                <li key={item} className="rounded-2xl bg-white/5 px-4 py-4 text-base text-slate-100">
                  {item}
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section className="bg-[#FFFBF5] py-20">
          <div className="px-6 sm:px-10 lg:px-14">
            <h2 className="text-4xl font-semibold tracking-tight">Three ways to check</h2>
            <div className="mt-10 grid gap-6 md:grid-cols-3">
              {checks.map((item) => (
                <article key={item.title} className="rounded-3xl border border-slate-200 p-8">
                  <h3 className="text-2xl font-semibold">{item.title}</h3>
                  <p className="mt-3 text-base leading-7 text-slate-600">{item.body}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="px-6 py-20 sm:px-10 lg:px-14">
          <h2 className="text-4xl font-semibold tracking-tight">What stays with the site</h2>
          <div className="mt-10 grid gap-8 md:grid-cols-3">
            {keeps.map((item) => (
              <div key={item.title}>
                <h3 className="text-xl font-semibold text-brand-800">{item.title}</h3>
                <p className="mt-3 text-base leading-7 text-slate-600">{item.body}</p>
              </div>
            ))}
          </div>
        </section>
      </main>

      <footer className="border-t border-slate-200 px-5 py-6 text-center text-sm text-slate-500">Website Analyzer</footer>
    </div>
  );
}
