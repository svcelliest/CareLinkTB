import { Button, Modal } from "@/Components/ui";

/**
 * Archiving a program from the list, in the two states the list can be in.
 *
 * The Archive action is offered on every row, so this dialog either confirms
 * the archive of a completed program or explains why one that is still
 * upcoming or active cannot be filed away yet. Keeping both in one dialog is
 * what lets the row's button always open something rather than sitting there
 * dead — the refusal is the alert, not a disabled control that says nothing.
 */
export default function ArchiveProgramDialog({
    program,
    processing = false,
    onConfirm,
    onClose,
}) {
    if (!program) return null;

    const canArchive = program.status === "completed";
    const reason =
        program.status === "active"
            ? "Its screening session is still open — it can be archived once the provider ends the session."
            : `It is scheduled for ${program.date_label} and has not started yet.`;

    return (
        <Modal
            open
            onClose={onClose}
            locked={processing}
            labelledBy="archive-dialog-title"
            describedBy="archive-dialog-description"
            className="max-w-[440px]"
        >
            <h2
                id="archive-dialog-title"
                className="mb-1 text-[17px] font-bold text-ink"
            >
                {canArchive ? "Archive Program" : "Program Not Completed"}
            </h2>
            <p
                id="archive-dialog-description"
                className="mb-5 text-[13px] text-muted"
            >
                {canArchive ? (
                    <>
                        <span className="font-semibold text-ink">
                            {program.name}
                        </span>{" "}
                        will move to Archives. You can restore it from there at
                        any time.
                    </>
                ) : (
                    <>
                        Only completed programs can be archived.{" "}
                        <span className="font-semibold text-ink">
                            {program.name}
                        </span>{" "}
                        is still{" "}
                        {program.status === "active" ? "active" : "upcoming"}.{" "}
                        {reason}
                    </>
                )}
            </p>

            <div className="mt-1.5 flex justify-end gap-2.5">
                {canArchive ? (
                    <>
                        <Button
                            variant="secondary"
                            onClick={onClose}
                            disabled={processing}
                        >
                            Cancel
                        </Button>
                        <Button onClick={onConfirm} disabled={processing}>
                            {processing ? "Archiving…" : "Archive"}
                        </Button>
                    </>
                ) : (
                    <Button onClick={onClose}>Got it</Button>
                )}
            </div>
        </Modal>
    );
}
