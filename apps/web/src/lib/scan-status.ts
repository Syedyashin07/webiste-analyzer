export const ACTIVE_SCAN_STATUSES = [
  "QUEUED",
  "INITIALIZING",
  "CRAWLING",
  "SCANNING",
  "ANALYZING",
  "VERIFYING",
  "GENERATING_REPORT",
  "PAUSED",
] as const;

export function isActiveScanStatus(status: string): boolean {
  return (ACTIVE_SCAN_STATUSES as readonly string[]).includes(status);
}

export function greeting(now = new Date()): string {
  const hour = now.getHours();
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}
