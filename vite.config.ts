import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";
import runtimeErrorOverlay from "@replit/vite-plugin-runtime-error-modal";
// Self-signed HTTPS for local dev — required by Meta's FB JavaScript SDK,
// which refuses to call `FB.login` from HTTP origins. Production deploys
// behind Firebase/Cloud Run already serve HTTPS so this plugin is a no-op
// outside `npm run dev`.
import basicSsl from "@vitejs/plugin-basic-ssl";

export default defineConfig(async ({ mode }) => {
  // loadEnv reads from import.meta.dirname (= d:\Ezconn\frontend\) regardless of
  // the `root` option so frontend\.env is always found.
  const env = loadEnv(mode, import.meta.dirname, "");
  // Trim: .env values on Windows can carry a trailing \r (CRLF),
  // and copy-paste sometimes leaves whitespace on the value. If that
  // gets injected into the inline <script>window.__API_BASE_URL__="…"</script>
  // tag, an unescaped newline inside the string literal throws a
  // JavaScript SyntaxError at page load — the app never boots, so any
  // downstream flow (e.g. the WhatsApp onboard return page) silently
  // never runs its POST to the backend. Trimming here is the root fix.
  const apiBaseUrl = (env.VITE_API_BASE_URL || "").trim();

  return {
    plugins: [
      react(),
      basicSsl(),
      runtimeErrorOverlay(),
      // Replace __API_BASE_URL__ placeholder in index.html with the actual value.
      // index.html is served with Cache-Control: no-cache on Firebase, so this is
      // always fresh — even when the JS bundle is served from browser cache.
      {
        name: "inject-api-base-url",
        transformIndexHtml(html: string) {
          return html.replace(/__BACKEND_URL__/g, apiBaseUrl);
        },
      },
      ...(process.env.NODE_ENV !== "production" &&
        process.env.REPL_ID !== undefined
        ? [
          await import("@replit/vite-plugin-cartographer").then((m) =>
            m.cartographer(),
          ),
          await import("@replit/vite-plugin-dev-banner").then((m) =>
            m.devBanner(),
          ),
        ]
        : []),
    ],
    resolve: {
      alias: {
        "@": path.resolve(import.meta.dirname, "client", "src"),
        "@shared": path.resolve(import.meta.dirname, "shared"),
        "@assets": path.resolve(import.meta.dirname, "attached_assets"),
      },
    },
    root: path.resolve(import.meta.dirname, "client"),
    envDir: import.meta.dirname,
    build: {
      outDir: path.resolve(import.meta.dirname, "dist/public"),
      emptyOutDir: true,
    },
    server: {
      host: true,
      allowedHosts: ["localhost", "agency.localhost", ".laglobal.local", ".ezconn.com", ".agentawk.com"],
      fs: {
        strict: true,
        deny: ["**/.*"],
      },
      proxy: {
        "/api": {
          target: "http://127.0.0.1:3001",
          changeOrigin: true,
          secure: false,
          rewrite: (path) => path.replace(/^\/api/, ""),
        },
        "/auth": {
          target: "http://127.0.0.1:3001",
          changeOrigin: true,
          secure: false,
        },
        "/uploads": {
          target: "http://127.0.0.1:3001",
          changeOrigin: true,
          secure: false,
        },
        "/socket.io": {
          target: "http://127.0.0.1:3001",
          ws: true,
          changeOrigin: true,
        },
      },
    },
  };
});
