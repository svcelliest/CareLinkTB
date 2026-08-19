export const workflowSteps = [
    {
        num: 1,
        title: "Community Screening",
        desc: "Teams conduct door-to-door or community-based screenings.",
        icon: (
            <>
                <circle cx="11" cy="11" r="8" />
                <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </>
        ),
    },
    {
        num: 2,
        title: "Patient Registration",
        desc: "Digital registration of all screened individuals.",
        icon: (
            <>
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                <polyline points="14 2 14 8 20 8" />
                <line x1="12" y1="18" x2="12" y2="12" />
                <line x1="9" y1="15" x2="15" y2="15" />
            </>
        ),
    },
    {
        num: 3,
        title: "Suspicious Case Flagging",
        desc: "Automated flagging of presumptive TB cases for follow-up.",
        icon: <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />,
    },
    {
        num: 4,
        title: "Diagnostic Assessment",
        desc: "RHU staff perform X-ray, Sputum, and GeneXpert tests.",
        icon: (
            <>
                <rect x="2" y="3" width="20" height="14" rx="2" />
                <line x1="8" y1="21" x2="16" y2="21" />
                <line x1="12" y1="17" x2="12" y2="21" />
            </>
        ),
    },
    {
        num: 5,
        title: "TB Confirmation",
        desc: "Physician evaluation and final diagnostic confirmation.",
        icon: (
            <>
                <polyline points="9 11 12 14 22 4" />
                <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
            </>
        ),
    },
    {
        num: 6,
        title: "Treatment Monitoring",
        desc: "Six-month structured medication and follow-up tracking.",
        icon: (
            <>
                <rect x="2" y="3" width="20" height="14" rx="2" />
                <polyline points="8 21 12 17 16 21" />
            </>
        ),
    },
    {
        num: 7,
        title: "Program Monitoring",
        desc: "ICM coordinators track performance across municipalities.",
        icon: (
            <>
                <line x1="18" y1="20" x2="18" y2="10" />
                <line x1="12" y1="20" x2="12" y2="4" />
                <line x1="6" y1="20" x2="6" y2="14" />
            </>
        ),
    },
];
