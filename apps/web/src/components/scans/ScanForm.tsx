import { useState, type FormEvent } from "react";
import { t } from "../../i18n/en";
import { suggestSiteName } from "../../lib/sites";
import { Button } from "../ui/Ui";

export interface ScanFormValue {
  name: string;
  url: string;
  coverage: "LANDING" | "FULL" | "SCREENSHOTS" | "INSIDE" | "WORKFLOW";
  viewport: "DESKTOP" | "TABLET" | "MOBILE" | "ALL";
  captureScreenshots: boolean;
  recordVideos: boolean;
  aiAnalysis: boolean;
  runFunctionalTests: boolean;
  runAccessibility: boolean;
  runPerformance: boolean;
  runSeo: boolean;
  runSecurity: boolean;
  loginUsername: string;
  loginPassword: string;
  loginUrl: string;
  testMode: "SAFE" | "STANDARD" | "AGGRESSIVE" | "DEEP";
  browserEngine: "chromium" | "firefox" | "webkit";
  authorizedTest: boolean;
  dataSeed: string;
}

const defaults: ScanFormValue = {
  name: "",
  url: "",
  coverage: "FULL",
  viewport: "DESKTOP",
  captureScreenshots: true,
  recordVideos: true,
  aiAnalysis: true,
  runFunctionalTests: true,
  runAccessibility: true,
  runPerformance: true,
  runSeo: true,
  runSecurity: true,
  loginUsername: "",
  loginPassword: "",
  loginUrl: "",
  testMode: "STANDARD",
  browserEngine: "chromium",
  authorizedTest: false,
  dataSeed: "",
};

function Toggle({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <label className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 px-4 py-3 text-base">
      <span>{label}</span>
      <input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} />
    </label>
  );
}

