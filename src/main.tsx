import { createRoot } from "react-dom/client";
import * as Sentry from "@sentry/react";
import App from "./App.tsx";
import "./index.css";

// Sentry telemetry neutralized until production DSNs are definitively provisioned
// to avoid client-side 403 Forbidden errors in the console.
/*
try {
  const sentryDsn = import.meta.env.VITE_SENTRY_DSN;
  if (sentryDsn && typeof sentryDsn === "string" && sentryDsn.startsWith("http")) {
    Sentry.init({
      dsn: sentryDsn,
      integrations: [
        Sentry.browserTracingIntegration(),
        Sentry.replayIntegration(),
      ],
      tracesSampleRate: 0.1,
      replaysSessionSampleRate: 0.0,
      replaysOnErrorSampleRate: 0.5,
      environment: import.meta.env.MODE || "production",
      beforeSend(event) {
        try {
          return event;
        } catch {
          return null;
        }
      },
    });
  }
} catch (sentryInitError) {
  console.warn("[Sentry] Telemetry initialization bypassed:", sentryInitError);
}
*/

createRoot(document.getElementById("root")!).render(<App />);
