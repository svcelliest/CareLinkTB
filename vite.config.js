import { defineConfig } from "vite";
import laravel from "laravel-vite-plugin";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
    // Pages are resolved lazily through `import.meta.glob`, so Vite's dep
    // scanner never crawls them from the entry point. Without this it only
    // discovers react-icons and each MUI icon on the *first* navigation to a
    // page, then re-optimises and forces a full reload mid-click — which reads
    // as a multi-second stall every time you switch modules.
    optimizeDeps: {
        entries: ["resources/js/app.jsx", "resources/js/Pages/**/*.jsx"],
        include: ["react-icons/fa6", "@mui/material/styles"],
    },
    plugins: [
        laravel({
            input: ["resources/css/app.css", "resources/js/app.jsx"],
            refresh: true,
        }),
        react(),
        tailwindcss(),
    ],
    server: {
        host: process.env.VITE_SERVER_HOST ?? "localhost",
        port: 5173,
        strictPort: true,
        // The server may listen on 0.0.0.0, but browsers need a reachable
        // hostname for Vite assets and the hot-reload websocket.
        hmr: {
            host: process.env.VITE_HMR_HOST ?? "localhost",
            clientPort: Number(process.env.VITE_HMR_CLIENT_PORT ?? 5173),
        },
        watch:
            process.env.VITE_USE_POLLING === "true"
                ? {
                      usePolling: true,
                      interval: 500,
                      binaryInterval: 500,
                      // Polling re-walks every path on each tick. On the Windows
                      // bind mount that is the same slow filesystem PHP reads
                      // from, so an unscoped watcher steals I/O from Laravel and
                      // burned ~43% CPU at idle. Only resources/ is authored.
                      ignored: [
                          "**/node_modules/**",
                          "**/vendor/**",
                          "**/storage/**",
                          "**/.git/**",
                          "**/public/build/**",
                          "**/tests/**",
                      ],
                  }
                : undefined,
    },
});
