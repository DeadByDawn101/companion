export type AppVariant = "consumer" | "openclaw";

const rawVariant = (import.meta.env.VITE_APP_VARIANT || "openclaw").toLowerCase();
export const APP_VARIANT: AppVariant = rawVariant === "consumer" ? "consumer" : "openclaw";

export const BRAND_NAME = import.meta.env.VITE_BRAND_NAME || "Camila";
export const BRAND_TAGLINE =
  import.meta.env.VITE_BRAND_TAGLINE || "Claude-grade flow, Camila identity.";

export const IS_OPENCLAW_VARIANT = APP_VARIANT === "openclaw";
