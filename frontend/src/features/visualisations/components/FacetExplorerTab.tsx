/**
 * FacetExplorerTab — Two-level interactive scatter with 2D/3D toggle.
 *
 * Overview mode (default):
 *   • Plotly scatter of all positioned segments, coloured by code
 *   • Diamond centroid marker per code, labelled with code name
 *   • Grouped horizontal bar chart: segment count + facet count per code
 *   • Click any dot or legend entry → drill into that code
 *
 * Drilldown mode (selectedVisCodeId set):
 *   • Same scatter scoped to one code, coloured by facet
 *   • Two stacked bar charts: segment count + avg similarity per facet
 *   • Clicking a facet dot/legend → opens FacetReasonPanel floating overlay
 *   • "Suggest labels" button (existing)
 *   • Breadcrumb "← All codes"
 *
 * 2D/3D toggle pill: top-right of scatter area.
 */
import { lazy, Suspense, useCallback, useEffect, useMemo, useState } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
  Legend as RechartsLegend,
} from "recharts";
import { Sparkles, Loader2, Layers, Box } from "lucide-react";
import { useStore } from "@/stores/store";
import {
  fetchVisFacets,
  fetchVisCodesOverview,
  renameFacet,
  suggestFacetLabels,
} from "@/api/client";
import type { FacetData, CodesOverviewData } from "@/types";
import { ChartSkeleton } from "@/shared/ui";
import FacetReasonPanel from "./FacetReasonPanel";
import FacetPlot from "./FacetPlot";
import type { FacetPlotTrace } from "./FacetPlot";


// ── Colour palette ─────────────────────────────────────────────────
const PALETTE = [
  "#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6",
  "#ec4899", "#06b6d4", "#84cc16", "#f97316", "#6366f1",
];
function colourFor(i: number): string { return PALETTE[i % PALETTE.length]; }

type LoadState = "idle" | "loading" | "error" | "success";
type PlotMode = "2d" | "3d";

interface FacetExplorerTabProps { projectId: string; }

