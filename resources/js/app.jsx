import "../css/app.css";

import { createInertiaApp } from "@inertiajs/react";
import { resolvePageComponent } from "laravel-vite-plugin/inertia-helpers";
import { createRoot } from "react-dom/client";
import { ThemeProvider, createTheme } from "@mui/material/styles";
import { ToastProvider } from "@/Components/ui/Toast";

const appName = import.meta.env.VITE_APP_NAME || "Laravel";

const theme = createTheme({
    palette: {
        primary: { main: "#d94f4f" },
    },
    typography: {
        fontFamily: '"DM Sans", sans-serif',
        h1: { fontFamily: '"DM Serif Display", serif' },
        h2: { fontFamily: '"DM Serif Display", serif' },
    },
});

createInertiaApp({
    title: (title) => `${title} - ${appName}`,
    resolve: (name) =>
        resolvePageComponent(
            `./Pages/${name}.jsx`,
            import.meta.glob("./Pages/**/*.jsx"),
        ),
    setup({ el, App, props }) {
        const root = createRoot(el);

        root.render(
            // Above <App> so every page and layout is below the provider. A
            // page renders its own DashboardLayout as a child, so mounting
            // the provider inside the layout would put it below the pages
            // that call useToast() and every toast would go nowhere.
            <ThemeProvider theme={theme}>
                <ToastProvider>
                    <App {...props} />
                </ToastProvider>
            </ThemeProvider>,
        );
    },
    // Inertia's own top progress bar: shown when a visit starts, removed when
    // it settles. Only the colour is set — the default grey read as a stray
    // browser element rather than part of the portal.
    progress: {
        color: "#d94f4f",
        includeCSS: true,
        showSpinner: false,
    },
});
