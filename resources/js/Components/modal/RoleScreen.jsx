export const roles = [
    {
        key: "icm",
        label: "Login as ICM",
        desc: "International Care Ministries — program coordination & monitoring",
        icon: (
            <>
                <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
                <polyline points="9 22 9 12 15 12 15 22" />
            </>
        ),
    },
    {
        key: "rhu",
        label: "Login as RHU",
        desc: "Rural Health Unit — patient management, sputum & contact tracing",
        icon: <path d="M22 12h-4l-3 9L9 3l-3 9H2" />,
    },
    {
        key: "provider",
        label: "Login as Provider",
        desc: "X-ray & diagnostic service provider — results and referrals",
        icon: (
            <>
                <circle cx="12" cy="8" r="4" />
                <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" />
            </>
        ),
    },
];

export default function RoleScreen({ onSelect }) {
    return (
        <div>
            <h2 className="role-screen-title">Welcome to CareLink TB</h2>
            <p className="role-screen-sub">
                Select your account type to continue
            </p>

            <div className="role-grid">
                {roles.map((r) => (
                    <button
                        key={r.key}
                        className="role-btn"
                        onClick={() => onSelect(r.key)}
                    >
                        <div className="role-icon">
                            <svg
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="2"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                            >
                                {r.icon}
                            </svg>
                        </div>
                        <div style={{ flex: 1, width: "100%" }}>
                            <div className="role-label">{r.label}</div>
                            <div className="role-desc">{r.desc}</div>
                        </div>
                    </button>
                ))}
            </div>
        </div>
    );
}