// ── Component ──────────────────────────────────────────────────────
export default function FacetExplorerTab({ projectId }: FacetExplorerTabProps) {
  const selectedVisCodeId = useStore((s) => s.selectedVisCodeId);
  const setSelectedVisCodeId = useStore((s) => s.setSelectedVisCodeId);
  const visRefreshCounter = useStore((s) => s.visRefreshCounter);

  // View state
  const [viewMode, setViewMode] = useState<"overview" | "drilldown">("overview");
  const [plotMode, setPlotMode] = useState<PlotMode>("2d");
  const [selectedFacetId, setSelectedFacetId] = useState<string | null>(null);

  // Data state
  const [overviewData, setOverviewData] = useState<CodesOverviewData | null>(null);
  const [drilldownFacets, setDrilldownFacets] = useState<FacetData[]>([]);
  const [loadState, setLoadState] = useState<LoadState>("idle");

  // Action state
  const [suggesting, setSuggesting] = useState(false);

  // Sync view mode from store
  useEffect(() => {
    if (selectedVisCodeId) {
      setViewMode("drilldown");
    } else {
      setViewMode("overview");
      setSelectedFacetId(null);
    }
  }, [selectedVisCodeId]);

  // Fetch overview
  useEffect(() => {
    if (viewMode !== "overview") return;
    setLoadState("loading");
    fetchVisCodesOverview(projectId)
      .then((d) => { setOverviewData(d); setLoadState("success"); })
      .catch(() => setLoadState("error"));
  }, [projectId, viewMode, visRefreshCounter]);

  // Fetch drilldown facets
  useEffect(() => {
    if (viewMode !== "drilldown" || !selectedVisCodeId) return;
    setLoadState("loading");
    setSelectedFacetId(null);
    fetchVisFacets(projectId, selectedVisCodeId)
      .then((d) => { setDrilldownFacets(d.facets); setLoadState("success"); })
      .catch(() => setLoadState("error"));
  }, [projectId, viewMode, selectedVisCodeId, visRefreshCounter]);

  // ── Handlers ────────────────────────────────────────────────────

  const drillIntoCode = useCallback(
    (codeId: string) => {
      setSelectedVisCodeId(codeId);
      setViewMode("drilldown");
      setSelectedFacetId(null);
    },
    [setSelectedVisCodeId],
  );

  const backToOverview = useCallback(() => {
    setSelectedVisCodeId(null);
    setViewMode("overview");
    setSelectedFacetId(null);
  }, [setSelectedVisCodeId]);

  const handlePlotClick = useCallback(
    (customdata: unknown[] | undefined) => {
      if (!customdata) return;
      // customdata layout: [primaryId, secondaryId, textPreview]
      // overview:   [code_id,  null,     text]
      // drilldown:  [code_id,  facet_id, text]
      if (viewMode === "overview") {
        const codeId = customdata[0] as string | undefined;
        if (codeId) drillIntoCode(codeId);
      } else {
        const facetId = customdata[1] as string | null | undefined;
        if (facetId) setSelectedFacetId(facetId);
      }
    },
    [viewMode, drillIntoCode],
  );

  const handleLegendClick = useCallback(
    (seriesName: string) => {
      if (viewMode === "overview") {
        const code = overviewData?.codes.find((c) => c.code_name === seriesName);
        if (code) drillIntoCode(code.code_id);
      } else {
        const facet = drilldownFacets.find((f) => f.facet_label === seriesName);
        if (facet) setSelectedFacetId(facet.facet_id);
      }
    },
    [viewMode, overviewData, drilldownFacets, drillIntoCode],
  );

  const handleSuggestLabels = async () => {
    if (!selectedVisCodeId) return;
    setSuggesting(true);
    try {
      const result = await suggestFacetLabels(projectId, selectedVisCodeId);
      setDrilldownFacets(result.facets as FacetData[]);
    } catch (err) {
      console.error(err);
    } finally {
      setSuggesting(false);
    }
  };

  // ── Build Plotly traces ──────────────────────────────────────────

  const overviewTraces = useMemo((): FacetPlotTrace[] => {
    if (!overviewData) return [];
    const { segments, codes } = overviewData;

    // Group segments by code
    const byCode: Record<string, typeof segments> = {};
    for (const seg of segments) {
      (byCode[seg.code_id] ??= []).push(seg);
    }

    const traces: FacetPlotTrace[] = codes
      .filter((c) => (byCode[c.code_id]?.length ?? 0) > 0)
      .map((code, i) => {
        const segs = byCode[code.code_id] ?? [];
        return {
          name: code.code_name,
          x: segs.map((s) => s.tsne_x),
          y: segs.map((s) => s.tsne_y),
          z: segs.map((s) => s.tsne_z ?? null),
          colour: code.code_colour || colourFor(i),
          symbol: "circle" as const,
          markerSize: 7,
          customdata: segs.map((s) => [s.code_id, null, s.text_preview]),
        };
      });

    // Centroid markers (diamond, one per code, no legend entry each)
    codes
      .filter((c) => c.centroid_x != null && c.centroid_y != null)
      .forEach((c, i) => {
        traces.push({
          name: `★ ${c.code_name}`,
          x: [c.centroid_x!],
          y: [c.centroid_y!],
          z: c.centroid_z != null ? [c.centroid_z] : undefined,
          colour: code_colour_or(c.code_colour, i, codes),
          symbol: "diamond" as const,
          markerSize: 14,
          textLabels: [c.code_name],
          customdata: [[c.code_id, null, c.code_name]],
          showlegend: false,
        });
      });

    return traces;
  }, [overviewData]);

  const drilldownTraces = useMemo((): FacetPlotTrace[] => {
    return drilldownFacets.map((facet, i) => ({
      name: facet.facet_label,
      x: facet.segments.map((s) => s.tsne_x),
      y: facet.segments.map((s) => s.tsne_y),
      z: facet.segments.map((s) => s.tsne_z ?? null),
      colour: colourFor(i),
      symbol: "circle" as const,
      markerSize: 7,
      customdata: facet.segments.map((s) => [
        facet.code_id,
        facet.facet_id,
        s.text_preview,
      ]),
    }));
  }, [drilldownFacets]);

  // ── Bar chart data ───────────────────────────────────────────────

  const overviewBarData = useMemo(
    () =>
      (overviewData?.codes ?? [])
        .filter((c) => c.segment_count > 0)
        .map((c, i) => ({
          name: c.code_name,
          segments: c.segment_count,
          facets: c.facet_count,
          colour: c.code_colour || colourFor(i),
        })),
    [overviewData],
  );

  const drilldownBarData = useMemo(
    () =>
      drilldownFacets.map((f, i) => ({
        name: f.facet_label,
        segments: f.segment_count,
        avgSim:
          f.avg_similarity != null ? Math.round(f.avg_similarity * 100) : 0,
        colour: colourFor(i),
      })),
    [drilldownFacets],
  );

  // ── Derived ──────────────────────────────────────────────────────

  const selectedFacet = useMemo(
    () => drilldownFacets.find((f) => f.facet_id === selectedFacetId) ?? null,
    [drilldownFacets, selectedFacetId],
  );

  const drilldownCodeName = drilldownFacets[0]?.code_name ?? null;

  const traces =
    viewMode === "overview" ? overviewTraces : drilldownTraces;

  const hasData =
    viewMode === "overview"
      ? (overviewData?.segments.length ?? 0) > 0
      : drilldownFacets.length > 0;

  // ── Loading ──────────────────────────────────────────────────────

  if (loadState === "loading" && !overviewData && drilldownFacets.length === 0) {
    return (
      <div className="space-y-4">
        <ChartSkeleton height={420} />
        <ChartSkeleton height={100} />
      </div>
    );
  }

  if (loadState === "error") {
    return (
      <div className="flex flex-col items-center gap-3 py-10 text-center">
        <Layers className="w-8 h-8 text-surface-400" aria-hidden="true" />
        <p className="text-sm text-surface-500">Failed to load facet data.</p>
        <button
          onClick={() => setLoadState("idle")}
          className="text-xs text-brand-500 underline"
        >
          Retry
        </button>
      </div>
    );
  }

  // ── Render ───────────────────────────────────────────────────────

  return (
    <div className="space-y-4">
      {/* Header row: breadcrumb / description + 2D/3D toggle */}
      <div className="flex items-start justify-between gap-2 flex-wrap">
        <div className="min-w-0">
          {viewMode === "overview" ? (
            <p className="text-xs text-surface-400">
              Each dot is a coded segment. Click a dot or legend entry to explore facets within
              that code.
            </p>
          ) : (
            <div className="flex items-center gap-2 flex-wrap text-xs">
              <button
                onClick={backToOverview}
                className="text-brand-500 hover:text-brand-600 dark:hover:text-brand-400 underline shrink-0"
                aria-label="Back to overview of all codes"
              >
                ← All codes
              </button>
              {drilldownCodeName && (
                <span className="text-surface-500">
                  /{" "}
                  <span className="font-medium text-surface-700 dark:text-surface-200">
                    {drilldownCodeName}
                  </span>
                </span>
              )}
              <span className="text-surface-400">
                — click a dot or legend entry to inspect a facet
              </span>
            </div>
          )}
        </div>

        {/* 2D / 3D toggle */}
        <div
          className="flex items-center gap-0.5 rounded-full border panel-border bg-surface-50 dark:bg-surface-800 p-0.5 shrink-0"
          role="group"
          aria-label="Plot dimension toggle"
        >
          <button
            onClick={() => setPlotMode("2d")}
            aria-pressed={plotMode === "2d"}
            className={`text-xs px-3 py-1 rounded-full transition-colors ${
              plotMode === "2d"
                ? "bg-white dark:bg-surface-700 shadow-sm text-surface-800 dark:text-surface-100 font-medium"
                : "text-surface-500 hover:text-surface-700 dark:hover:text-surface-300"
            }`}
          >
            2D
          </button>
          <button
            onClick={() => setPlotMode("3d")}
            aria-pressed={plotMode === "3d"}
            className={`flex items-center gap-1 text-xs px-3 py-1 rounded-full transition-colors ${
              plotMode === "3d"
                ? "bg-white dark:bg-surface-700 shadow-sm text-surface-800 dark:text-surface-100 font-medium"
                : "text-surface-500 hover:text-surface-700 dark:hover:text-surface-300"
            }`}
          >
            <Box className="w-3 h-3" aria-hidden="true" />
            3D
          </button>
        </div>
      </div>

      {!hasData ? (
        <EmptyFacets isOverview={viewMode === "overview"} />
      ) : (
        <>
          {/* Scatter plot — relative wrapper so FacetReasonPanel can anchor to it */}
          <div className="relative">
            <Suspense fallback={<ChartSkeleton height={420} />}>
              <FacetPlot
                traces={traces}
                mode={plotMode}
                onPointClick={handlePlotClick}
                onLegendClick={handleLegendClick}
                height={420}
              />
            </Suspense>

            {viewMode === "drilldown" && selectedFacet && (
              <FacetReasonPanel
                projectId={projectId}
                facet={selectedFacet}
                onClose={() => setSelectedFacetId(null)}
              />
            )}
          </div>

          {/* Bar charts */}
          {viewMode === "overview" && overviewBarData.length > 0 && (
            <OverviewBarChart data={overviewBarData} />
          )}
          {viewMode === "drilldown" && drilldownBarData.length > 0 && (
            <DrilldownBarCharts data={drilldownBarData} />
          )}

          {/* Facet label badges (drilldown only) */}
          {viewMode === "drilldown" && drilldownFacets.length > 0 && (
            <div className="space-y-2">
              <h4 className="text-xs font-semibold text-surface-500 uppercase tracking-wide">
                Facet Labels — click to inspect · Alt+click to rename
              </h4>
              <div className="flex flex-wrap gap-2">
                {drilldownFacets.map((f, i) => (
                  <FacetLabelBadge
                    key={f.facet_id}
                    facetId={f.facet_id}
                    label={f.facet_label}
                    suggestedLabel={f.suggested_label}
                    labelSource={f.label_source}
                    projectId={projectId}
                    color={colourFor(i)}
                    avgSimilarity={f.avg_similarity}
                    isSelected={selectedFacetId === f.facet_id}
                    onSelect={() => setSelectedFacetId(f.facet_id)}
                    onRenamed={(newLabel) =>
                      setDrilldownFacets((prev) =>
                        prev.map((x) =>
                          x.facet_id === f.facet_id
                            ? { ...x, facet_label: newLabel, label_source: "user" }
                            : x,
                        ),
                      )
                    }
                  />
                ))}
              </div>
            </div>
          )}

          {viewMode === "drilldown" && selectedVisCodeId && (
            <button
              onClick={handleSuggestLabels}
              disabled={suggesting || drilldownFacets.length === 0}
              className="flex items-center gap-1.5 text-xs text-brand-600 dark:text-brand-400 hover:text-brand-700 dark:hover:text-brand-300 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              aria-label="Re-suggest AI labels for these facets"
            >
              {suggesting ? (
                <Loader2 className="w-3 h-3 animate-spin" aria-hidden="true" />
              ) : (
                <Sparkles className="w-3 h-3" aria-hidden="true" />
              )}
              {suggesting ? "Suggesting…" : "Suggest labels for these facets"}
            </button>
          )}
        </>
      )}
    </div>
  );
}

