import { escapeHtml } from "@/shared/lib/utils";
import type { EditEventOut } from "@/shared/types";

export function ordinal(n: number): string {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

export function formatDateTime(iso: string): string {
  const d = new Date(iso);
  const weekday = d.toLocaleDateString("en-GB", { weekday: "short" });
  const month = d.toLocaleDateString("en-GB", { month: "long" });
  const year = d.getFullYear();
  const day = ordinal(d.getDate());
  const time = d.toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
  });
  return `${weekday}, ${day} ${month} ${year}, ${time}`;
}

export function eventSummary(ev: EditEventOut): string {
  const meta = ev.metadata_json ?? {};
  const codeLabel = (meta.code_label as string) || "Unknown code";

  if (ev.entity_type === "segment") {
    const text = (meta.segment_text as string) || "";
    const preview = text.length > 60 ? text.slice(0, 60) + "…" : text;
    if (ev.action === "created")
      return `Applied "${codeLabel}" to "${preview}"`;
    if (ev.action === "deleted")
      return `Removed "${codeLabel}" from "${preview}"`;
  }

  if (ev.entity_type === "code") {
    if (ev.action === "created") return `Created code "${codeLabel}"`;
    if (ev.action === "deleted") return `Deleted code "${codeLabel}"`;
    if (ev.action === "updated" && ev.field_changed) {
      return `Changed ${ev.field_changed} of "${codeLabel}"`;
    }
  }

  return `${ev.action} ${ev.entity_type}`;
}

export function buildHistoryAnnotatedText(
  fullText: string,
  selectedEvent: EditEventOut | null,
): string {
  if (!selectedEvent || !fullText) return escapeHtml(fullText);

  const meta = selectedEvent.metadata_json ?? {};
  const start = meta.start_index as number | undefined;
  const end = meta.end_index as number | undefined;

  if (start === undefined || end === undefined) return escapeHtml(fullText);
  if (start < 0 || end > fullText.length || start >= end)
    return escapeHtml(fullText);

  const bgColour =
    selectedEvent.action === "created"
      ? "rgba(16,185,129,0.18)"
      : selectedEvent.action === "deleted"
        ? "rgba(239,68,68,0.15)"
        : "rgba(245,158,11,0.18)";

  const borderColour =
    selectedEvent.action === "created"
      ? "rgba(16,185,129,0.55)"
      : selectedEvent.action === "deleted"
        ? "rgba(239,68,68,0.55)"
        : "rgba(245,158,11,0.55)";

  const before = escapeHtml(fullText.slice(0, start));
  const highlighted = escapeHtml(fullText.slice(start, end));
  const after = escapeHtml(fullText.slice(end));

  return `${before}<mark data-history="true" style="background-color:${bgColour};border-bottom:2px solid ${borderColour}">${highlighted}</mark>${after}`;
}
