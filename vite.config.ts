import path from "node:path";
import fs from "fs-extra";
import { defineConfig } from "vite";
import { reactRouter } from "@react-router/dev/vite";
import babel from "vite-plugin-babel";
import tsconfigPaths from "vite-tsconfig-paths";
import { addRenderIds } from "./plugins/addRenderIds";
import { aliases } from "./plugins/aliases";
import consoleToParent from "./plugins/console-to-parent";
import { layoutWrapperPlugin } from "./plugins/layouts";
import { loadFontsFromTailwindSource } from "./plugins/loadFontsFromTailwindSource";
import { nextPublicProcessEnv } from "./plugins/nextPublicProcessEnv";
import { restart } from "./plugins/restart";
import { restartEnvFileChange } from "./plugins/restartEnvFileChange";
import vercel from "vite-plugin-vercel";

export default defineConfig({
  envPrefix: "NEXT_PUBLIC_",
  optimizeDeps: {
    include: ["fast-glob", "lucide-react"],
    exclude: [
      "@hono/auth-js/react",
      "@hono/auth-js",
      "@auth/core",
      "hono/context-storage",
      "@auth/core/errors",
      "fsevents",
      "lightningcss",
    ],
  },
  logLevel: "info",
  plugins: [
    reactRouter(),
    nextPublicProcessEnv(),
    restartEnvFileChange(),
    babel({
      include: ["src/**/*.{js,jsx,ts,tsx}"],
      exclude: /node_modules/,
      babelConfig: {
        babelrc: false,
        configFile: false,
        plugins: ["styled-jsx/babel"],
      },
    }),
    restart({
      restart: [
        "src/**/page.jsx",
        "src/**/page.tsx",
        "src/**/layout.jsx",
        "src/**/layout.tsx",
        "src/**/route.js",
        "src/**/route.ts",
      ],
    }),
    vercel(),
    consoleToParent(),
    loadFontsFromTailwindSource(),
    addRenderIds(),
    tsconfigPaths(),
    aliases(),
    layoutWrapperPlugin(),
    {
      name: "copy-html-to-vercel-output",
      closeBundle: async () => {
        const srcDir = path.resolve("build/client");
        const destDir = path.resolve(".vercel/output/static");

        if (fs.existsSync(srcDir)) {
          const htmlFiles = await fs.readdir(srcDir, { withFileTypes: true });
          for (const file of htmlFiles) {
            if (file.isFile() && file.name.endsWith(".html")) {
              await fs.copy(
                path.join(srcDir, file.name),
                path.join(destDir, file.name)
              );
            }
            if (file.isDirectory()) {
              const nestedHtml = path.join(srcDir, file.name, "index.html");
              if (fs.existsSync(nestedHtml)) {
                await fs.copy(
                  nestedHtml,
                  path.join(destDir, file.name, "index.html")
                );
              }
            }
          }
        }
      },
    },
  ],
  resolve: {
    alias: {
      lodash: "lodash-es",
      "npm:stripe": "stripe",
      "@auth/create/react": "@hono/auth-js/react",
      "@": path.resolve(__dirname, "src"),
    },
    dedupe: ["react", "react-dom"],
  },
  clearScreen: false,
  server: {
    allowedHosts: true,
    host: "0.0.0.0",
    port: 4000,
    hmr: { overlay: false },
    warmup: {
      clientFiles: [
        "./src/app/**/*",
        "./src/app/root.tsx",
        "./src/app/routes.ts",
      ],
    },
  },
});
