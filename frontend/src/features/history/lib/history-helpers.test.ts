import { describe, it, expect } from "vitest";
import {
  ordinal,
  formatDateTime,
  eventSummary,
  buildHistoryAnnotatedText,
} from "../lib/history-helpers";
import type { EditEventOut } from "@/shared/types";

function ev(overrides: Partial<EditEventOut> = {}): EditEventOut {
  return {
    id: "e1",
    project_id: "p1",
    document_id: "d1",
    entity_type: "segment",
    action: "created",
    entity_id: "s1",
    field_changed: null,
    old_value: null,
    new_value: null,
    metadata_json: { code_label: "Theme", segment_text: "hello world" },
    user_id: "u1",
    created_at: "2025-06-15T14:30:00Z",
    ...overrides,
  };
}

describe("ordinal", () => {
  it("handles 1st, 2nd, 3rd", () => {
    expect(ordinal(1)).toBe("1st");
    expect(ordinal(2)).toBe("2nd");
    expect(ordinal(3)).toBe("3rd");
  });

  it("handles teens (11th, 12th, 13th)", () => {
    expect(ordinal(11)).toBe("11th");
    expect(ordinal(12)).toBe("12th");
    expect(ordinal(13)).toBe("13th");
  });

  it("handles 21st, 22nd, 23rd", () => {
    expect(ordinal(21)).toBe("21st");
    expect(ordinal(22)).toBe("22nd");
    expect(ordinal(23)).toBe("23rd");
  });

  it("handles 4th-9th", () => {
    for (let n = 4; n <= 9; n++) {
      expect(ordinal(n)).toBe(`${n}th`);
    }
  });
});

describe("formatDateTime", () => {
  it("returns formatted string with ordinal day", () => {
    const result = formatDateTime("2025-12-07T21:15:00Z");
    // Contains ordinal day, month, year and time
    expect(result).toContain("2025");
    expect(result).toContain("December");
    expect(result).toMatch(/\d{2}:\d{2}/);
  });
});

describe("eventSummary", () => {
  it("describes segment creation", () => {
    expect(eventSummary(ev())).toBe('Applied "Theme" to "hello world"');
  });

  it("describes segment deletion", () => {
    expect(eventSummary(ev({ action: "deleted" }))).toBe(
      'Removed "Theme" from "hello world"'
    );
  });

  it("truncates long segment text", () => {
    const longText = "a".repeat(100);
    const result = eventSummary(
      ev({ metadata_json: { code_label: "T", segment_text: longText } })
    );
    expect(result).toContain("…");
    expect(result.length).toBeLessThan(200);
  });

  it("describes code creation", () => {
    expect(
      eventSummary(
        ev({
          entity_type: "code",
          action: "created",
          metadata_json: { code_label: "Joy" },
        })
      )
    ).toBe('Created code "Joy"');
  });

  it("describes code deletion", () => {
    expect(
      eventSummary(
        ev({
          entity_type: "code",
          action: "deleted",
          metadata_json: { code_label: "Joy" },
        })
      )
    ).toBe('Deleted code "Joy"');
  });

  it("describes code update with field", () => {
    expect(
      eventSummary(
        ev({
          entity_type: "code",
          action: "updated",
          field_changed: "definition",
          metadata_json: { code_label: "Joy" },
        })
      )
    ).toBe('Changed definition of "Joy"');
  });

  it("falls back for unknown entity/action", () => {
    expect(
      eventSummary(
        ev({ entity_type: "document" as "segment", action: "updated" })
      )
    ).toBe("updated document");
  });
});

describe("buildHistoryAnnotatedText", () => {
  it("returns escaped text when no event selected", () => {
    expect(buildHistoryAnnotatedText("<b>hi</b>", null)).toBe(
      "&lt;b&gt;hi&lt;/b&gt;"
    );
  });

  it("returns escaped text when event has no indices", () => {
    expect(buildHistoryAnnotatedText("hello", ev({ metadata_json: {} }))).toBe(
      "hello"
    );
  });

  it("highlights segment with green for created action", () => {
    const event = ev({
      action: "created",
      metadata_json: { start_index: 0, end_index: 5 },
    });
    const html = buildHistoryAnnotatedText("hello world", event);
    expect(html).toContain("<mark");
    expect(html).toContain("16,185,129"); // green
    expect(html).toContain("hello");
  });

  it("highlights with red for deleted action", () => {
    const event = ev({
      action: "deleted",
      metadata_json: { start_index: 6, end_index: 11 },
    });
    const html = buildHistoryAnnotatedText("hello world", event);
    expect(html).toContain("239,68,68"); // red
  });

  it("highlights with amber for updated action", () => {
    const event = ev({
      action: "updated",
      metadata_json: { start_index: 0, end_index: 5 },
    });
    const html = buildHistoryAnnotatedText("hello world", event);
    expect(html).toContain("245,158,11"); // amber
  });

  it("returns escaped text for invalid indices", () => {
    const event = ev({
      metadata_json: { start_index: 10, end_index: 5 },
    });
    expect(buildHistoryAnnotatedText("hello", event)).toBe("hello");
  });
});
