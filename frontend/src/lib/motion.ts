import type { Variants, Transition } from "framer-motion";

/**
 * Shared Framer Motion variant definitions.
 * Keep animation specs DRY — import these from components instead of inlining.
 */

/* ---- Timing presets ---- */
export const springSnappy: Transition = { type: "spring", stiffness: 500, damping: 30 };
export const springGentle: Transition = { type: "spring", stiffness: 300, damping: 25 };
export const easeFast: Transition = { duration: 0.15, ease: "easeOut" };
export const easeMedium: Transition = { duration: 0.2, ease: "easeOut" };

/* ---- Fade in/out ---- */
export const fadeIn: Variants = {
  initial: { opacity: 0 },
  animate: { opacity: 1 },
  exit: { opacity: 0 },
};

/* ---- Slide from left (panel expand) ---- */
export const slideInLeft: Variants = {
  initial: { opacity: 0, x: -12 },
  animate: { opacity: 1, x: 0 },
  exit: { opacity: 0, x: -12 },
};

/* ---- Slide from right (alert cards) ---- */
export const slideInRight: Variants = {
  initial: { opacity: 0, x: 24 },
  animate: { opacity: 1, x: 0 },
  exit: { opacity: 0, x: 24 },
};

/* ---- Scale + fade (popover) ---- */
export const scaleIn: Variants = {
  initial: { opacity: 0, scale: 0.95, y: 4 },
  animate: { opacity: 1, scale: 1, y: 0 },
  exit: { opacity: 0, scale: 0.95, y: 4 },
};

/* ---- List item stagger ---- */
export const listContainer: Variants = {
  animate: {
    transition: { staggerChildren: 0.03 },
  },
};

export const listItem: Variants = {
  initial: { opacity: 0, y: 6 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -6, transition: { duration: 0.15 } },
};

/* ---- Chat message bubble ---- */
export const chatBubble: Variants = {
  initial: { opacity: 0, y: 8 },
  animate: { opacity: 1, y: 0 },
};

/* ---- Collapsible height animation ---- */
export const collapsible: Variants = {
  open: { height: "auto", opacity: 1 },
  closed: { height: 0, opacity: 0 },
};

/* ---- Tab content cross-fade ---- */
export const tabContent: Variants = {
  initial: { opacity: 0, y: 2 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -2 },
};

/* ---- Micro-interactions for interactive cards ---- */
export const hoverLift = {
  whileHover: { scale: 1.015, transition: { duration: 0.15 } },
  whileTap: { scale: 0.985, transition: { duration: 0.1 } },
};
