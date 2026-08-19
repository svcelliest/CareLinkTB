import { useEffect } from "react";

export function useReveal() {
    useEffect(() => {
        const els = document.querySelectorAll(".reveal");
        if (!("INtersectionObserver" in window)) {
            els.forEach((el) => el.classList.add("visible"));
            return;
        }
        const observer = new IntersectionObserver(
            (entries) => {
                entries.forEach((entry) => {
                    if (entry.isIntersecting) {
                        entry.target.classList.add("visible");
                        observer.unobserve(entry.target);
                    }
                });
            },
            {
                threshold: 0.12,
            },
        );
        els.forEach((el) => observer.observe(el));
        return () => observer.disconnect();
    }, []);
}