export function ScanForm({
  onSubmit,
  pending,
  error,
  initialName = "",
}: {
  onSubmit: (value: Omit<ScanFormValue, "dataSeed"> & { dataSeed?: number }) => void;
  pending?: boolean;
  error?: string;
  initialName?: string;
}) {
  const [value, setValue] = useState({ ...defaults, name: initialName });
  const [nameTouched, setNameTouched] = useState(Boolean(initialName));
  const [coverageError, setCoverageError] = useState("");
  const [nameError, setNameError] = useState("");
  const isScreenshots = value.coverage === "SCREENSHOTS";
  const isInside = value.coverage === "INSIDE";
  const isWorkflow = value.coverage === "WORKFLOW";

  function handle(event: FormEvent) {
    event.preventDefault();
    if (value.coverage !== "LANDING" && value.coverage !== "FULL" && value.coverage !== "SCREENSHOTS" && value.coverage !== "INSIDE" && value.coverage !== "WORKFLOW") {
      setCoverageError(t.scan.chooseCoverage);
      return;
    }
    if (value.coverage === "WORKFLOW" && !value.authorizedTest) {
      setCoverageError(t.scan.authorizedTestRequired);
      return;
    }
    if (!value.name.trim()) {
      setNameError(t.scan.siteNameRequired);
      return;
    }
    setCoverageError("");
    setNameError("");
    onSubmit({
      ...value,
      name: value.name.trim(),
      coverage: value.coverage,
      viewport: isScreenshots ? "DESKTOP" : value.viewport,
      captureScreenshots: isScreenshots || isInside || isWorkflow ? true : value.coverage === "FULL" ? false : value.captureScreenshots,
      runFunctionalTests: isInside || isWorkflow ? true : value.runFunctionalTests,
      testMode: isInside ? "DEEP" : value.testMode,
      authorizedTest: isWorkflow ? value.authorizedTest : false,
      dataSeed: value.dataSeed.trim() ? Number(value.dataSeed) : undefined,
    });
  }

  const submitLabel =
    value.coverage === "LANDING"
      ? t.scan.runLanding
      : value.coverage === "FULL"
        ? t.scan.runFull
        : value.coverage === "SCREENSHOTS"
          ? t.scan.runScreenshots
          : value.coverage === "INSIDE"
            ? t.scan.runInside
            : value.coverage === "WORKFLOW"
              ? t.scan.runWorkflow
              : t.scan.chooseCoverage;

  return (
    <form onSubmit={handle} className="space-y-6">
      <p className="text-sm text-slate-600">{t.scan.publicOnly}</p>
      <label className="block text-sm font-medium">
        {t.scan.siteName}
        <input
          required
          value={value.name}
          placeholder={t.scan.siteNameHint}
          onChange={(event) => {
            setNameTouched(true);
            setNameError("");
            setValue({ ...value, name: event.target.value });
          }}
          className="mt-2 w-full rounded-xl border border-slate-300 px-4 py-3 text-base"
        />
        <span className="mt-1 block text-sm font-normal text-slate-600">{t.scan.siteNameHelp}</span>
        {nameError ? <span className="mt-1 block text-sm font-normal text-rose-700">{nameError}</span> : null}
      </label>
      <label className="block text-sm font-medium">
        {t.scan.url}
        <input
          required
          type="url"
          value={value.url}
          placeholder={t.scan.urlHint}
          onChange={(event) => {
            const url = event.target.value;
            const suggestion = suggestSiteName(url);
            setValue({
              ...value,
              url,
              name: nameTouched ? value.name : suggestion || value.name,
            });
          }}
          className="mt-2 w-full rounded-xl border border-slate-300 px-4 py-3 text-base"
        />
      </label>

      <fieldset className="space-y-2">
        <legend className="text-sm font-medium">{t.scan.coverage}</legend>
        <p className="text-sm text-slate-600">{t.scan.coverageHint}</p>
        <div className="grid gap-3 lg:grid-cols-3">
          <label
            className={`cursor-pointer rounded-2xl border p-5 text-base ${
              value.coverage === "WORKFLOW" ? "border-brand-700 bg-brand-50" : "border-slate-200"
            }`}
          >
            <input
              type="radio"
              name="coverage"
              className="mr-2"
              checked={value.coverage === "WORKFLOW"}
              onChange={() => {
                setCoverageError("");
                setValue({ ...value, coverage: "WORKFLOW", runFunctionalTests: true, captureScreenshots: true });
              }}
            />
            <span className="font-medium">{t.scan.coverageWorkflow}</span>
            <p className="mt-1 text-slate-600">{t.scan.coverageWorkflowHint}</p>
          </label>
          <label
            className={`cursor-pointer rounded-2xl border p-5 text-base ${
              value.coverage === "FULL" ? "border-brand-700 bg-brand-50" : "border-slate-200"
            }`}
          >
            <input
              required
              type="radio"
              name="coverage"
              className="mr-2"
              checked={value.coverage === "FULL"}
              onChange={() => {
                setCoverageError("");
                setValue({ ...value, coverage: "FULL" });
              }}
            />
            <span className="font-medium">{t.scan.coverageFull}</span>
            <p className="mt-1 text-slate-600">{t.scan.coverageFullHint}</p>
          </label>
          <label
            className={`cursor-pointer rounded-2xl border p-5 text-base ${
              value.coverage === "LANDING" ? "border-brand-700 bg-brand-50" : "border-slate-200"
            }`}
          >
            <input
              type="radio"
              name="coverage"
              className="mr-2"
              checked={value.coverage === "LANDING"}
              onChange={() => {
                setCoverageError("");
                setValue({ ...value, coverage: "LANDING" });
              }}
            />
            <span className="font-medium">{t.scan.coverageLanding}</span>
            <p className="mt-1 text-slate-600">{t.scan.coverageLandingHint}</p>
          </label>
          <label
            className={`cursor-pointer rounded-2xl border p-5 text-base ${
              value.coverage === "SCREENSHOTS" ? "border-brand-700 bg-brand-50" : "border-slate-200"
            }`}
          >
            <input
              type="radio"
              name="coverage"
              className="mr-2"
              checked={value.coverage === "SCREENSHOTS"}
              onChange={() => {
                setCoverageError("");
                setValue({ ...value, coverage: "SCREENSHOTS", viewport: "DESKTOP", captureScreenshots: true });
              }}
            />
            <span className="font-medium">{t.scan.coverageScreenshots}</span>
            <p className="mt-1 text-slate-600">{t.scan.coverageScreenshotsHint}</p>
          </label>
          <label
            className={`cursor-pointer rounded-2xl border p-5 text-base ${
              value.coverage === "INSIDE" ? "border-brand-700 bg-brand-50" : "border-slate-200"
            }`}
          >
            <input
              type="radio"
              name="coverage"
              className="mr-2"
              checked={value.coverage === "INSIDE"}
              onChange={() => {
                setCoverageError("");
                setValue({ ...value, coverage: "INSIDE", runFunctionalTests: true, captureScreenshots: true, testMode: "DEEP" });
              }}
            />
            <span className="font-medium">{t.scan.coverageInside}</span>
            <p className="mt-1 text-slate-600">{t.scan.coverageInsideHint}</p>
          </label>
        </div>
        {coverageError ? <p className="text-sm text-red-700">{coverageError}</p> : null}
      </fieldset>

      {isWorkflow ? (
        <div className="space-y-3 rounded-2xl border border-slate-200 p-4">
          <label className="flex items-start gap-3 text-sm">
            <input
              type="checkbox"
              className="mt-1"
              checked={value.authorizedTest}
              onChange={(event) => setValue({ ...value, authorizedTest: event.target.checked })}
            />
            <span>{t.scan.authorizedTest}</span>
          </label>
          <label className="block text-sm font-medium">
            {t.scan.dataSeed}
            <input
              type="number"
              min={0}
              value={value.dataSeed}
              onChange={(event) => setValue({ ...value, dataSeed: event.target.value })}
              className="mt-2 w-full rounded-xl border border-slate-300 px-4 py-3 text-base"
            />
            <span className="mt-1 block font-normal text-slate-600">{t.scan.dataSeedHint}</span>
          </label>
        </div>
      ) : null}

      <p className="text-sm text-slate-600">{isScreenshots ? t.scan.screenshotLoginHint : t.scan.loginHint}</p>
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="text-sm font-medium">
          {t.scan.loginUsername}
          <input
            type="text"
            autoComplete="username"
            value={value.loginUsername}
            onChange={(event) => setValue({ ...value, loginUsername: event.target.value })}
            className="mt-2 w-full rounded-xl border border-slate-300 px-4 py-3 text-base"
          />
        </label>
        <label className="text-sm font-medium">
          {t.scan.loginPassword}
          <input
            type="password"
            autoComplete="current-password"
            value={value.loginPassword}
            onChange={(event) => setValue({ ...value, loginPassword: event.target.value })}
            className="mt-2 w-full rounded-xl border border-slate-300 px-4 py-3 text-base"
          />
        </label>
      </div>
      <label className="block text-sm font-medium">
        {t.scan.loginUrl}
        <input
          type="text"
          placeholder="/login"
          value={value.loginUrl}
          onChange={(event) => setValue({ ...value, loginUrl: event.target.value })}
          className="mt-2 w-full rounded-xl border border-slate-300 px-4 py-3 text-base"
        />
      </label>
      {isScreenshots ? (
        <p className="text-sm text-slate-600">{t.scan.screenshotSettingsHint}</p>
      ) : (
      <label className="block text-sm font-medium">
        {t.scan.viewport}
        <select
          value={value.viewport}
          onChange={(event) => setValue({ ...value, viewport: event.target.value as ScanFormValue["viewport"] })}
          className="mt-2 w-full rounded-xl border border-slate-300 px-4 py-3 text-base"
        >
          <option value="DESKTOP">Desktop 1920x1080</option>
          <option value="TABLET">Tablet</option>
          <option value="MOBILE">Mobile</option>
          <option value="ALL">All common sizes</option>
        </select>
      </label>
      )}
      {isScreenshots ? null : (
      <>
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="text-sm font-medium">
          {t.scan.testMode}
          <select
            value={isInside ? "DEEP" : value.testMode}
            disabled={isInside}
            onChange={(event) => setValue({ ...value, testMode: event.target.value as ScanFormValue["testMode"] })}
            className="mt-2 w-full rounded-xl border border-slate-300 px-4 py-3 text-base disabled:bg-slate-100"
          >
            {isInside ? <option value="DEEP">Inside every page — clicks the buttons on each page</option> : null}
            <option value="SAFE">Safe — explore only</option>
            <option value="STANDARD">Standard — safe interactions + validation</option>
            <option value="AGGRESSIVE">Aggressive — deeper interaction, still skips destructive actions</option>
          </select>
        </label>
        <label className="text-sm font-medium">
          {t.scan.browser}
          <select
            value={value.browserEngine}
            onChange={(event) => setValue({ ...value, browserEngine: event.target.value as ScanFormValue["browserEngine"] })}
            className="mt-2 w-full rounded-xl border border-slate-300 px-4 py-3 text-base"
          >
            <option value="chromium">Chromium</option>
            <option value="firefox">Firefox</option>
            <option value="webkit">WebKit</option>
          </select>
        </label>
      </div>
      <div className="grid gap-2 sm:grid-cols-2">
        <Toggle label={t.scan.functional} checked={value.runFunctionalTests} onChange={(runFunctionalTests) => setValue({ ...value, runFunctionalTests })} />
        <Toggle label={t.scan.security} checked={value.runSecurity} onChange={(runSecurity) => setValue({ ...value, runSecurity })} />
        <Toggle label={t.scan.performance} checked={value.runPerformance} onChange={(runPerformance) => setValue({ ...value, runPerformance })} />
        <Toggle label={t.scan.accessibility} checked={value.runAccessibility} onChange={(runAccessibility) => setValue({ ...value, runAccessibility })} />
        {value.coverage === "FULL" ? null : (
          <Toggle label={t.scan.screenshots} checked={value.captureScreenshots} onChange={(captureScreenshots) => setValue({ ...value, captureScreenshots })} />
        )}
        <Toggle label={t.scan.videos} checked={value.recordVideos} onChange={(recordVideos) => setValue({ ...value, recordVideos })} />
        <Toggle label={t.scan.ai} checked={value.aiAnalysis} onChange={(aiAnalysis) => setValue({ ...value, aiAnalysis })} />
        <Toggle label={t.scan.seo} checked={value.runSeo} onChange={(runSeo) => setValue({ ...value, runSeo })} />
      </div>
      </>
      )}
      {error ? <p className="text-sm text-red-700">{error}</p> : null}
      <Button type="submit" disabled={pending} className="px-6 py-3 text-base">
        {pending ? "Starting…" : submitLabel}
      </Button>
    </form>
  );
}
