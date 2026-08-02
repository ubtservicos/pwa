import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
    hmr: {
      overlay: false,
    },
  },
  plugins: [react(), mode === "development" && componentTagger()].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
    dedupe: ["react", "react-dom", "react/jsx-runtime", "react/jsx-dev-runtime", "@tanstack/react-query", "@tanstack/query-core"],
  },
  build: {
    sourcemap: true,
    chunkSizeWarningLimit: 1000,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes("node_modules")) {
            const normalizedPath = id.replace(/\\/g, "/");
            const parts = normalizedPath.split("/node_modules/");
            const packagePath = parts[parts.length - 1];
            let packageName = "";
            if (packagePath.startsWith("@")) {
              const scopeParts = packagePath.split("/");
              packageName = scopeParts.slice(0, 2).join("/");
            } else {
              packageName = packagePath.split("/")[0];
            }

            // Core React runtime packages and routing/state management
            if (
              packageName === "react" ||
              packageName === "react-dom" ||
              packageName === "react-router" ||
              packageName === "react-router-dom" ||
              packageName === "@remix-run/router" ||
              packageName === "scheduler" ||
              packageName.includes("tanstack")
            ) {
              return "vendor-core";
            }

            // UI library components and icons
            if (
              packageName.includes("radix-ui") ||
              packageName === "lucide-react" ||
              packageName === "framer-motion"
            ) {
              return "vendor-ui";
            }

            // Maps and location services
            if (packageName.includes("leaflet")) {
              return "vendor-maps";
            }

            // Charts and data visualization libraries
            if (packageName === "recharts" || packageName.includes("d3")) {
              return "vendor-charts";
            }

            // Supabase client and integrations
            if (packageName.includes("supabase")) {
              return "vendor-supabase";
            }

            // Fallback for all other third-party dependencies
            return "vendor-libs";
          }
        },
      },
    },
  },
}));
