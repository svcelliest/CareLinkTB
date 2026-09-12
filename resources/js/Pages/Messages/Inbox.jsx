import { useEffect, useMemo, useRef, useState } from "react";
import { useLivePoll } from "@/hooks/useLivePoll";
import { router, useForm, usePage } from "@inertiajs/react";
import {
    FaCheck,
    FaCheckDouble,
    FaChevronDown,
    FaEnvelope,
    FaImage,
    FaMagnifyingGlass,
    FaPaperPlane,
    FaPaperclip,
    FaPenToSquare,
    FaXmark,
} from "react-icons/fa6";
import DashboardLayout from "@/Layouts/DashboardLayout";
import { useToast } from "@/Components/ui/Toast";

const roleLabels = {
    icm: "ICM",
    rhu: "RHU",
    provider: "Service Provider",
};

const inboxTabs = [
    { id: "inbox", label: "Inbox" },
    { id: "sent", label: "Sent" },
    { id: "unread", label: "Unread" },
];

const MAX_ATTACHMENTS = 5;
const MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024;
const FILE_ACCEPT =
    ".jpg,.jpeg,.png,.gif,.webp,.pdf,.doc,.docx,.xls,.xlsx,.csv,.txt,.ppt,.pptx";
const IMAGE_ACCEPT =
    ".jpg,.jpeg,.png,.gif,.webp,image/jpeg,image/png,image/gif,image/webp";

const formatFileSize = (bytes) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

const firstAttachmentError = (errors) =>
    Object.entries(errors).find(
        ([key]) => key === "attachments" || key.startsWith("attachments."),
    )?.[1];

const firstRecipientError = (errors) =>
    Object.entries(errors).find(
        ([key]) =>
            key === "recipient_id" ||
            key === "recipient_ids" ||
            key.startsWith("recipient_ids."),
    )?.[1];

const formatTime = (value) =>
    new Intl.DateTimeFormat(undefined, {
        hour: "numeric",
        minute: "2-digit",
    }).format(new Date(value));

const formatPreviewTime = (value) => {
    const date = new Date(value);
    const today = new Date();

    return date.toDateString() === today.toDateString()
        ? formatTime(value)
        : new Intl.DateTimeFormat(undefined, {
              month: "short",
              day: "numeric",
          }).format(date);
};

const formatDay = (value) => {
    const date = new Date(value);
    const today = new Date();
    const yesterday = new Date();
    yesterday.setDate(today.getDate() - 1);

    if (date.toDateString() === today.toDateString()) return "Today";
    if (date.toDateString() === yesterday.toDateString()) return "Yesterday";

    return new Intl.DateTimeFormat(undefined, {
        month: "long",
        day: "numeric",
        year:
            date.getFullYear() === today.getFullYear() ? undefined : "numeric",
    }).format(date);
};

const initials = (name) =>
    name
        .split(" ")
        .filter(Boolean)
        .slice(0, 2)
        .map((part) => part[0])
        .join("")
        .toUpperCase();

