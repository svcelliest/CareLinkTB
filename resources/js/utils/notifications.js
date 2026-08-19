export function formatNotificationTime(value) {
    if (!value) return "";

    const date = new Date(value);
    const seconds = Math.round((date.getTime() - Date.now()) / 1000);
    const formatter = new Intl.RelativeTimeFormat("en", { numeric: "auto" });
    const ranges = [
        [60, "second"],
        [60, "minute"],
        [24, "hour"],
        [7, "day"],
    ];
    let amount = seconds;

    for (const [limit, unit] of ranges) {
        if (Math.abs(amount) < limit) {
            return formatter.format(amount, unit);
        }

        amount = Math.round(amount / limit);
    }

    return date.toLocaleDateString("en", {
        month: "short",
        day: "numeric",
        year: date.getFullYear() === new Date().getFullYear() ? undefined : "numeric",
    });
}
