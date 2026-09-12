// `logo` is the organisation's seal (public/img/logo_img/*.png). It is sized
// and centred by `.role-icon img`. Keep this list in step with ROLES in
// LoginModal.jsx.
export const roles = [
    {
        key: "icm",
        label: "ICM Portal",
        desc: "International Care Ministries — program coordination & monitoring",
        logo: "/img/logo_img/icm_logo.png",
    },
    {
        key: "rhu",
        label: "RHU Portal",
        desc: "Rural Health Unit — patient management, sputum & contact tracing",
        logo: "/img/logo_img/rhu_logo.png",
    },
    {
        key: "provider",
        label: "Provider Portal",
        desc: "X-ray & diagnostic service provider — results and referrals",
        logo: "/img/logo_img/provider_logo.png",
    },
];

export default function RoleScreen({ onSelect }) {
    return (
        <div>
            <h2 className="role-screen-title">Welcome to CareLink TB</h2>
            <p className="role-screen-sub">
                Select your account role to continue
            </p>

            <div className="role-grid">
                {roles.map((r) => (
                    <button
                        key={r.key}
                        className="role-btn"
                        onClick={() => onSelect(r.key)}
                    >
                        <div className="role-icon">
                            <img src={r.logo} alt="" aria-hidden="true" />
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
