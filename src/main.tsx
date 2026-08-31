import { createRoot } from "react-dom/client";
import * as Sentry from "@sentry/react";
import App from "./App.tsx";
import "./index.css";

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
  // Silent fallback so telemetry issues (e.g. 403 Forbidden on ingest) never break app loading or thread
  console.warn("[Sentry] Telemetry initialization bypassed:", sentryInitError);
}

createRoot(document.getElementById("root")!).render(<App />);
