import { usePoll } from "@inertiajs/react";

const DEFAULT_INTERVAL = 15000;

export function useLivePoll(only, interval = DEFAULT_INTERVAL, options = {}) {
    return usePoll(interval, {
        only,
        preserveScroll: true,
        preserveState: true,
        ...options,
    });
}
