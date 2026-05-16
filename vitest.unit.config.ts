import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react-swc";
import path from "path";

export default defineConfig({
  plugins: [react()],
  resolve: { alias: { "@": path.resolve(__dirname, "./src") } },
  test: {
    name: "unit",
    environment: "jsdom",
    globals: true,
    setupFiles: ["src/test/setup.unit.ts"],
    include: ["src/**/__tests__/**/*.test.ts", "src/**/__tests__/**/*.test.tsx"],
    exclude: ["src/**/__tests__/**/*.integration.test.ts"],
    passWithNoTests: true,
    coverage: { provider: "v8", reporter: ["text", "html"] },
  },
});