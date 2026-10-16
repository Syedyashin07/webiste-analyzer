import tls from "node:tls";
import { CRAWLER_USER_AGENT } from "@qa-scanner/shared";

export interface TlsHostResult {
  host: string;
  port: number;
  connected: boolean;
  authorized: boolean;
  authorizationError: string | null;
  protocol: string | null;
  cipher: string | null;
  validFrom: string | null;
  validTo: string | null;
  daysUntilExpiry: number | null;
  subjectCn: string | null;
  issuer: string | null;
  fingerprint256: string | null;
  httpRedirectsToHttps: boolean | null;
}

export interface TlsInspection extends TlsHostResult {
  pageUrl: string;
  schemeHttps: boolean;
}

const WEAK_PROTOCOLS = new Set(["SSLv3", "TLSv1", "TLSv1.1"]);
const TLS_TIMEOUT_MS = 8000;

export function tlsCacheKey(pageUrl: string): string {
  const url = new URL(pageUrl);
  return `${url.hostname.toLowerCase()}:443`;
}

export function isHttpsOk(inspection: TlsInspection): boolean {
  return (
    inspection.schemeHttps &&
    inspection.connected &&
    inspection.authorized &&
    (inspection.daysUntilExpiry === null || inspection.daysUntilExpiry > 0)
  );
}

export async function cachedInspectTls(
  cache: Map<string, Promise<TlsHostResult>>,
  pageUrl: string,
): Promise<TlsInspection> {
  const key = tlsCacheKey(pageUrl);
  let pending = cache.get(key);
  if (!pending) {
    pending = inspectTlsHost(pageUrl);
    cache.set(key, pending);
  }
  const host = await pending;
  return {
    ...host,
    pageUrl,
    schemeHttps: pageUrl.startsWith("https://"),
  };
}

export async function inspectTlsHost(pageUrl: string): Promise<TlsHostResult> {
  let parsed: URL;
  try {
    parsed = new URL(pageUrl);
  } catch {
    return emptyHost("invalid-host", 443);
  }

  const host = parsed.hostname;
  const port = 443;
  const handshake = await handshakeTls(host, port);
  const httpRedirectsToHttps = await checkHttpRedirectsToHttps(host, parsed.pathname + parsed.search);
  return { ...handshake, host, port, httpRedirectsToHttps };
}

function emptyHost(host: string, port: number): TlsHostResult {
  return {
    host,
    port,
    connected: false,
    authorized: false,
    authorizationError: "Could not inspect SSL certificate",
    protocol: null,
    cipher: null,
    validFrom: null,
    validTo: null,
    daysUntilExpiry: null,
    subjectCn: null,
    issuer: null,
    fingerprint256: null,
    httpRedirectsToHttps: null,
  };
}

function handshakeTls(host: string, port: number): Promise<Omit<TlsHostResult, "host" | "port" | "httpRedirectsToHttps">> {
  return new Promise((resolve) => {
    let settled = false;
    const finish = (result: Omit<TlsHostResult, "host" | "port" | "httpRedirectsToHttps">) => {
      if (settled) return;
      settled = true;
      resolve(result);
      socket.destroy();
    };

    const socket = tls.connect({
      host,
      port,
      servername: host,
      rejectUnauthorized: false,
      timeout: TLS_TIMEOUT_MS,
    });

    socket.setTimeout(TLS_TIMEOUT_MS, () => {
      finish({
        connected: false,
        authorized: false,
        authorizationError: "TLS handshake timed out",
        protocol: null,
        cipher: null,
        validFrom: null,
        validTo: null,
        daysUntilExpiry: null,
        subjectCn: null,
        issuer: null,
        fingerprint256: null,
      });
    });

    socket.once("error", (error) => {
      finish({
        connected: false,
        authorized: false,
        authorizationError: error.message,
        protocol: null,
        cipher: null,
        validFrom: null,
        validTo: null,
        daysUntilExpiry: null,
        subjectCn: null,
        issuer: null,
        fingerprint256: null,
      });
    });

    socket.once("secureConnect", () => {
      const cert = socket.getPeerCertificate();
      const authorized = socket.authorized;
      const protocol = socket.getProtocol();
      const cipher = socket.getCipher();
      const validTo = cert?.valid_to ? new Date(cert.valid_to) : null;
      const daysUntilExpiry =
        validTo && !Number.isNaN(validTo.getTime())
          ? Math.floor((validTo.getTime() - Date.now()) / 86_400_000)
          : null;
      finish({
        connected: true,
        authorized,
        authorizationError: authorized ? null : String(socket.authorizationError ?? "certificate is not trusted"),
        protocol,
        cipher: cipher?.name ?? null,
        validFrom: cert?.valid_from ?? null,
        validTo: cert?.valid_to ?? null,
        daysUntilExpiry,
        subjectCn: typeof cert?.subject?.CN === "string" ? cert.subject.CN : null,
        issuer: typeof cert?.issuer?.O === "string" ? cert.issuer.O : typeof cert?.issuer?.CN === "string" ? cert.issuer.CN : null,
        fingerprint256: cert?.fingerprint256 ?? null,
      });
    });
  });
}

async function checkHttpRedirectsToHttps(host: string, pathAndQuery: string): Promise<boolean | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TLS_TIMEOUT_MS);
  try {
    const response = await fetch(`http://${host}${pathAndQuery || "/"}`, {
      method: "GET",
      redirect: "follow",
      signal: controller.signal,
      headers: { "user-agent": CRAWLER_USER_AGENT },
    });
    return response.url.startsWith("https://");
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

export { WEAK_PROTOCOLS };
