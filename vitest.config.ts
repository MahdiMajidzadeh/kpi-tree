import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  resolve: {
    alias: {
      "@kti/schema": path.resolve(__dirname, "packages/schema/src/index.ts"),
      "@kti/linter": path.resolve(__dirname, "packages/linter/src/index.ts"),
      "@": path.resolve(__dirname, "apps/web/src"),
    },
  },
  test: {
    include: [
      "packages/*/src/**/*.test.ts",
      "apps/web/src/**/*.test.ts",
    ],
    environment: "node",
    passWithNoTests: true,
  },
});
