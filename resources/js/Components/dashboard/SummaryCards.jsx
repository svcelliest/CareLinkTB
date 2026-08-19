import { Link } from "@inertiajs/react";

export default function SummaryCards({ cards }) {
    return (
        <div className="dashboard-summary-grid">
            {cards.map(({ label, value, subtext, href, Icon, tone }) => (
                <Link
                    href={href}
                    className={`dashboard-summary-card dashboard-summary-card-${tone}`}
                    key={label}
                >
                    <span className="dashboard-summary-icon" aria-hidden="true">
                        <Icon />
                    </span>
                    <div className="dashboard-summary-copy">
                        <span>{label}</span>
                        <strong>{value}</strong>
                        {subtext && <small>{subtext}</small>}
                    </div>
                </Link>
            ))}
        </div>
    );
}