export default function Inbox({
    role,
    contacts,
    selectedContact,
    messages,
    messageSearchResults = [],
}) {
    const { auth } = usePage().props;
    const toast = useToast();
    const currentUser = auth.user;
    const [search, setSearch] = useState("");
    const [highlightMessageId, setHighlightMessageId] = useState(null);
    const [activeTab, setActiveTab] = useState("inbox");
    const [newMessageOpen, setNewMessageOpen] = useState(false);
    const [composeSubject, setComposeSubject] = useState("");
    const [composeRecipientSearch, setComposeRecipientSearch] = useState("");
    const [isRecipientsOpen, setIsRecipientsOpen] = useState(false);
    const [confirmDiscardOpen, setConfirmDiscardOpen] = useState(false);
    const bottomRef = useRef(null);
    const suppressAutoScrollRef = useRef(false);
    const composeRecipientRef = useRef(null);
    const recipientDropdownRef = useRef(null);
    const isRecipientsOpenRef = useRef(false);
    const confirmDiscardOpenRef = useRef(false);
    const confirmCancelRef = useRef(null);
    const closeComposeRef = useRef(null);
    const composeFileInputRef = useRef(null);
    const composeImageInputRef = useRef(null);
    const replyAttachmentInputRef = useRef(null);

    const {
        data: replyData,
        setData: setReplyData,
        post: postReply,
        processing: replyProcessing,
        errors: replyErrors,
        reset: resetReply,
        setError: setReplyError,
        clearErrors: clearReplyErrors,
    } = useForm({
        recipient_id: selectedContact?.id ?? "",
        body: "",
        attachments: [],
    });

    const composeForm = useForm({
        recipient_ids: [],
        body: "",
        attachments: [],
    });

    const isSearching = search.trim().length > 0;

    const filteredContacts = useMemo(() => {
        return contacts.filter((contact) => {
            if (!contact.last_message) {
                return false;
            }

            if (activeTab === "sent" && !contact.last_message?.is_mine) {
                return false;
            }

            if (activeTab === "unread" && contact.unread_count === 0) {
                return false;
            }

            return true;
        });
    }, [activeTab, contacts]);

    const filteredComposeContacts = useMemo(() => {
        const term = composeRecipientSearch.trim().toLowerCase();

        if (!term) return contacts;

        return contacts.filter((contact) =>
            [contact.name, contact.email, contact.role_label]
                .join(" ")
                .toLowerCase()
                .includes(term),
        );
    }, [composeRecipientSearch, contacts]);

    const selectedComposeContacts = useMemo(
        () =>
            contacts.filter((contact) =>
                composeForm.data.recipient_ids.includes(contact.id),
            ),
        [contacts, composeForm.data.recipient_ids],
    );

    useEffect(() => {
        setReplyData("recipient_id", selectedContact?.id ?? "");
        clearReplyErrors();
    }, [selectedContact?.id]);

    const highlightTarget = highlightMessageId
        ? messages.find((message) => message.id === highlightMessageId)
        : undefined;

    useEffect(() => {
        if (suppressAutoScrollRef.current) {
            suppressAutoScrollRef.current = false;
            return;
        }
        bottomRef.current?.scrollIntoView({ block: "end" });
    }, [messages.length, selectedContact?.id]);

    useEffect(() => {
        if (!highlightTarget) return undefined;

        const frame = window.requestAnimationFrame(() => {
            document
                .getElementById(`message-${highlightTarget.id}`)
                ?.scrollIntoView({ block: "center", behavior: "smooth" });
        });
        const timeoutId = setTimeout(() => setHighlightMessageId(null), 2000);

        return () => {
            window.cancelAnimationFrame(frame);
            clearTimeout(timeoutId);
        };
    }, [highlightMessageId]);

    useEffect(() => {
        if (!selectedContact || selectedContact.unread_count === 0) return;

        router.patch(
            route("messages.read", selectedContact.id),
            {},
            {
                preserveScroll: true,
                preserveState: true,
            },
        );
    }, [selectedContact?.id, selectedContact?.unread_count]);

    useLivePoll(
        ["contacts", "selectedContact", "messages", "unreadMessageCount"],
        5000,
    );

    useEffect(() => {
        const term = search.trim();

        if (term.length < 2) return undefined;

        const timeoutId = setTimeout(() => {
            router.get(
                route(`${role}.inbox`),
                {
                    ...(selectedContact ? { contact: selectedContact.id } : {}),
                    message_search: term,
                },
                {
                    only: ["messageSearchResults"],
                    preserveState: true,
                    preserveScroll: true,
                    replace: true,
                },
            );
        }, 300);

        return () => clearTimeout(timeoutId);
    }, [search, role, selectedContact?.id]);

    useEffect(() => {
        if (!newMessageOpen) return undefined;

        const focusFrame = window.requestAnimationFrame(() => {
            composeRecipientRef.current?.focus();
        });
        const handleKeyDown = (event) => {
            if (event.key !== "Escape") return;

            // Highest layer claims Escape first: the discard-confirm
            // dialog, then the recipient dropdown, then finally the
            // compose window itself — each one only closing what's on top.
            if (confirmDiscardOpenRef.current) {
                setConfirmDiscardOpen(false);
                return;
            }
            if (isRecipientsOpenRef.current) return;

            // Routed through the ref (rather than calling closeCompose
            // directly) so this always sees the latest draft state instead
            // of whatever it was when the modal first opened.
            closeComposeRef.current?.();
        };

        window.addEventListener("keydown", handleKeyDown);

        return () => {
            window.cancelAnimationFrame(focusFrame);
            window.removeEventListener("keydown", handleKeyDown);
        };
    }, [newMessageOpen]);

    useEffect(() => {
        isRecipientsOpenRef.current = isRecipientsOpen;

        // The search term is only ever meant to filter the open dropdown;
        // once it closes, the field switches to showing who's selected, so
        // stale search text should never linger underneath that.
        if (!isRecipientsOpen) {
            setComposeRecipientSearch("");
        }
    }, [isRecipientsOpen]);

    useEffect(() => {
        confirmDiscardOpenRef.current = confirmDiscardOpen;

        if (!confirmDiscardOpen) return undefined;

        const focusFrame = window.requestAnimationFrame(() => {
            confirmCancelRef.current?.focus();
        });

        return () => window.cancelAnimationFrame(focusFrame);
    }, [confirmDiscardOpen]);

    useEffect(() => {
        if (!isRecipientsOpen) return undefined;

        const focusFrame = window.requestAnimationFrame(() => {
            composeRecipientRef.current?.focus();
        });
        const handleClickOutside = (event) => {
            if (
                recipientDropdownRef.current &&
                !recipientDropdownRef.current.contains(event.target)
            ) {
                setIsRecipientsOpen(false);
            }
        };
        const handleKeyDown = (event) => {
            if (event.key === "Escape") {
                setIsRecipientsOpen(false);
            }
        };

        document.addEventListener("mousedown", handleClickOutside);
        window.addEventListener("keydown", handleKeyDown);

        return () => {
            window.cancelAnimationFrame(focusFrame);
            document.removeEventListener("mousedown", handleClickOutside);
            window.removeEventListener("keydown", handleKeyDown);
        };
    }, [isRecipientsOpen]);

    const openConversation = (contact, targetMessageId = null) => {
        setNewMessageOpen(false);
        setSearch("");
        setHighlightMessageId(targetMessageId);
        if (targetMessageId) {
            suppressAutoScrollRef.current = true;
        }
        router.get(
            route(`${role}.inbox`),
            { contact: contact.id },
            {
                preserveState: true,
                preserveScroll: true,
                replace: true,
            },
        );
    };

    const openCompose = () => {
        composeForm.reset();
        composeForm.clearErrors();
        setComposeSubject("");
        setComposeRecipientSearch("");
        setIsRecipientsOpen(false);
        setConfirmDiscardOpen(false);
        setNewMessageOpen(true);
    };

    // Actually tears the compose window down — called directly when there's
    // nothing to lose, or from the discard-confirm dialog once the user
    // confirms.
    const finishCloseCompose = () => {
        // Exit out of any in-progress recipient search before the window
        // disappears, rather than leaving the field focused underneath it.
        composeRecipientRef.current?.blur();
        composeForm.clearErrors();
        setIsRecipientsOpen(false);
        setConfirmDiscardOpen(false);
        setNewMessageOpen(false);
    };

    const closeCompose = () => {
        const hasDraft =
            composeForm.data.recipient_ids.length > 0 ||
            composeSubject.trim().length > 0 ||
            composeForm.data.body.trim().length > 0 ||
            composeForm.data.attachments.length > 0;

        if (hasDraft) {
            setConfirmDiscardOpen(true);
            return;
        }

        finishCloseCompose();
    };

    useEffect(() => {
        closeComposeRef.current = closeCompose;
    });

    const toggleComposeRecipient = (contactId) => {
        const selectedIds = composeForm.data.recipient_ids;

        composeForm.setData(
            "recipient_ids",
            selectedIds.includes(contactId)
                ? selectedIds.filter((id) => id !== contactId)
                : [...selectedIds, contactId],
        );
        composeForm.clearErrors();
    };

    const toggleVisibleRecipients = () => {
        const visibleIds = filteredComposeContacts.map((contact) => contact.id);
        const selectedIds = composeForm.data.recipient_ids;
        const allVisibleSelected =
            visibleIds.length > 0 &&
            visibleIds.every((contactId) => selectedIds.includes(contactId));

        composeForm.setData(
            "recipient_ids",
            allVisibleSelected
                ? selectedIds.filter(
                      (contactId) => !visibleIds.includes(contactId),
                  )
                : [...new Set([...selectedIds, ...visibleIds])],
        );
        composeForm.clearErrors();
    };

    const addAttachments = (event, form) => {
        const selectedFiles = Array.from(event.target.files ?? []);
        event.target.value = "";

        if (selectedFiles.length === 0) return;

        if (selectedFiles.some((file) => file.size > MAX_ATTACHMENT_BYTES)) {
            form.setError(
                "attachments",
                "Each attachment may not be larger than 10 MB.",
            );
            return;
        }

        const existingFiles = form.data.attachments ?? [];
        const existingKeys = new Set(
            existingFiles.map(
                (file) => `${file.name}-${file.size}-${file.lastModified}`,
            ),
        );
        const uniqueFiles = selectedFiles.filter(
            (file) =>
                !existingKeys.has(
                    `${file.name}-${file.size}-${file.lastModified}`,
                ),
        );

        if (existingFiles.length + uniqueFiles.length > MAX_ATTACHMENTS) {
            form.setError(
                "attachments",
                `You may attach up to ${MAX_ATTACHMENTS} files to a message.`,
            );
            return;
        }

        form.clearErrors();
        form.setData("attachments", [...existingFiles, ...uniqueFiles]);
    };

    const removeAttachment = (form, index) => {
        form.setData(
            "attachments",
            form.data.attachments.filter((_, fileIndex) => fileIndex !== index),
        );
        form.clearErrors();
    };

    const sendReply = (event) => {
        event?.preventDefault();
        if (!selectedContact || !replyData.body.trim() || replyProcessing)
            return;

        postReply(route("messages.store"), {
            preserveState: true,
            preserveScroll: true,
            showProgress: false,
            forceFormData: true,
            onSuccess: () => {
                resetReply("body", "attachments");
                toast.success("Message sent successfully");
            },
            onError: () =>
                toast.error("Message could not be sent. Please try again."),
        });
    };

    const sendNewMessage = (event) => {
        event.preventDefault();
        const subject = composeSubject.trim();
        const message = composeForm.data.body.trim();

        if (
            composeForm.data.recipient_ids.length === 0 ||
            !message ||
            composeForm.processing
        ) {
            return;
        }

        const firstRecipientId = composeForm.data.recipient_ids[0];
        const body = subject ? `${subject}\n\n${message}` : message;

        if (body.length > 5000) {
            composeForm.setError(
                "body",
                "The subject and message together may not exceed 5,000 characters.",
            );
            return;
        }

        composeForm.transform((values) => ({
            recipient_ids: values.recipient_ids,
            body,
            attachments: values.attachments,
        }));
        composeForm.post(route("messages.store"), {
            preserveScroll: true,
            forceFormData: true,
            onError: () =>
                toast.error("Message could not be sent. Please try again."),
            onSuccess: () => {
                composeForm.reset();
                setComposeSubject("");
                setIsRecipientsOpen(false);
                setNewMessageOpen(false);
                toast.success("Message sent successfully");
                router.get(
                    route(`${role}.inbox`),
                    { contact: firstRecipientId },
                    {
                        preserveState: true,
                        preserveScroll: true,
                        replace: true,
                    },
                );
            },
        });
    };

    return (
        <DashboardLayout
            role={role}
            title="Inbox"
            contentClassName="dash-content-inbox"
        >
            <section className="inbox-layout" aria-label="CareLink messages">
                <aside className="inbox-contacts-panel">
                    <div className="inbox-controls">
                        <button
                            type="button"
                            className="inbox-compose-button"
                            onClick={openCompose}
                        >
                            <FaPenToSquare />
                            <span>Compose</span>
                        </button>

                        <label className="inbox-search">
                            <FaMagnifyingGlass aria-hidden="true" />
                            <span className="sr-only">Search messages</span>
                            <input
                                type="search"
                                placeholder="Search messages..."
                                value={search}
                                onChange={(event) =>
                                    setSearch(event.target.value)
                                }
                            />
                        </label>
                    </div>

                    {isSearching ? (
                        <div className="inbox-contact-list inbox-message-results">
                            <p className="inbox-search-section-label">
                                Messages
                            </p>
                            {messageSearchResults.map((result) => (
                                <button
                                    type="button"
                                    key={result.id}
                                    className="inbox-contact"
                                    onClick={() =>
                                        openConversation(
                                            { id: result.contact_id },
                                            result.id,
                                        )
                                    }
                                >
                                    <span className="inbox-contact-row inbox-contact-heading">
                                        <strong>{result.contact_name}</strong>
                                        <time dateTime={result.created_at}>
                                            {formatPreviewTime(
                                                result.created_at,
                                            )}
                                        </time>
                                    </span>
                                    <span className="inbox-contact-subject">
                                        <strong>
                                            {result.is_mine ? "You: " : ""}
                                            {result.snippet}
                                        </strong>
                                    </span>
                                </button>
                            ))}

                            {messageSearchResults.length === 0 && (
                                <div className="inbox-no-results">
                                    {search.trim().length < 2
                                        ? "Keep typing to search messages…"
                                        : `No messages match “${search}”.`}
                                </div>
                            )}
                        </div>
                    ) : (
                        <>
                            <div
                                className="inbox-tabs"
                                role="tablist"
                                aria-label="Message filters"
                            >
                                {inboxTabs.map((tab) => (
                                    <button
                                        type="button"
                                        role="tab"
                                        key={tab.id}
                                        className={
                                            activeTab === tab.id ? "active" : ""
                                        }
                                        aria-selected={activeTab === tab.id}
                                        onClick={() => setActiveTab(tab.id)}
                                    >
                                        {tab.label}
                                    </button>
                                ))}
                            </div>

                            <div className="inbox-contact-list">
                                {filteredContacts.map((contact) => (
                                    <button
                                        type="button"
                                        key={contact.id}
                                        className={`inbox-contact ${
                                            selectedContact?.id === contact.id
                                                ? "active"
                                                : ""
                                        }`}
                                        onClick={() =>
                                            openConversation(contact)
                                        }
                                        aria-pressed={
                                            selectedContact?.id === contact.id
                                        }
                                    >
                                        <span className="inbox-contact-row inbox-contact-heading">
                                            <strong>{contact.name}</strong>
                                            {contact.last_message && (
                                                <time
                                                    dateTime={
                                                        contact.last_message
                                                            .created_at
                                                    }
                                                >
                                                    {formatPreviewTime(
                                                        contact.last_message
                                                            .created_at,
                                                    )}
                                                </time>
                                            )}
                                        </span>
                                        <span className="inbox-contact-subject">
                                            {contact.unread_count > 0 && (
                                                <span
                                                    className="inbox-unread-dot"
                                                    aria-hidden="true"
                                                />
                                            )}
                                            <strong>
                                                {contact.last_message?.body ??
                                                    "Start a conversation"}
                                            </strong>
                                            {contact.unread_count > 0 && (
                                                <span className="inbox-unread-count">
                                                    {contact.unread_count > 99
                                                        ? "99+"
                                                        : contact.unread_count}
                                                </span>
                                            )}
                                        </span>
                                        <span className="inbox-contact-preview">
                                            {contact.role_label} ·{" "}
                                            {contact.email}
                                        </span>
                                    </button>
                                ))}

                                {filteredContacts.length === 0 && (
                                    <div className="inbox-no-results">
                                        {`No ${activeTab} messages to show.`}
                                    </div>
                                )}
                            </div>
                        </>
                    )}
                </aside>

                <div className="inbox-conversation-panel">
                    {selectedContact ? (
                        <>
                            <header className="inbox-conversation-header">
                                <span
                                    className={`inbox-avatar role-${selectedContact.role}`}
                                    aria-hidden="true"
                                >
                                    {initials(selectedContact.name)}
                                </span>
                                <div>
                                    <h2>{selectedContact.name}</h2>
                                    <p>
                                        {selectedContact.role_label}
                                        <span aria-hidden="true"> · </span>
                                        {selectedContact.email}
                                    </p>
                                </div>
                            </header>

                            <div
                                className="inbox-message-list"
                                aria-live="polite"
                                aria-label={`Conversation with ${selectedContact.name}`}
                            >
                                {messages.length === 0 && (
                                    <div className="inbox-empty-conversation">
                                        <span className="inbox-empty-icon">
                                            <FaEnvelope />
                                        </span>
                                        <h3>Start the conversation</h3>
                                        <p>
                                            Send a message to{" "}
                                            {selectedContact.name}. It will
                                            appear in their{" "}
                                            {selectedContact.role_label}
                                            inbox.
                                        </p>
                                    </div>
                                )}

                                {messages.map((message, index) => {
                                    const mine =
                                        message.sender_id === currentUser.id;
                                    const previous = messages[index - 1];
                                    const showDay =
                                        !previous ||
                                        new Date(
                                            previous.created_at,
                                        ).toDateString() !==
                                            new Date(
                                                message.created_at,
                                            ).toDateString();

                                    return (
                                        <div key={message.id}>
                                            {showDay && (
                                                <div className="inbox-day-divider">
                                                    <span>
                                                        {formatDay(
                                                            message.created_at,
                                                        )}
                                                    </span>
                                                </div>
                                            )}
                                            <div
                                                id={`message-${message.id}`}
                                                className={`inbox-message-row ${
                                                    mine ? "mine" : "theirs"
                                                } ${
                                                    highlightTarget?.id ===
                                                    message.id
                                                        ? "highlighted"
                                                        : ""
                                                }`}
                                            >
                                                <div className="inbox-message-bubble">
                                                    <p>{message.body}</p>
                                                    {message.attachments
                                                        ?.length > 0 && (
                                                        <div className="inbox-message-attachments">
                                                            {message.attachments.map(
                                                                (attachment) =>
                                                                    attachment.is_image ? (
                                                                        <a
                                                                            key={
                                                                                attachment.id
                                                                            }
                                                                            className="inbox-image-attachment"
                                                                            href={
                                                                                attachment.url
                                                                            }
                                                                            target="_blank"
                                                                            rel="noreferrer"
                                                                            aria-label={`Open ${attachment.name}`}
                                                                        >
                                                                            <img
                                                                                src={
                                                                                    attachment.url
                                                                                }
                                                                                alt={
                                                                                    attachment.name
                                                                                }
                                                                                loading="lazy"
                                                                            />
                                                                            <span>
                                                                                {
                                                                                    attachment.name
                                                                                }
                                                                            </span>
                                                                        </a>
                                                                    ) : (
                                                                        <a
                                                                            key={
                                                                                attachment.id
                                                                            }
                                                                            className="inbox-file-attachment"
                                                                            href={
                                                                                attachment.download_url
                                                                            }
                                                                        >
                                                                            <FaPaperclip />
                                                                            <span>
                                                                                <strong>
                                                                                    {
                                                                                        attachment.name
                                                                                    }
                                                                                </strong>
                                                                                <small>
                                                                                    {formatFileSize(
                                                                                        attachment.size,
                                                                                    )}
                                                                                </small>
                                                                            </span>
                                                                        </a>
                                                                    ),
                                                            )}
                                                        </div>
                                                    )}
                                                    <span className="inbox-message-meta">
                                                        <time
                                                            dateTime={
                                                                message.created_at
                                                            }
                                                        >
                                                            {formatTime(
                                                                message.created_at,
                                                            )}
                                                        </time>
                                                        {mine &&
                                                            (message.read_at ? (
                                                                <FaCheckDouble
                                                                    className="message-read"
                                                                    aria-label="Read"
                                                                />
                                                            ) : (
                                                                <FaCheck aria-label="Sent" />
                                                            ))}
                                                    </span>
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                                <div ref={bottomRef} />
                            </div>

                            <form
                                className="inbox-composer"
                                onSubmit={sendReply}
                            >
                                {replyData.attachments.length > 0 && (
                                    <div className="inbox-selected-attachments inbox-reply-attachments">
                                        {replyData.attachments.map(
                                            (file, index) => (
                                                <span
                                                    key={`${file.name}-${file.size}-${file.lastModified}`}
                                                    className="inbox-selected-attachment"
                                                >
                                                    <FaPaperclip />
                                                    <span title={file.name}>
                                                        {file.name}
                                                    </span>
                                                    <small>
                                                        {formatFileSize(
                                                            file.size,
                                                        )}
                                                    </small>
                                                    <button
                                                        type="button"
                                                        onClick={() =>
                                                            removeAttachment(
                                                                {
                                                                    data: replyData,
                                                                    setData:
                                                                        setReplyData,
                                                                    clearErrors:
                                                                        clearReplyErrors,
                                                                },
                                                                index,
                                                            )
                                                        }
                                                        aria-label={`Remove ${file.name}`}
                                                    >
                                                        <FaXmark />
                                                    </button>
                                                </span>
                                            ),
                                        )}
                                    </div>
                                )}
                                <input
                                    ref={replyAttachmentInputRef}
                                    className="sr-only"
                                    type="file"
                                    accept={FILE_ACCEPT}
                                    multiple
                                    onChange={(event) =>
                                        addAttachments(event, {
                                            data: replyData,
                                            setData: setReplyData,
                                            setError: setReplyError,
                                            clearErrors: clearReplyErrors,
                                        })
                                    }
                                    tabIndex="-1"
                                />
                                <button
                                    type="button"
                                    className="inbox-reply-attach-button"
                                    onClick={() =>
                                        replyAttachmentInputRef.current?.click()
                                    }
                                    disabled={
                                        replyProcessing ||
                                        replyData.attachments.length >=
                                            MAX_ATTACHMENTS
                                    }
                                    aria-label="Attach files or images"
                                    title="Attach files or images"
                                >
                                    <FaPaperclip />
                                </button>
                                <div className="inbox-composer-field">
                                    <textarea
                                        rows="1"
                                        maxLength="5000"
                                        placeholder={`Message ${selectedContact.name}`}
                                        value={replyData.body}
                                        onChange={(event) =>
                                            setReplyData(
                                                "body",
                                                event.target.value,
                                            )
                                        }
                                        onKeyDown={(event) => {
                                            if (
                                                event.key === "Enter" &&
                                                !event.shiftKey
                                            ) {
                                                event.preventDefault();
                                                sendReply();
                                            }
                                        }}
                                        aria-label={`Message ${selectedContact.name}`}
                                    />
                                    <span>{replyData.body.length}/5000</span>
                                </div>
                                <button
                                    type="submit"
                                    className="inbox-send-button"
                                    disabled={
                                        !replyData.body.trim() ||
                                        replyProcessing
                                    }
                                >
                                    <FaPaperPlane />
                                    <span>
                                        {replyProcessing ? "Sending" : "Send"}
                                    </span>
                                </button>
                                {(replyErrors.body ||
                                    replyErrors.recipient_id ||
                                    firstAttachmentError(replyErrors)) && (
                                    <p className="inbox-composer-error">
                                        {replyErrors.body ??
                                            replyErrors.recipient_id ??
                                            firstAttachmentError(replyErrors)}
                                    </p>
                                )}
                            </form>
                        </>
                    ) : (
                        <div className="inbox-empty-state">
                            <span className="inbox-empty-icon">
                                <FaEnvelope />
                            </span>
                            <h2>
                                {contacts.length > 0
                                    ? "Select a message"
                                    : "No contacts available"}
                            </h2>
                            <p>
                                {contacts.length > 0
                                    ? "Choose a conversation from the list to view it."
                                    : "Add another ICM, RHU, or Service Provider account to start messaging."}
                            </p>
                        </div>
                    )}
                </div>

                {newMessageOpen && (
                    <div
                        className="inbox-compose-scrim"
                        role="presentation"
                        onMouseDown={(event) => {
                            if (event.target === event.currentTarget) {
                                closeCompose();
                            }
                        }}
                    >
                        <section
                            className="inbox-compose-window"
                            role="dialog"
                            aria-modal="true"
                            aria-labelledby="new-message-title"
                        >
                            <header className="inbox-compose-window-header">
                                <h2 id="new-message-title">New Message</h2>
                                <button
                                    type="button"
                                    onClick={closeCompose}
                                    aria-label="Close new message window"
                                >
                                    <FaXmark />
                                </button>
                            </header>

                            <form
                                className="inbox-compose-form"
                                onSubmit={sendNewMessage}
                            >
                                <div
                                    className="inbox-compose-field inbox-recipient-dropdown"
                                    ref={recipientDropdownRef}
                                >
                                    <span>To (Recipients)</span>
                                    <div className="inbox-recipient-input-wrap">
                                        <input
                                            ref={composeRecipientRef}
                                            type="search"
                                            className="inbox-recipient-trigger"
                                            placeholder="Select/Search recipients"
                                            value={composeRecipientSearch}
                                            onChange={(event) => {
                                                setComposeRecipientSearch(
                                                    event.target.value,
                                                );
                                                setIsRecipientsOpen(true);
                                            }}
                                            onClick={() =>
                                                setIsRecipientsOpen(true)
                                            }
                                            aria-haspopup="true"
                                            aria-expanded={isRecipientsOpen}
                                            aria-label="Select or search message recipients"
                                        />
                                        <button
                                            type="button"
                                            className="inbox-recipient-trigger-icon"
                                            aria-label={
                                                isRecipientsOpen
                                                    ? "Close recipient list"
                                                    : "Open recipient list"
                                            }
                                            onClick={() =>
                                                setIsRecipientsOpen(
                                                    (open) => !open,
                                                )
                                            }
                                        >
                                            <FaChevronDown aria-hidden="true" />
                                        </button>
                                    </div>

                                    {selectedComposeContacts.length > 0 && (
                                        <div className="inbox-selected-recipients">
                                            {selectedComposeContacts.map(
                                                (contact) => (
                                                    <span
                                                        key={contact.id}
                                                        className="inbox-selected-recipient"
                                                    >
                                                        <span
                                                            className={`inbox-avatar role-${contact.role}`}
                                                            aria-hidden="true"
                                                        >
                                                            {initials(
                                                                contact.name,
                                                            )}
                                                        </span>
                                                        <span
                                                            title={contact.name}
                                                        >
                                                            {contact.name}
                                                        </span>
                                                        <button
                                                            type="button"
                                                            onClick={() =>
                                                                toggleComposeRecipient(
                                                                    contact.id,
                                                                )
                                                            }
                                                            aria-label={`Remove ${contact.name}`}
                                                        >
                                                            <FaXmark />
                                                        </button>
                                                    </span>
                                                ),
                                            )}
                                        </div>
                                    )}

                                    {isRecipientsOpen && (
                                        <div className="inbox-recipient-panel">
                                            <div className="inbox-recipient-toolbar">
                                                <span>
                                                    {
                                                        composeForm.data
                                                            .recipient_ids
                                                            .length
                                                    }{" "}
                                                    selected
                                                </span>
                                                <button
                                                    type="button"
                                                    onClick={
                                                        toggleVisibleRecipients
                                                    }
                                                    disabled={
                                                        filteredComposeContacts.length ===
                                                        0
                                                    }
                                                >
                                                    {filteredComposeContacts.length >
                                                        0 &&
                                                    filteredComposeContacts.every(
                                                        (contact) =>
                                                            composeForm.data.recipient_ids.includes(
                                                                contact.id,
                                                            ),
                                                    )
                                                        ? "Deselect All"
                                                        : "Select All"}
                                                </button>
                                            </div>
                                            <div
                                                className="inbox-recipient-options"
                                                role="group"
                                                aria-label="Select message recipients"
                                            >
                                                {filteredComposeContacts.map(
                                                    (contact) => {
                                                        const checked =
                                                            composeForm.data.recipient_ids.includes(
                                                                contact.id,
                                                            );

                                                        return (
                                                            <label
                                                                key={contact.id}
                                                                className={
                                                                    checked
                                                                        ? "selected"
                                                                        : ""
                                                                }
                                                            >
                                                                <input
                                                                    type="checkbox"
                                                                    checked={
                                                                        checked
                                                                    }
                                                                    onChange={() =>
                                                                        toggleComposeRecipient(
                                                                            contact.id,
                                                                        )
                                                                    }
                                                                />
                                                                <span
                                                                    className={`inbox-avatar role-${contact.role}`}
                                                                    aria-hidden="true"
                                                                >
                                                                    {initials(
                                                                        contact.name,
                                                                    )}
                                                                </span>
                                                                <span className="inbox-recipient-copy">
                                                                    <strong>
                                                                        {
                                                                            contact.name
                                                                        }
                                                                    </strong>
                                                                    <small>
                                                                        {
                                                                            contact.role_label
                                                                        }{" "}
                                                                        ·{" "}
                                                                        {
                                                                            contact.email
                                                                        }
                                                                    </small>
                                                                </span>
                                                            </label>
                                                        );
                                                    },
                                                )}

                                                {filteredComposeContacts.length ===
                                                    0 && (
                                                    <p>
                                                        No users match your
                                                        search.
                                                    </p>
                                                )}
                                            </div>
                                        </div>
                                    )}
                                </div>

                                <label className="inbox-compose-field">
                                    <span>From (Sender)</span>
                                    <input
                                        type="text"
                                        value={`${currentUser.name} — ${
                                            roleLabels[role] ?? "CareLink User"
                                        }`}
                                        readOnly
                                    />
                                </label>

                                <label className="inbox-compose-field">
                                    <span>Subject</span>
                                    <input
                                        type="text"
                                        maxLength="160"
                                        placeholder="Message subject"
                                        value={composeSubject}
                                        onChange={(event) =>
                                            setComposeSubject(
                                                event.target.value,
                                            )
                                        }
                                    />
                                </label>

                                <label className="inbox-compose-field inbox-compose-message">
                                    <span>Message</span>
                                    <textarea
                                        maxLength="5000"
                                        placeholder="Write your message here..."
                                        value={composeForm.data.body}
                                        onChange={(event) =>
                                            composeForm.setData(
                                                "body",
                                                event.target.value,
                                            )
                                        }
                                        required
                                    />
                                </label>

                                <div className="inbox-compose-attachments">
                                    <span>Attachments</span>
                                    <input
                                        ref={composeFileInputRef}
                                        className="sr-only"
                                        type="file"
                                        accept={FILE_ACCEPT}
                                        multiple
                                        onChange={(event) =>
                                            addAttachments(event, composeForm)
                                        }
                                        tabIndex="-1"
                                    />
                                    <input
                                        ref={composeImageInputRef}
                                        className="sr-only"
                                        type="file"
                                        accept={IMAGE_ACCEPT}
                                        multiple
                                        onChange={(event) =>
                                            addAttachments(event, composeForm)
                                        }
                                        tabIndex="-1"
                                    />
                                    <div className="inbox-compose-attachment-buttons">
                                        <button
                                            type="button"
                                            onClick={() =>
                                                composeFileInputRef.current?.click()
                                            }
                                            disabled={
                                                composeForm.processing ||
                                                composeForm.data.attachments
                                                    .length >= MAX_ATTACHMENTS
                                            }
                                        >
                                            <FaPaperclip />
                                            Attach File
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() =>
                                                composeImageInputRef.current?.click()
                                            }
                                            disabled={
                                                composeForm.processing ||
                                                composeForm.data.attachments
                                                    .length >= MAX_ATTACHMENTS
                                            }
                                        >
                                            <FaImage />
                                            Attach Image
                                        </button>
                                    </div>
                                    {composeForm.data.attachments.length >
                                        0 && (
                                        <div className="inbox-selected-attachments">
                                            {composeForm.data.attachments.map(
                                                (file, index) => (
                                                    <span
                                                        key={`${file.name}-${file.size}-${file.lastModified}`}
                                                        className="inbox-selected-attachment"
                                                    >
                                                        {file.type.startsWith(
                                                            "image/",
                                                        ) ? (
                                                            <FaImage />
                                                        ) : (
                                                            <FaPaperclip />
                                                        )}
                                                        <span title={file.name}>
                                                            {file.name}
                                                        </span>
                                                        <small>
                                                            {formatFileSize(
                                                                file.size,
                                                            )}
                                                        </small>
                                                        <button
                                                            type="button"
                                                            onClick={() =>
                                                                removeAttachment(
                                                                    composeForm,
                                                                    index,
                                                                )
                                                            }
                                                            aria-label={`Remove ${file.name}`}
                                                        >
                                                            <FaXmark />
                                                        </button>
                                                    </span>
                                                ),
                                            )}
                                        </div>
                                    )}
                                </div>

                                {(composeForm.errors.body ||
                                    firstRecipientError(composeForm.errors) ||
                                    firstAttachmentError(
                                        composeForm.errors,
                                    )) && (
                                    <p className="inbox-compose-error">
                                        {composeForm.errors.body ??
                                            firstRecipientError(
                                                composeForm.errors,
                                            ) ??
                                            firstAttachmentError(
                                                composeForm.errors,
                                            )}
                                    </p>
                                )}

                                <footer className="inbox-compose-actions">
                                    <button
                                        type="button"
                                        className="inbox-compose-cancel"
                                        onClick={closeCompose}
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        type="submit"
                                        className="inbox-compose-send"
                                        disabled={
                                            composeForm.data.recipient_ids
                                                .length === 0 ||
                                            !composeForm.data.body.trim() ||
                                            composeForm.processing
                                        }
                                    >
                                        {composeForm.processing
                                            ? "Sending"
                                            : "Send"}
                                    </button>
                                </footer>
                            </form>
                        </section>
                    </div>
                )}

                {confirmDiscardOpen && (
                    <div
                        className="inbox-confirm-scrim"
                        role="presentation"
                        onMouseDown={(event) => {
                            if (event.target === event.currentTarget) {
                                setConfirmDiscardOpen(false);
                            }
                        }}
                    >
                        <div
                            className="inbox-confirm-dialog"
                            role="alertdialog"
                            aria-modal="true"
                            aria-labelledby="discard-message-title"
                            aria-describedby="discard-message-body"
                        >
                            <h2 id="discard-message-title">
                                Discard this message?
                            </h2>
                            <p id="discard-message-body">
                                Your draft will be lost. This can't be undone.
                            </p>
                            <div className="inbox-confirm-actions">
                                <button
                                    ref={confirmCancelRef}
                                    type="button"
                                    className="inbox-confirm-cancel"
                                    onClick={() => setConfirmDiscardOpen(false)}
                                >
                                    Keep editing
                                </button>
                                <button
                                    type="button"
                                    className="inbox-confirm-discard"
                                    onClick={finishCloseCompose}
                                >
                                    Discard
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </section>
        </DashboardLayout>
    );
}
