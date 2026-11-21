/**
 * Privacy-first analytics dispatcher for ENIX Studio v2.
 * NEVER sends PII (names, emails, phone numbers, chat transcripts, or brief text).
 */
export type ProjectAnalyticsEvent =
  | "enix_project_start"
  | "enix_project_summary"
  | "enix_project_download"
  | "enix_project_submit_confirmed";

export interface SafeEventPayload {
  track?: string;
  category?: string;
  format?: "md" | "txt" | "print";
}

declare global {
  interface Window {
    dataLayer?: Record<string, unknown>[];
    gtag?: (...args: unknown[]) => void;
  }
}

export function trackProjectEvent(event: ProjectAnalyticsEvent, payload: SafeEventPayload = {}): void {
  if (typeof window === "undefined") return;

  const cleanPayload: Record<string, string> = {};
  if (payload.track) cleanPayload.project_track = payload.track;
  if (payload.category) cleanPayload.project_category = payload.category;
  if (payload.format) cleanPayload.export_format = payload.format;

  try {
    if (typeof window.gtag === "function") {
      window.gtag("event", event, cleanPayload);
    } else if (Array.isArray(window.dataLayer)) {
      window.dataLayer.push({ event, ...cleanPayload });
    }
  } catch {
    // Never break UX if analytics is blocked or unavailable
  }
}
