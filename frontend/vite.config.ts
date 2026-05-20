import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import { defineConfig } from "vite-plus";
import viteReact from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { nitro } from "nitro/vite";

export default defineConfig({
  fmt: {},
  lint: { options: { typeAware: true, typeCheck: true } },
  server: {
    port: 3000,
  },
  resolve: {
    tsconfigPaths: true,
  },
  plugins: [
    tailwindcss(),
    tanstackStart({
      srcDirectory: "src",
      spa: {
        enabled: true,
        maskPath: "/",
        prerender: {
          enabled: true,
          outputPath: "/index",
          crawlLinks: false,
          retryCount: 0,
        },
      },
    }),
    viteReact(),
    nitro(),
  ],
});
