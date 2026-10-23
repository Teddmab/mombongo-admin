import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig(({ command, mode }) => {
  // Emulator mode is for `vite` dev only (src/lib/firebaseEmulator.ts); refuse to produce a build that has it switched on.
  if (command === "build" && loadEnv(mode, process.cwd(), "VITE_").VITE_USE_FIREBASE_EMULATORS === "true")
    throw new Error("VITE_USE_FIREBASE_EMULATORS=true is not allowed in a build. Unset it before building.");

  return {
    server: {
      host: "::",
      port: 8080,
    },
    plugins: [react()],
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
      },
    },
  };
});
