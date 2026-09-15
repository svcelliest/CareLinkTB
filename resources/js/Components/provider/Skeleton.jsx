/**
 * Shape-preserving placeholders for the provider portal. Each one mirrors the
 * dimensions of the real content it stands in for, so the layout does not
 * shift when data arrives.
 */

export function SkeletonLine({ width = "100%", height = 12, className = "" }) {
    return (
        <span
            className={`skeleton-line ${className}`.trim()}
            style={{ width, height }}
            aria-hidden="true"
        />
    );
}

export function StatCardSkeleton() {
    return (
        <div className="stat-card is-skeleton" aria-hidden="true">
            <div className="stat-card-top">
                <SkeletonLine width="72px" height={10} />
                <span className="skeleton-block stat-icon" />
            </div>
            <SkeletonLine width="56px" height={30} />
            <SkeletonLine width="120px" height={11} />
        </div>
    );
}

/**
 * The two right-column activity cards. Both stand in for a card that keeps its
 * height whether it holds a program, an empty-state line, or this placeholder,
 * so the column never resizes as the deferred props land.
 */
export function OngoingCardSkeleton() {
    return (
        <div className="ongoing-card is-skeleton" aria-hidden="true">
            <div className="ongoing-dot-row">
                <span className="skeleton-block ongoing-dot" />
                <SkeletonLine width="104px" height={12} />
            </div>
            <SkeletonLine width="70%" height={15} />
            <SkeletonLine width="50%" height={12} className="skeleton-gap-sm" />
            <div className="screened-row">
                <SkeletonLine width="104px" height={11} />
                <SkeletonLine width="28px" height={18} />
            </div>
            <SkeletonLine width="100%" height={40} className="skeleton-gap" />
        </div>
    );
}

export function UpcomingCardSkeleton() {
    return (
        <div className="upcoming-card is-skeleton" aria-hidden="true">
            <div>
                <SkeletonLine width="112px" height={12} />
                <div className="upcoming-item skeleton-gap">
                    <span className="skeleton-block upcoming-icon" />
                    <div style={{ flex: 1 }}>
                        <SkeletonLine width="72%" height={14} />
                        <SkeletonLine
                            width="48%"
                            height={12}
                            className="skeleton-gap-sm"
                        />
                    </div>
                </div>
            </div>
            <div>
                <SkeletonLine width="76px" height={10} />
                <SkeletonLine
                    width="60%"
                    height={13}
                    className="skeleton-gap-sm"
                />
                <SkeletonLine
                    width="100%"
                    height={40}
                    className="skeleton-gap"
                />
            </div>
        </div>
    );
}

export function ActivityListSkeleton({ rows = 5 }) {
    return (
        <ul className="activity-list" aria-hidden="true">
            {Array.from({ length: rows }, (_, index) => (
                <li className="activity-item" key={index}>
                    <div style={{ flex: 1 }}>
                        <SkeletonLine width="62%" height={13} />
                        <div className="activity-meta">
                            <SkeletonLine width="150px" height={11} />
                        </div>
                    </div>
                </li>
            ))}
        </ul>
    );
}

export function TableSkeleton({ columns, rows = 5, className = "ap-table" }) {
    return (
        <table className={className} aria-hidden="true">
            <thead>
                <tr>
                    {columns.map((column) => (
                        <th key={column}>{column}</th>
                    ))}
                </tr>
            </thead>
            <tbody>
                {Array.from({ length: rows }, (_, rowIndex) => (
                    <tr key={rowIndex}>
                        {columns.map((column) => (
                            <td key={column}>
                                <SkeletonLine height={13} />
                            </td>
                        ))}
                    </tr>
                ))}
            </tbody>
        </table>
    );
}

export function ProgramCardSkeleton({ rows = 4 }) {
    return (
        <>
            {Array.from({ length: rows }, (_, index) => (
                <div className="prog-card is-skeleton" key={index} aria-hidden="true">
                    <div className="prog-info">
                        <div className="prog-name-row">
                            <SkeletonLine width="220px" height={14} />
                            <SkeletonLine width="70px" height={18} />
                        </div>
                        <SkeletonLine width="160px" height={12} />
                    </div>
                    <div className="prog-meta-row">
                        <SkeletonLine width="130px" height={12} />
                        {/* stands in for the "View Details" action */}
                        <SkeletonLine width="90px" height={12} />
                    </div>
                </div>
            ))}
        </>
    );
}
