import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "path";

// Routine period keys are built from the LOCAL calendar. Pin a timezone that
// is behind UTC (no DST since 2019) so tests exercise the local/UTC day
// boundary deterministically on every machine. Workers inherit this.
process.env.TZ = "America/Sao_Paulo";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  test: {
    environment: "jsdom",
    setupFiles: ["./src/test/setup.ts"],
    include: ["src/**/*.test.{ts,tsx}"],
    restoreMocks: true,
  },
});
