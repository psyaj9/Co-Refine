/**
 * Re-export shim — preserves the existing import path `@/stores/store`
 * while the store implementation now lives in `@/shared/store`.
 *
 * All consumers can continue importing from `@/stores/store` unchanged.
 * Migrate to `@/shared/store` incrementally during the folder restructure (Phase 2).
 */
export { useStore, type AppState } from "@/shared/store";
