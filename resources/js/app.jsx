import "../css/app.css";

import { createInertiaApp } from "@inertiajs/react";
import { resolvePageComponent } from "laravel-vite-plugin/inertia-helpers";
import { createRoot } from "react-dom/client";
import { ThemeProvider, createTheme } from "@mui/material/styles";

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
            <ThemeProvider theme={theme}>
                <App {...props} />
            </ThemeProvider>,
        );
    },
    progress: {
        color: "#4B5563",
    },
});
