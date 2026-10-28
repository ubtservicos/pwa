import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

// Dynamic PWA Manifest Plugin
function dynamicManifestPlugin() {
  const manifestData = {
    short_name: "UBT",
    name: "UBT — O Superapp do Trabalhador",
    icons: [
      {
        src: "/favicon.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any maskable"
      },
      {
        src: "/pwa-192x192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any maskable"
      },
      {
        src: "/pwa-512x512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any maskable"
      }
    ],
    start_url: "/?source=pwa",
    scope: "/",
    id: "/?source=pwa",
    background_color: "#0B1B3E",
    theme_color: "#0B1B3E",
    display: "standalone",
    orientation: "portrait"
  };

  return {
    name: "dynamic-pwa-manifest",
    configureServer(server: any) {
      server.middlewares.use((req: any, res: any, next: any) => {
        if (req.url && (req.url.startsWith("/manifest-prod-v2.json") || req.url.startsWith("/manifest.json"))) {
          res.setHeader("Content-Type", "application/json");
          res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
          res.end(JSON.stringify(manifestData, null, 2));
          return;
        }
        next();
      });
    },
    generateBundle(this: any) {
      this.emitFile({
        type: "asset",
        fileName: "manifest-prod-v2.json",
        source: JSON.stringify(manifestData, null, 2),
      });
      this.emitFile({
        type: "asset",
        fileName: "manifest.json",
        source: JSON.stringify(manifestData, null, 2),
      });
    }
  };
}

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
    hmr: {
      overlay: false,
    },
  },
  plugins: [
    react(),
    dynamicManifestPlugin(),
    mode === "development" && componentTagger()
  ].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
    dedupe: ["react", "react-dom", "react/jsx-runtime", "react/jsx-dev-runtime", "@tanstack/react-query", "@tanstack/query-core"],
  },
  build: {
    target: 'es2022',
    commonjsOptions: { transformMixedEsModules: true },
    rollupOptions: {
      output: {
        manualChunks: undefined,
        entryFileNames: 'assets/[name]-[hash].js',
        chunkFileNames: 'assets/[name]-[hash].js',
        assetFileNames: 'assets/[name]-[hash].[ext]'
      }
    }
  },
}));
