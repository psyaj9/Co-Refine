import { forwardRef } from "react";
import { cn } from "@/lib/utils";

const VARIANT_CLASSES: Record<string, string> = {
  ghost:
    "hover:bg-surface-100 dark:hover:bg-surface-800 text-surface-400",
  overlay:
    "hover:bg-black/20 transition-colors",
  danger:
    "text-surface-300 dark:text-surface-600 hover:text-red-500 transition-colors",
};

const SIZE_CLASSES: Record<string, string> = {
  xs: "p-0.5",
  sm: "p-1",
  md: "p-1.5",
};

interface IconButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: keyof typeof VARIANT_CLASSES;
  size?: "xs" | "sm" | "md";
  rounded?: "full" | "md";
  "aria-label": string;
  children: React.ReactNode;
}

/**
 * Shared icon-only button atom.
 * Requires `aria-label` for accessibility (WCAG AA).
 */
const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(
  function IconButton(
    { variant = "ghost", size = "sm", rounded = "md", className, children, ...rest },
    ref,
  ) {
    return (
      <button
        ref={ref}
        className={cn(
          "inline-flex items-center justify-center",
          rounded === "full" ? "rounded-full" : "rounded",
          SIZE_CLASSES[size],
          VARIANT_CLASSES[variant],
          className,
        )}
        {...rest}
      >
        {children}
      </button>
    );
  },
);

export default IconButton;
