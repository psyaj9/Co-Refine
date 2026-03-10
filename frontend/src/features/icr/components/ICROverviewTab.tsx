import type { ICROverview } from "@/shared/types";
import ICRMetricCard from "./ICRMetricCard";
import { Users } from "lucide-react";

interface ICROverviewTabProps {
  overview: ICROverview;
}

export default function ICROverviewTab({ overview }: ICROverviewTabProps) {
  const { metrics, coders, n_units, n_agreements, n_disagreements, disagreement_breakdown } = overview;

  const agreementPct = n_units > 0 ? Math.round((n_agreements / n_units) * 100) : 0;

  return (
    <div className="p-4 space-y-6">
      {/* Coders */}
      <section aria-label="Project coders">
        <h3 className="text-xs font-semibold text-surface-600 dark:text-surface-300 mb-2 flex items-center gap-1.5">
          <Users size={13} aria-hidden="true" />
          Coders ({coders.length})
        </h3>
        <div className="flex flex-wrap gap-2">
          {coders.map((c) => (
            <span
              key={c.user_id}
              className="text-xs px-2.5 py-1 rounded-full bg-brand-50 dark:bg-brand-900/20 text-brand-700 dark:text-brand-300 border border-brand-100 dark:border-brand-800"
            >
              {c.display_name}
            </span>
          ))}
        </div>
      </section>

      {/* Summary bar */}
      <section aria-label="Agreement summary">
        <div className="grid grid-cols-3 divide-x panel-border rounded-lg border panel-border overflow-hidden">
          <div className="p-3 text-center bg-white dark:bg-surface-800">
            <p className="text-2xl font-bold tabular-nums text-surface-700 dark:text-surface-200">{n_units}</p>
            <p className="text-[11px] text-surface-400 mt-0.5">Total units</p>
          </div>
          <div className="p-3 text-center bg-white dark:bg-surface-800">
            <p className="text-2xl font-bold tabular-nums text-emerald-600 dark:text-emerald-400">{agreementPct}%</p>
            <p className="text-[11px] text-surface-400 mt-0.5">Agreement</p>
          </div>
          <div className="p-3 text-center bg-white dark:bg-surface-800">
            <p className="text-2xl font-bold tabular-nums text-red-500 dark:text-red-400">{n_disagreements}</p>
            <p className="text-[11px] text-surface-400 mt-0.5">Disagreements</p>
          </div>
        </div>
      </section>

      {/* Headline metrics */}
      <section aria-label="ICR metrics">
        <h3 className="text-xs font-semibold text-surface-600 dark:text-surface-300 mb-2">Headline Metrics</h3>
        <div className="grid grid-cols-2 gap-3">
          <ICRMetricCard label="Krippendorff's α" metric={metrics.krippendorffs_alpha} description="handles missing data" />
          <ICRMetricCard label="Fleiss' κ" metric={metrics.fleiss_kappa} description="N coders" />
          <ICRMetricCard label="Gwet's AC₁" metric={metrics.gwets_ac1} description="paradox-resistant" />
          <ICRMetricCard label="Percent Agreement" metric={metrics.percent_agreement} description="naïve" />
        </div>
      </section>

      {/* Pairwise kappa */}
      {metrics.pairwise_cohens_kappa.length > 0 && (
        <section aria-label="Pairwise Cohen's kappa">
          <h3 className="text-xs font-semibold text-surface-600 dark:text-surface-300 mb-2">Pairwise Cohen's κ</h3>
          <ul className="space-y-1.5">
            {metrics.pairwise_cohens_kappa.map((pk) => (
              <li key={`${pk.coder_a_id}-${pk.coder_b_id}`}
                className="flex items-center gap-2 text-xs p-2 rounded border panel-border bg-white dark:bg-surface-800">
                <span className="font-medium text-surface-700 dark:text-surface-200">
                  {pk.coder_a_name}
                </span>
                <span className="text-surface-400">↔</span>
                <span className="font-medium text-surface-700 dark:text-surface-200">
                  {pk.coder_b_name}
                </span>
                <span className="ml-auto font-bold tabular-nums text-brand-600 dark:text-brand-400">
                  {pk.score !== null ? pk.score.toFixed(3) : "—"}
                </span>
                <span className="text-surface-400 italic">{pk.interpretation}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Disagreement breakdown */}
      <section aria-label="Disagreement breakdown">
        <h3 className="text-xs font-semibold text-surface-600 dark:text-surface-300 mb-2">Disagreement Breakdown</h3>
        <ul className="space-y-1">
          {(Object.entries(disagreement_breakdown) as [string, number][]).map(([type, count]) => (
            <li key={type} className="flex items-center justify-between text-xs px-2 py-1 rounded bg-surface-50 dark:bg-surface-800">
              <span className="text-surface-600 dark:text-surface-300 capitalize">{type.replace("_", " ")}</span>
              <span className="font-semibold text-surface-700 dark:text-surface-200 tabular-nums">{count}</span>
            </li>
          ))}
        </ul>
      </section>

      {overview.n_coders < 2 && (
        <div className="rounded-md bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 p-3 text-xs text-amber-700 dark:text-amber-300">
          At least 2 coders are required to compute ICR statistics. Invite a collaborator via Settings → Members.
        </div>
      )}
    </div>
  );
}
