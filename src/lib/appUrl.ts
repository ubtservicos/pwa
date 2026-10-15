export function getAppOrigin(): string {
  const configured = String(import.meta.env.VITE_APP_URL || "").trim().replace(/\/$/, "");
  if (configured) return configured;
  if (typeof window !== "undefined") return window.location.origin;
  return "";
}
