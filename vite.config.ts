import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "node:path";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
    },
  },
  server: {
    port: 5173,
  },
  build: {
    // 'hidden' still emits .map files (deploy.sh uploads them to Datadog for
    // RUM symbolication) but omits the //# sourceMappingURL= comment from the
    // JS, so browsers don't request maps that aren't served from S3.
    sourcemap: "hidden",
  },
});
