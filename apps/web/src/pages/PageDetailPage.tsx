import { useQuery } from "@tanstack/react-query";
import { Link, useParams } from "react-router-dom";
import { api } from "../api/client";
import { Card, ErrorState, Spinner } from "../components/ui/Ui";

export function PageDetailPage() {
  const { id, pageId } = useParams();
  const query = useQuery({
    queryKey: ["page", id, pageId],
    queryFn: () => api.page(id!, pageId!),
    enabled: Boolean(id && pageId),
  });
  if (query.isLoading) return <Spinner label="Loading page" />;
  if (query.isError) return <ErrorState message={(query.error as Error).message} />;
  const page = query.data?.page;
  if (!page) return <ErrorState message="Page not found" />;

  return (
    <div className="space-y-4">
      <Link to={`/scans/${id}`} className="text-sm text-brand-800 underline">
        Back to scan
      </Link>
      <h1 className="text-2xl font-semibold break-all">{page.url}</h1>
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <p className="text-sm text-slate-500">HTTPS / SSL</p>
          <p className={`text-2xl font-semibold ${page.httpsOk === true ? "text-emerald-700" : "text-red-700"}`}>
            {page.httpsOk === true ? "HTTPS OK" : page.httpsOk === false ? "Fail" : page.url.startsWith("https://") ? "HTTPS" : "HTTP"}
          </p>
          <p className="mt-2 text-sm text-slate-600">
            {page.tlsJson?.protocol ?? "No TLS handshake"}
            {page.tlsJson?.subjectCn ? ` · ${page.tlsJson.subjectCn}` : ""}
          </p>
          <p className="text-sm text-slate-500">
            {page.tlsJson?.issuer ? `Issuer: ${page.tlsJson.issuer}` : ""}
            {page.tlsJson?.validTo ? ` · Valid to ${page.tlsJson.validTo}` : ""}
          </p>
          {page.tlsJson?.authorizationError ? (
            <p className="mt-1 text-sm text-red-700">{page.tlsJson.authorizationError}</p>
          ) : null}
        </Card>
        <Card>
          <p className="text-sm text-slate-500">HTTP status</p>
          <p className="text-2xl font-semibold">{page.httpStatus ?? "—"}</p>
        </Card>
        <Card>
          <p className="text-sm text-slate-500">Load time</p>
          <p className="text-2xl font-semibold">{page.responseTimeMs ?? "—"} ms</p>
        </Card>
      </div>
      <Card>
        <p className="text-sm text-slate-500">Title</p>
        <p className="font-medium">{page.title ?? "—"}</p>
        <p className="mt-2 text-sm text-slate-500">Meta</p>
        <p>{page.metaDescription ?? "—"}</p>
        <p className="mt-1 text-sm text-slate-500">Canonical: {page.canonical ?? "—"} · Lang: {page.language ?? "—"}</p>
      </Card>
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <h2 className="font-semibold">Links</h2>
          <ul className="mt-2 max-h-64 overflow-auto text-sm">
            {page.links.map((link) => (
              <li key={link.href} className={link.isBroken ? "text-red-700" : ""}>
                {link.href} {link.isBroken ? `(broken ${link.statusCode ?? ""})` : ""}
              </li>
            ))}
          </ul>
        </Card>
        <Card>
          <h2 className="font-semibold">Images</h2>
          <ul className="mt-2 max-h-64 overflow-auto text-sm">
            {page.images.map((image) => (
              <li key={image.src} className={image.isBroken ? "text-red-700" : ""}>
                {image.src} {image.alt ? `alt="${image.alt}"` : "missing alt"}
              </li>
            ))}
          </ul>
        </Card>
      </div>
      <Card>
        <h2 className="font-semibold">Forms</h2>
        <ul className="mt-2 text-sm">
          {page.forms.map((form, index) => (
            <li key={`${form.action}-${index}`}>
              {form.method} {form.action ?? "(same page)"} · {form.fieldCount} fields
            </li>
          ))}
        </ul>
      </Card>
      <Card>
        <h2 className="font-semibold">Interactive elements</h2>
        <ul className="mt-2 max-h-64 overflow-auto text-sm">
          {(page.elements ?? []).map((element, index) => (
            <li key={`${element.type}-${index}`}>
              {element.type} · {element.text || "(no text)"} · {element.risk ?? "UNKNOWN"} {element.visible ? "" : "(hidden)"}
            </li>
          ))}
          {(page.elements ?? []).length === 0 ? <li className="text-slate-500">No elements stored for this page.</li> : null}
        </ul>
      </Card>
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <h2 className="font-semibold">Console errors</h2>
          <ul className="mt-2 text-sm">
            {page.consoleErrors.map((item, index) => (
              <li key={index}>{item.message}</li>
            ))}
          </ul>
        </Card>
        <Card>
          <h2 className="font-semibold">Network errors</h2>
          <ul className="mt-2 text-sm">
            {page.networkErrors.map((item, index) => (
              <li key={item.id ?? index} className="mb-2">
                <div className="font-medium text-red-800">
                  {(item.method ?? "GET").toUpperCase()} {item.requestUrl}
                </div>
                <div className="text-slate-600">
                  {item.statusCode ?? item.error ?? "failed"}
                  {item.resourceType ? ` · ${item.resourceType}` : ""}
                </div>
              </li>
            ))}
          </ul>
        </Card>
      </div>
      <Card>
        <h2 className="font-semibold">HTTPS / SSL and security</h2>
        <ul className="mt-2 list-disc pl-5 text-sm">
          {(page.securityIssues ?? []).map((issue, index) => (
            <li key={`sec-${index}`} className={issue.severity === "CRITICAL" || issue.severity === "HIGH" ? "text-red-700" : ""}>
              {issue.message}
            </li>
          ))}
          {(page.securityIssues ?? []).length === 0 ? <li>No HTTPS/SSL or security issues on this page.</li> : null}
        </ul>
      </Card>
      <Card>
        <h2 className="font-semibold">Accessibility / Performance{(page.seoIssues ?? []).length > 0 ? " / SEO" : ""}</h2>
        <p className="text-sm">Performance score: {page.performance?.score ?? "—"} · Load: {page.performance?.loadEventMs ?? "—"} ms</p>
        <ul className="mt-2 list-disc pl-5 text-sm">
          {page.accessibility.map((issue, index) => (
            <li key={`a11y-${index}`}>{issue.message}</li>
          ))}
          {(page.seoIssues ?? []).map((issue, index) => (
            <li key={`seo-${index}`}>{issue.message}</li>
          ))}
        </ul>
      </Card>
      <Card>
        <h2 className="font-semibold">Screenshots</h2>
        <div className="mt-3 grid gap-3 md:grid-cols-2">
          {page.screenshots.map((shot) => (
            <figure key={shot.id}>
              <img src={`/api/evidence/${shot.id}`} alt={`${shot.kind} screenshot`} className="rounded border border-slate-200" />
              <figcaption className="mt-1 text-xs text-slate-500">
                {shot.kind}
                {shot.viewport ? ` · ${shot.viewport}` : ""}
              </figcaption>
            </figure>
          ))}
        </div>
      </Card>
    </div>
  );
}
