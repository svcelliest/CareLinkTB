import { useState, useEffect } from "react";

export function useScrollSpy(sectionIds) {
    const [activeSection, setActiveSection] = useState("");
    const [scrolled, setScrolled] = useState(false);

    useEffect(() => {
        const onScroll = () => {
            setScrolled(window.scrollY > 40);
            let current = "";
            sectionIds.forEach((id) => {
                const el = document.getElementById(id);
                if (el && el.getBoundingClientRect().top <= 120) current = id;
            });
            setActiveSection(current);
        };
        window.addEventListener("scroll", onScroll, { passive: true });
        onScroll();
        return () => window.removeEventListener("scroll", onScroll);
    }, [sectionIds]);

    return { activeSection, scrolled };
}
