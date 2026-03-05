import { useEffect, useState } from "react";
import {
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  ZAxis,
  BarChart,
  Bar,
} from "recharts";
import { Sparkles, Loader2, Layers } from "lucide-react";
import { useStore } from "@/stores/store";
import { fetchVisFacets, renameFacet, suggestFacetLabels } from "@/api/client";
import type { FacetData } from "@/types";
import { ChartSkeleton } from "@/shared/ui";

const FACET_COLORS = [
  "#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6",
  "#ec4899", "#06b6d4", "#84cc16", "#f97316", "#6366f1",
];

type LoadState = "idle" | "loading" | "error" | "success";

interface FacetExplorerTabProps {
  projectId: string;
}

export default function FacetExplorerTab({ projectId }: FacetExplorerTabProps) {
  const selectedVisCodeId = useStore((s) => s.selectedVisCodeId);
  const setSelectedVisCodeId = useStore((s) => s.setSelectedVisCodeId);
  const visRefreshCounter = useStore((s) => s.visRefreshCounter);
  const [facets, setFacets] = useState<FacetData[]>([]);
  const [state, setState] = useState<LoadState>("idle");
  const [suggesting, setSuggesting] = useState(false);

  useEffect(() => {
    setState("loading");
    fetchVisFacets(projectId, selectedVisCodeId)
      .then((d) => { setFacets(d.facets); setState("success"); })
      .catch(() => setState("error"));
  }, [projectId, selectedVisCodeId, visRefreshCounter]);

  // Group by facet (not code) for per-facet color series
  const byFacet = facets.reduce<
    Record<string, { points: { x: number; y: number; facet: string; text: string }[] }>
  >((acc, f) => {
    const key = f.facet_label;
    if (!acc[key]) acc[key] = { points: [] };
    acc[key].points.push(
      ...f.segments.map((s) => ({
        x: s.tsne_x,
        y: s.tsne_y,
        facet: f.facet_label,
        text: s.text_preview,
      }))
    );
    return acc;
  }, {});

  const facetCountData = facets.map((f) => ({
    name: f.facet_label,
    count: f.segment_count,
    avg_sim: f.avg_similarity != null ? Math.round(f.avg_similarity * 100) : null,
  }));

  const handleSuggestLabels = async () => {
    if (!selectedVisCodeId) return;
    setSuggesting(true);
    try {
      const result = await suggestFacetLabels(projectId, selectedVisCodeId);
      setFacets(result.facets as FacetData[]);
    } catch (err) {
      console.error(err);
    } finally {
      setSuggesting(false);
    }
  };

  if (state === "loading" && facets.length === 0) {
    return (
      <div className="space-y-4">
        <ChartSkeleton height={400} />
        <ChartSkeleton height={100} />
      </div>
    );
  }

  if (state === "error") {
    return (
      <div className="flex flex-col items-center gap-3 py-10 text-center">
        <Layers className="w-8 h-8 text-surface-400" aria-hidden="true" />
        <p className="text-sm text-surface-500">Failed to load facet data.</p>
        <button onClick={() => setState("idle")} className="text-xs text-brand-500 underline">
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <p className="text-xs text-surface-400">
        Each dot is a coded segment. Clusters = discovered sub-themes (facets). Click a series to filter.
      </p>

      {selectedVisCodeId && (
        <button onClick={() => setSelectedVisCodeId(null)} className="text-xs text-brand-500 underline">
          ← Show all codes
        </button>
      )}

      {Object.keys(byFacet).length === 0 ? (
        <EmptyFacets />
      ) : (
        <>
          <ResponsiveContainer width="100%" height={400}>
            <ScatterChart>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="x" name="t-SNE 1" tick={{ fontSize: 10 }} />
              <YAxis dataKey="y" name="t-SNE 2" tick={{ fontSize: 10 }} />
              <ZAxis range={[40, 40]} />
              <Tooltip
                cursor={{ strokeDasharray: "3 3" }}
                content={({ payload }) => {
                  if (!payload?.length) return null;
                  const d = payload[0].payload as { facet: string; text: string };
                  return (
                    <div className="bg-white dark:bg-surface-800 border panel-border rounded p-2 text-xs max-w-xs shadow-sm">
                      <p className="font-semibold">{d.facet}</p>
                      <p className="text-surface-500 mt-1">{d.text}</p>
                    </div>
                  );
                }}
              />
              <Legend />
              {Object.entries(byFacet).map(([facetLabel, { points }], i) => (
                <Scatter
                  key={facetLabel}
                  name={facetLabel}
                  data={points}
                  fill={FACET_COLORS[i % FACET_COLORS.length]}
                />
              ))}
            </ScatterChart>
          </ResponsiveContainer>

          {/* Segment count per facet */}
          <div>
            <h4 className="text-xs font-semibold text-surface-500 uppercase tracking-wide mb-2">
              Segments per Facet
            </h4>
            <ResponsiveContainer width="100%" height={Math.max(80, facets.length * 28)}>
              <BarChart data={facetCountData} layout="vertical">
                <XAxis type="number" tick={{ fontSize: 10 }} />
                <YAxis dataKey="name" type="category" width={110} tick={{ fontSize: 10 }} />
                <Tooltip formatter={(v: number) => [v, "segments"]} />
                <Bar dataKey="count" fill="#3b82f6" radius={[0, 3, 3, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </>
      )}

      {/* Facet label list */}
      {facets.length > 0 && (
        <div className="mt-2 space-y-3">
          <h4 className="text-xs font-semibold text-surface-500 uppercase tracking-wide">
            Facet Labels (click to rename)
          </h4>
          <div className="flex flex-wrap gap-2">
            {facets.map((f, i) => (
              <FacetLabelBadge
                key={f.facet_id}
                facetId={f.facet_id}
                label={f.facet_label}
                suggestedLabel={f.suggested_label}
                labelSource={f.label_source}
                projectId={projectId}
                color={FACET_COLORS[i % FACET_COLORS.length]}
                avgSimilarity={f.avg_similarity}
                onRenamed={(newLabel) =>
                  setFacets((prev) =>
                    prev.map((x) =>
                      x.facet_id === f.facet_id
                        ? { ...x, facet_label: newLabel, label_source: "user" }
                        : x
                    )
                  )
                }
              />
            ))}
          </div>

          {selectedVisCodeId && (
            <button
              onClick={handleSuggestLabels}
              disabled={suggesting || facets.length === 0}
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
        </div>
      )}
    </div>
  );
}

// ── Sub-components ──────────────────────────────────────────────────

function FacetLabelBadge({
  facetId,
  label,
  suggestedLabel,
  labelSource,
  projectId,
  color,
  avgSimilarity,
  onRenamed,
}: {
  facetId: string;
  label: string;
  suggestedLabel: string | null;
  labelSource: "auto" | "ai" | "user";
  projectId: string;
  color: string;
  avgSimilarity: number | null;
  onRenamed: (l: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(label);

  const save = () => {
    renameFacet(projectId, facetId, value)
      .then(() => { onRenamed(value); setEditing(false); })
      .catch(console.error);
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
        />
        <button onClick={save} className="text-xs text-green-500" aria-label="Save label">✓</button>
        <button onClick={() => setEditing(false)} className="text-xs text-red-400" aria-label="Cancel">✕</button>
      </div>
    );
  }

  const isAi = labelSource === "ai";
  const tooltip = isAi
    ? "Label suggested by AI — click to rename"
    : `Click to rename${avgSimilarity != null ? ` · avg similarity ${(avgSimilarity * 100).toFixed(0)}%` : ""}`;

  return (
    <button
      type="button"
      onClick={() => setEditing(true)}
      title={tooltip}
      aria-label={`Rename facet: ${label}`}
      className="cursor-pointer flex items-center gap-1 text-xs px-2 py-1 rounded-full border hover:opacity-80 transition-opacity"
      style={{ borderColor: color, color }}
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

function EmptyFacets() {
  return (
    <div className="flex flex-col items-center gap-3 py-10 text-center">
      <Layers className="w-10 h-10 text-surface-300" aria-hidden="true" />
      <p className="text-sm font-medium text-surface-600 dark:text-surface-300">No facets yet</p>
      <p className="text-xs text-surface-400 max-w-xs">
        Facets are computed automatically after 4+ segments are coded under a single code.
      </p>
    </div>
  );
}
