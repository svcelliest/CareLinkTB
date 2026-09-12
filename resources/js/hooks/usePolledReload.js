import { router } from "@inertiajs/react";
import { useEffect } from "react";

/**
 * Re-fetches the named Inertia props on an interval.
 *
 * Program status is derived on the server from the schedule, so it changes on
 * its own when the scheduled date arrives — a page left open overnight would
 * otherwise keep showing "Upcoming" for a program that is already running.
 * This asks only for the props that carry it, so filters, search text, scroll
 * position, and every other bit of page state survive the refresh.
 *
 * Polling pauses while the tab is hidden, so a backgrounded dashboard costs
 * nothing.
 *
 * @param {string[]} only     Prop names to re-fetch.
 * @param {number} intervalMs How often to poll, in milliseconds.
 */
export function usePolledReload(only, intervalMs = 45000) {
    // Joined so a fresh array literal on every render does not restart the
    // timer; the effect only re-runs when the prop names actually change.
    const props = only.join(",");

    useEffect(() => {
        if (!props) return undefined;

        const timer = window.setInterval(() => {
            if (document.hidden) return;

            router.reload({
                only: props.split(","),
                preserveScroll: true,
                preserveState: true,
            });
        }, intervalMs);

        return () => window.clearInterval(timer);
    }, [props, intervalMs]);
}
