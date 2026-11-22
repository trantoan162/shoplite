import path from "node:path";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "src"),
    },
  },
  test: {
    environment: "jsdom",
    setupFiles: ["./vitest.setup.ts"],
    include: ["src/**/*.test.{ts,tsx}"],
    // Nhiều test chạm file/tiến trình con (store, PID lock, stock:set); giới hạn worker để
    // không quá tải máy dev (gây "Timeout starting forks runner" và timeout test).
    maxWorkers: 4,
    css: false,
    coverage: {
      provider: "v8",
      include: ["src/**/*.{ts,tsx}"],
      exclude: ["src/**/*.test.{ts,tsx}", "src/app/**/page.tsx", "src/app/**/layout.tsx"],
    },
  },
});
