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
} from "recharts";
import { useStore } from "@/stores/store";

const FACET_COLORS = ["#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6"];

interface FacetData {
  facet_id: string;
  facet_label: string;
  code_id: string;
  code_name: string;
  segment_count: number;
  segments: {
    segment_id: string;
    tsne_x: number;
    tsne_y: number;
    similarity_score: number;
    text_preview: string;
  }[];
}

export default function FacetExplorerTab({ projectId }: { projectId: string }) {
  const selectedVisCodeId = useStore((s) => s.selectedVisCodeId);
  const setSelectedVisCodeId = useStore((s) => s.setSelectedVisCodeId);
  const [facets, setFacets] = useState<FacetData[]>([]);

  useEffect(() => {
    const url = selectedVisCodeId
      ? `/api/projects/${projectId}/vis/facets?code_id=${selectedVisCodeId}`
      : `/api/projects/${projectId}/vis/facets`;
    fetch(url)
      .then((r) => r.json())
      .then((d) => setFacets(d.facets || []))
      .catch(console.error);
  }, [projectId, selectedVisCodeId]);

  // Group facets by code for multi-series scatter
  const byCode = facets.reduce<Record<string, { points: { x: number; y: number; facet: string; text: string }[]; codeId: string }>>(
    (acc, f) => {
      if (!acc[f.code_name]) {
        acc[f.code_name] = { points: [], codeId: f.code_id };
      }
      acc[f.code_name].points.push(
        ...f.segments.map((s) => ({
          x: s.tsne_x,
          y: s.tsne_y,
          facet: f.facet_label,
          text: s.text_preview,
        }))
      );
      return acc;
    },
    {}
  );

  return (
    <div className="space-y-4">
      <p className="text-xs text-surface-400">
        Each dot is a coded segment. Clusters = discovered facets. Click a code series to filter.
      </p>

      {selectedVisCodeId && (
        <button
          onClick={() => setSelectedVisCodeId(null)}
          className="text-xs text-brand-500 underline"
        >
          ← Show all codes
        </button>
      )}

      {Object.keys(byCode).length === 0 ? (
        <p className="text-xs text-surface-400">
          No facet data yet. Facets are computed automatically after 4+ segments are coded under a code.
        </p>
      ) : (
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
            {Object.entries(byCode).map(([codeName, { points, codeId }], i) => (
              <Scatter
                key={codeName}
                name={codeName}
                data={points}
                fill={FACET_COLORS[i % FACET_COLORS.length]}
                onClick={() => setSelectedVisCodeId(codeId)}
                style={{ cursor: "pointer" }}
              />
            ))}
          </ScatterChart>
        </ResponsiveContainer>
      )}

      {/* Facet label list for renaming */}
      {facets.length > 0 && (
        <div className="mt-4">
          <h4 className="text-xs font-semibold text-surface-500 uppercase tracking-wide mb-2">
            Facet Labels (click to rename)
          </h4>
          <div className="flex flex-wrap gap-2">
            {facets.map((f) => (
              <FacetLabelBadge
                key={f.facet_id}
                facetId={f.facet_id}
                label={f.facet_label}
                projectId={projectId}
                onRenamed={(newLabel) =>
                  setFacets((prev) =>
                    prev.map((x) =>
                      x.facet_id === f.facet_id ? { ...x, facet_label: newLabel } : x
                    )
                  )
                }
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function FacetLabelBadge({
  facetId,
  label,
  projectId,
  onRenamed,
}: {
  facetId: string;
  label: string;
  projectId: string;
  onRenamed: (l: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(label);

  const save = () => {
    fetch(`/api/projects/${projectId}/vis/facets/${facetId}/label`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ label: value }),
    })
      .then(() => {
        onRenamed(value);
        setEditing(false);
      })
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
        <button onClick={save} className="text-xs text-green-500" aria-label="Save label">
          ✓
        </button>
        <button
          onClick={() => setEditing(false)}
          className="text-xs text-red-400"
          aria-label="Cancel"
        >
          ✕
        </button>
      </div>
    );
  }

  return (
    <span
      onClick={() => setEditing(true)}
      className="cursor-pointer text-xs bg-brand-50 dark:bg-brand-900/20 text-brand-700 dark:text-brand-300 px-2 py-1 rounded-full border border-brand-200 dark:border-brand-700 hover:bg-brand-100 dark:hover:bg-brand-900/30 transition-colors"
    >
      {label}
    </span>
  );
}
