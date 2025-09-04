import type { Config } from "@react-router/dev/config";

export default {
  appDirectory: "./src/app",
  ssr: true,
  prerender: ["/", "/callback", "/qa-runner"], // ✅ explicit
  buildDirectory: "build",
} satisfies Config;
