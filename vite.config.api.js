import { defineConfig } from "vite";
import path from "path";

export default defineConfig({
  build: {
    outDir: "dist/api",
    lib: {
      entry: {
        // Cron jobs
        "cron/hourly": "api/cron/hourly.ts",

        // Main API routes
        "arbitrage-opportunities": "api/arbitrage-opportunities.ts",
        dashboard: "api/dashboard.ts",
        markets: "api/markets.ts",
        "opportunity-markets": "api/opportunity-markets.ts",
      },
      formats: ["cjs"], // CommonJS for Node.js
    },
    rollupOptions: {
      external: [
        // Mark Node.js built-ins as external
        "fs",
        "path",
        "http",
        "https",
        "crypto",
        "stream",
        "util",
        "url",
        "querystring",
        // Add other dependencies that should be external
      ],
      output: {
        entryFileNames: "[name].js",
        format: "cjs",
      },
    },
    target: "node18",
    minify: false,
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
