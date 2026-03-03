import { BarChart3, Construction } from "lucide-react";

/**
 * Placeholder for the upcoming Consistency Dashboard.
 * Will host: Facet Drift Detector, Predictive Forecaster,
 * Consistency Cluster Explainer, and Reflexive Memo views.
 */
export default function ConsistencyDashboard() {
  return (
    <div className="h-full flex items-center justify-center p-8">
      <div className="text-center space-y-4 max-w-md">
        <div className="mx-auto w-14 h-14 rounded-2xl bg-brand-50 dark:bg-brand-900/20 flex items-center justify-center">
          <BarChart3
            size={28}
            className="text-brand-500 dark:text-brand-400"
            aria-hidden="true"
          />
        </div>
        <h2 className="text-fluid-lg font-bold text-surface-700 dark:text-surface-200">
          Consistency Dashboard
        </h2>
        <p className="text-fluid-sm text-surface-500 dark:text-surface-400 leading-relaxed">
          This space will host your consistency analytics — facet drift
          detection, predictive forecasting, cluster explanations, and
          reflexive memos. Start coding segments to generate data.
        </p>
        <div className="inline-flex items-center gap-1.5 text-xs text-surface-400 dark:text-surface-500 bg-surface-100 dark:bg-surface-800 rounded-full px-3 py-1">
          <Construction size={12} aria-hidden="true" />
          Coming soon
        </div>
      </div>
    </div>
  );
}
