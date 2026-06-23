import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

export default defineConfig({
  test: {
    environment: "node",
    include: ["lib/**/*.test.ts"],
  },
  resolve: {
    // ESM-safe (no __dirname). Phase-1 tests use relative imports, but this
    // keeps "@/..." working for future tests.
    alias: { "@": fileURLToPath(new URL(".", import.meta.url)) },
  },
});