// ── Helpers ────────────────────────────────────────────────────────

/** Return each code's colour by position in the same codes array, fallback to palette. */
function code_colour_or(
  colour: string | undefined,
  codeIdx: number,
  _codes: unknown[],
): string {
  return colour || colourFor(codeIdx);
}

// ── Sub-components ─────────────────────────────────────────────────

function OverviewBarChart({
  data,
}: {
  data: { name: string; segments: number; facets: number; colour: string }[];
}) {
  return (
    <div>
      <h4 className="text-xs font-semibold text-surface-500 uppercase tracking-wide mb-2">
        Segments &amp; Facets per Code
      </h4>
      <ResponsiveContainer width="100%" height={Math.max(80, data.length * 32)}>
        <BarChart data={data} layout="vertical" barCategoryGap="30%">
          <XAxis type="number" tick={{ fontSize: 10 }} />
          <YAxis
            dataKey="name"
            type="category"
            width={120}
            tick={{ fontSize: 10 }}
          />
          <Tooltip
            formatter={(v: number | undefined, name: string | undefined) => [
              v ?? 0,
              name === "segments" ? "Segments" : "Facets",
            ]}
          />
          <RechartsLegend iconSize={8} />
          <Bar dataKey="segments" name="Segments" radius={[0, 3, 3, 0]}>
            {data.map((entry) => (
              <Cell key={entry.name} fill={entry.colour} />
            ))}
          </Bar>
          <Bar dataKey="facets" name="Facets" fill="#10b981" radius={[0, 3, 3, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

function DrilldownBarCharts({
  data,
}: {
  data: { name: string; segments: number; avgSim: number; colour: string }[];
}) {
  return (
    <div className="space-y-3">
      <div>
        <h4 className="text-xs font-semibold text-surface-500 uppercase tracking-wide mb-1">
          Segments per Facet
        </h4>
        <ResponsiveContainer
          width="100%"
          height={Math.max(60, data.length * 28)}
        >
          <BarChart data={data} layout="vertical">
            <XAxis type="number" tick={{ fontSize: 10 }} />
            <YAxis
              dataKey="name"
              type="category"
              width={120}
              tick={{ fontSize: 10 }}
            />
            <Tooltip formatter={(v: number | undefined) => [v ?? 0, "segments"]} />
            <Bar dataKey="segments" radius={[0, 3, 3, 0]}>
              {data.map((entry) => (
                <Cell key={entry.name} fill={entry.colour} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
      <div>
        <h4 className="text-xs font-semibold text-surface-500 uppercase tracking-wide mb-1">
          Avg Similarity to Centroid (%)
        </h4>
        <ResponsiveContainer
          width="100%"
          height={Math.max(60, data.length * 28)}
        >
          <BarChart data={data} layout="vertical">
            <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 10 }} />
            <YAxis
              dataKey="name"
              type="category"
              width={120}
              tick={{ fontSize: 10 }}
            />
            <Tooltip formatter={(v: number | undefined) => [`${v ?? 0}%`, "avg sim"]} />
            <Bar dataKey="avgSim" radius={[0, 3, 3, 0]}>
              {data.map((entry) => (
                <Cell key={entry.name} fill={entry.colour} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

function EmptyFacets({ isOverview }: { isOverview: boolean }) {
  return (
    <div className="flex flex-col items-center gap-3 py-10 text-center">
      <Layers className="w-10 h-10 text-surface-300" aria-hidden="true" />
      <p className="text-sm font-medium text-surface-600 dark:text-surface-300">
        {isOverview ? "No positioned segments yet" : "No facets yet"}
      </p>
      <p className="text-xs text-surface-400 max-w-xs">
        {isOverview
          ? "Facets are computed after 4+ segments share a code. Once computed, their positions appear here."
          : "Facets are computed automatically after 4+ segments are coded under this code."}
      </p>
    </div>
  );
}

function FacetLabelBadge({
  facetId,
  label,
  suggestedLabel,
  labelSource,
  projectId,
  color,
  avgSimilarity,
  isSelected,
  onSelect,
  onRenamed,
}: {
  facetId: string;
  label: string;
  suggestedLabel: string | null;
  labelSource: "auto" | "ai" | "user";
  projectId: string;
  color: string;
  avgSimilarity: number | null;
  isSelected: boolean;
  onSelect: () => void;
  onRenamed: (l: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(label);

  const save = () => {
    renameFacet(projectId, facetId, value)
      .then(() => { onRenamed(value); setEditing(false); })
      .catch(console.error);
  };

  const handleClick = (e: React.MouseEvent) => {
    if (e.altKey) {
      setEditing(true);
    } else {
      onSelect();
    }
  };

  if (editing) {
    return (
      <div className="flex items-center gap-1">
        <input
          autoFocus
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && save()}
          className="text-xs border panel-border rounded px-1 py-0.5 bg-white dark:bg-surface-800 text-surface-800 dark:text-surface-100"
          aria-label="Rename facet"
        />
        <button onClick={save} className="text-xs text-green-500" aria-label="Save label">
          ✓
        </button>
        <button
          onClick={() => setEditing(false)}
          className="text-xs text-red-400"
          aria-label="Cancel rename"
        >
          ✕
        </button>
      </div>
    );
  }

  const isAi = labelSource === "ai";
  const tooltip = isAi
    ? `AI label: "${suggestedLabel ?? label}" · Alt+click to rename · click to inspect${avgSimilarity != null ? ` · avg sim ${(avgSimilarity * 100).toFixed(0)}%` : ""}`
    : `Alt+click to rename · click to inspect${avgSimilarity != null ? ` · avg sim ${(avgSimilarity * 100).toFixed(0)}%` : ""}`;

  return (
    <button
      type="button"
      onClick={handleClick}
      title={tooltip}
      aria-label={`Facet: ${label}${isSelected ? " (selected)" : ""}`}
      aria-pressed={isSelected}
      className="cursor-pointer flex items-center gap-1 text-xs px-2 py-1 rounded-full border transition-all hover:opacity-80"
      style={{
        borderColor: color,
        color,
        ...(isSelected
          ? { boxShadow: `0 0 0 2px ${color}55`, outline: "none" }
          : {}),
      }}
    >
      {isAi && <Sparkles className="w-3 h-3 shrink-0" aria-hidden="true" />}
      <span
        className="inline-block w-2 h-2 rounded-full shrink-0"
        style={{ backgroundColor: color }}
        aria-hidden="true"
      />
      {label}
    </button>
  );
}
