import { Deferred } from "@inertiajs/react";
import { FaCircleExclamation, FaHeartPulse } from "react-icons/fa6";
import DashboardLayout from "@/Layouts/DashboardLayout";
import { Card } from "@/Components/ui";
import { ActivityStrip, ProgressDonut, StatCard } from "@/Components/rhu";

/**
 * The RHU dashboard from the portal reference: two KPI cards on the left, the
 * two progress rings stacked on the right, and the recent-activity strip
 * beneath. Every figure arrives from the controller's live queries — the page
 * holds no sample data of its own.
 */

function CardSkeleton({ className = "" }) {
    return (
        <Card className={`animate-pulse bg-white/70 ${className}`}>
            <div className="flex h-full flex-col gap-3 p-6">
                <div className="h-3 w-1/3 rounded bg-shell" />
                <div className="h-8 w-1/4 rounded bg-shell" />
                <div className="mt-auto h-3 w-1/2 rounded bg-shell" />
            </div>
        </Card>
    );
}

export default function Dashboard({
    municipality,
    // Deferred props: undefined on the first response, so each block below is
    // wrapped in <Deferred> and shows a skeleton until its query lands.
    stats,
    tracker_progress: trackerProgress,
    monitoring_progress: monitoringProgress,
    recent_activities: recentActivities,
}) {
    return (
        <DashboardLayout role="rhu" title="RHU Dashboard">
            {municipality ? null : (
                <div
                    role="status"
                    className="mb-4 rounded-xl border border-warn/30 bg-warn-soft px-5 py-4 font-ui text-[13px] text-[#8a5a00]"
                >
                    <strong className="font-bold">No municipality assigned.</strong> This
                    account has no catchment yet, so no patients, programs or treatment
                    cases can be shown. Ask an ICM coordinator to set the municipality on
                    your account.
                </div>
            )}

            {/* `auto 1fr` is what aligns the two lower cards: the KPI row sizes
                to its content and row 2 takes the rest, so Recent Activities
                and the right-hand column's second ring end level without any
                fixed height. Grid items stretch by default, and each card
                below carries `h-full` so it fills the cell it lands in. */}
            <div className="grid grid-cols-1 gap-[18px] font-ui xl:grid-cols-[1fr_1fr_1.3fr] xl:grid-rows-[auto_1fr]">
                <Deferred
                    data="stats"
                    fallback={
                        <>
                            <CardSkeleton className="h-[132px]" />
                            <CardSkeleton className="h-[132px]" />
                        </>
                    }
                >
                    <Stats stats={stats} />
                </Deferred>

                {/* The reference stacks both rings in a right-hand column that
                    spans the KPI and activity rows. */}
                <div className="flex flex-col gap-[18px] xl:col-start-3 xl:row-span-2 xl:row-start-1">
                    <Deferred
                        data="monitoring_progress"
                        fallback={<CardSkeleton className="min-h-[320px] flex-1" />}
                    >
                        <MonitoringRing progress={monitoringProgress} />
                    </Deferred>

                    <Deferred
                        data="tracker_progress"
                        fallback={<CardSkeleton className="min-h-[320px] flex-1" />}
                    >
                        <TrackerRing progress={trackerProgress} />
                    </Deferred>
                </div>

                <div className="min-h-[260px] xl:col-span-2 xl:col-start-1 xl:row-start-2">
                    <Deferred
                        data="recent_activities"
                        fallback={<CardSkeleton className="h-full" />}
                    >
                        <Activities activities={recentActivities} />
                    </Deferred>
                </div>
            </div>
        </DashboardLayout>
    );
}

function Stats({ stats }) {
    return (
        <>
            <StatCard
                label={
                    <>
                        Presumptive
                        <br />
                        Patients
                    </>
                }
                value={stats.presumptive_patients}
                caption="Awaiting diagnostic confirmation"
                accent="info"
                icon={<FaCircleExclamation />}
            />
            <StatCard
                label={
                    <>
                        Active TB
                        <br />
                        Cases
                    </>
                }
                value={stats.active_cases}
                caption="Currently under management"
                accent="brand"
                icon={<FaHeartPulse />}
            />
        </>
    );
}

function MonitoringRing({ progress }) {
    return (
        <ProgressDonut
            title="Treatment Monitoring Progress"
            href={route("rhu.treatment.index")}
            linkLabel="View Cases"
            done={progress.completed}
            total={progress.total}
        />
    );
}

function TrackerRing({ progress }) {
    // The tracker is done when both of its tabs are. Sputum collection counts
    // patients; diagnostic assessment counts the two tests each patient needs,
    // exactly as the Patient Tracker itself does.
    return (
        <ProgressDonut
            title="Patient Tracker Progress"
            href={route("rhu.tracker.index")}
            done={progress.collected + progress.tests_completed}
            total={progress.total + progress.tests_total}
        />
    );
}

function Activities({ activities }) {
    return <ActivityStrip activities={activities} href={route("rhu.activity")} />;
}
