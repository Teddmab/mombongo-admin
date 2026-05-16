import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  plugins: [react()],
  resolve: { alias: { "@": path.resolve(__dirname, "./src") } },
  test: {
    name: "integration",
    environment: "node",
    globals: true,
    setupFiles: ["src/test/setup.integration.ts"],
    include: ["src/**/__tests__/**/*.integration.test.ts"],
    passWithNoTests: true,
    testTimeout: 30000,
  },
});