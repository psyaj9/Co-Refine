import { Monitor } from "lucide-react";

/**
 * Shown on viewports narrower than 768 px.
 * Overlays the entire app; hidden via CSS at ≥ md.
 */
export default function MobileDisclaimer() {
  return (
    <div
      className="fixed inset-0 z-[200] flex md:hidden items-center justify-center bg-surface-50 dark:bg-surface-900 p-6"
      role="alert"
    >
      <div className="max-w-sm text-center space-y-4">
        <Monitor
          size={48}
          className="mx-auto text-brand-500"
          aria-hidden
        />
        <h2 className="text-xl font-bold text-surface-700 dark:text-surface-100">
          Desktop Required
        </h2>
        <p className="text-sm text-surface-500 dark:text-surface-400 leading-relaxed">
          Co-Refine is a qualitative research coding tool designed for desktop
          screens. Please switch to a device with a viewport width of at
          least&nbsp;768&nbsp;px for the best experience.
        </p>
      </div>
    </div>
  );
}
