import { router } from "@inertiajs/react";
import { useEffect } from "react";

/**
 * Re-fetches the named Inertia props on an interval.
 *
 * Inbox threads, unread counts, and program status all change on the server
 * while a page sits open, so a page left alone would otherwise keep showing a
 * stale conversation list. This asks only for the props that carry the live
 * data, so filters, search text, scroll position, and every other bit of page
 * state survive the refresh.
 *
 * Polling pauses while the tab is hidden, so a backgrounded page costs nothing.
 *
 * @param {string[]} only     Prop names to re-fetch.
 * @param {number} intervalMs How often to poll, in milliseconds.
 */
export function useLivePoll(only, intervalMs = 45000) {
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
