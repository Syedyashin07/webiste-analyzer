import { useEffect, useState } from "react";

export interface ScanEvent {
  id?: string;
  type: string;
  message: string;
  payload?: Record<string, unknown>;
  createdAt?: string;
}

export function useScanEvents(scanId: string | undefined) {
  const [events, setEvents] = useState<ScanEvent[]>([]);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    if (!scanId) return;
    const source = new EventSource(`/api/scans/${scanId}/events`);
    source.onopen = () => setConnected(true);
    source.onmessage = (message) => {
      try {
        const data = JSON.parse(message.data) as ScanEvent;
        setEvents((current) => [...current, data]);
      } catch {
        /* ignore malformed */
      }
    };
    source.onerror = () => setConnected(false);
    return () => {
      source.close();
      setConnected(false);
    };
  }, [scanId]);

  return { events, connected };
}
