import { cn } from "@/lib/utils";

const VARIANT_CLASSES: Record<string, string> = {
  default:
    "bg-surface-100 text-surface-600 dark:bg-surface-800 dark:text-surface-300",
  success:
    "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
  warning:
    "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
  danger:
    "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
  info:
    "bg-brand-100 text-brand-700 dark:bg-brand-900/30 dark:text-brand-400",
  violet:
    "bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400",
  sky:
    "bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-400",
};

const SIZE_CLASSES: Record<string, string> = {
  xs: "text-2xs px-1.5 py-0.5",
  sm: "text-[11px] px-2 py-0.5",
};

interface BadgeProps {
  variant?: keyof typeof VARIANT_CLASSES;
  size?: "xs" | "sm";
  rounded?: "full" | "md";
  className?: string;
  style?: React.CSSProperties;
  children: React.ReactNode;
}

/**
 * Shared pill/badge atom.
 * Use `style` for dynamic code colours, `variant` for semantic presets.
 */
export default function Badge({
  variant = "default",
  size = "xs",
  rounded = "md",
  className,
  style,
  children,
}: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 font-medium",
        SIZE_CLASSES[size],
        rounded === "full" ? "rounded-full" : "rounded",
        VARIANT_CLASSES[variant],
        className,
      )}
      style={style}
    >
      {children}
    </span>
  );
}
