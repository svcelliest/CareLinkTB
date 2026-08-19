import { defineConfig } from "vite";
import laravel from "laravel-vite-plugin";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
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
                ? { usePolling: true }
                : undefined,
    },
});
