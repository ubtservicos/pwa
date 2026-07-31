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
    chunkSizeWarningLimit: 1000,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes("node_modules")) {
            if (
              id.includes("react-dom") ||
              id.includes("react-router-dom") ||
              id.includes("@tanstack") ||
              id.includes("/react/") ||
              id.includes("\\react\\")
            ) {
              return "vendor-core";
            }
            if (id.includes("lucide-react") || id.includes("@radix-ui") || id.includes("framer-motion")) {
              return "vendor-ui";
            }
            if (id.includes("leaflet")) {
              return "vendor-maps";
            }
            if (id.includes("recharts") || id.includes("d3-")) {
              return "vendor-charts";
            }
            if (id.includes("@supabase")) {
              return "vendor-supabase";
            }
            return "vendor-libs";
          }
        },
      },
    },
  },
}));
