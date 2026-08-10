import { defineConfig } from "vite";

// RBXFlow is a fully static, backend-free app. `base: "./"` makes the built
// bundle work when served from any subpath (GitHub Pages, S3, file host, …).
export default defineConfig({
  base: "./",
  build: {
    target: "es2021",
    outDir: "dist",
    sourcemap: true,
  },
});
