import { Eye, Info } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Perspective } from "@/types";

// Static icon mapping for known perspectives
const PERSPECTIVE_ICONS: Record<string, typeof Eye> = {
  self_consistency: Eye,
};

interface PerspectivesTabProps {
  available: Perspective[];
  localPerspectives: string[];
  onToggle: (key: string) => void;
}

export default function PerspectivesTab({
  available,
  localPerspectives,
  onToggle,
}: PerspectivesTabProps) {
  return (
    <div className="space-y-3">
      <p className="text-xs text-surface-500 dark:text-surface-400 flex items-start gap-1.5">
        <Info size={14} className="mt-0.5 shrink-0" />
        Choose which AI perspectives run during the coding audit.
        At least one must be enabled.
      </p>

      {available.map((perspective) => {
        const key = perspective.id;
        const Icon = PERSPECTIVE_ICONS[key] ?? Eye;
        const enabled = localPerspectives.includes(key);

        return (
          <button
            key={key}
            onClick={() => onToggle(key)}
            className={cn(
              "w-full flex items-start gap-3 rounded-lg border p-3 text-left transition-colors",
              enabled
                ? "border-brand-300 bg-brand-50 dark:border-brand-600 dark:bg-brand-900/20"
                : "border-surface-200 dark:border-surface-700 hover:border-surface-300 dark:hover:border-surface-600",
            )}
          >
            <div
              className={cn(
                "mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded border transition-colors",
                enabled
                  ? "border-brand-500 bg-brand-500 text-white"
                  : "border-surface-300 dark:border-surface-600",
              )}
            >
              {enabled && (
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                  <path
                    d="M2 6L5 9L10 3"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              )}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5">
                <Icon
                  size={14}
                  className={cn(
                    enabled
                      ? "text-brand-600 dark:text-brand-400"
                      : "text-surface-400",
                  )}
                />
                <span
                  className={cn(
                    "text-sm font-medium",
                    enabled
                      ? "text-brand-700 dark:text-brand-300"
                      : "text-surface-600 dark:text-surface-300",
                  )}
                >
                  {perspective.label}
                </span>
              </div>
              <p className="mt-1 text-xs text-surface-500 dark:text-surface-400 leading-relaxed">
                {perspective.description}
              </p>
            </div>
          </button>
        );
      })}
    </div>
  );
}
