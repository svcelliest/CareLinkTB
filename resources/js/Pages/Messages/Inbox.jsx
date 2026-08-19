import { useEffect, useMemo, useRef, useState } from "react";
import { router, useForm, usePage } from "@inertiajs/react";
import {
    FaCheck,
    FaCheckDouble,
    FaEnvelope,
    FaImage,
    FaMagnifyingGlass,
    FaPaperPlane,
    FaPaperclip,
    FaPenToSquare,
    FaXmark,
} from "react-icons/fa6";
import DashboardLayout from "@/Layouts/DashboardLayout";

const roleLabels = {
    icm: "ICM Coordinator",
    rhu: "RHU Staff",
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
const IMAGE_ACCEPT = ".jpg,.jpeg,.png,.gif,.webp,image/jpeg,image/png,image/gif,image/webp";

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
        year: date.getFullYear() === today.getFullYear() ? undefined : "numeric",
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

export default function Inbox({ role, contacts, selectedContact, messages }) {
    const { auth } = usePage().props;
    const currentUser = auth.user;
    const [search, setSearch] = useState("");
    const [activeTab, setActiveTab] = useState("inbox");
    const [newMessageOpen, setNewMessageOpen] = useState(false);
    const [composeSubject, setComposeSubject] = useState("");
    const [composeRecipientSearch, setComposeRecipientSearch] = useState("");
    const bottomRef = useRef(null);
    const composeRecipientRef = useRef(null);
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

    const filteredContacts = useMemo(() => {
        const term = search.trim().toLowerCase();

        return contacts.filter((contact) => {
            if (activeTab === "sent" && !contact.last_message?.is_mine) {
                return false;
            }

            if (activeTab === "unread" && contact.unread_count === 0) {
                return false;
            }

            if (!term) return true;

            return [
                contact.name,
                contact.email,
                contact.role_label,
                contact.last_message?.body,
            ]
                .filter(Boolean)
                .join(" ")
                .toLowerCase()
                .includes(term);
        });
    }, [activeTab, contacts, search]);

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

    useEffect(() => {
        setReplyData("recipient_id", selectedContact?.id ?? "");
        clearReplyErrors();
    }, [selectedContact?.id]);

    useEffect(() => {
        bottomRef.current?.scrollIntoView({ block: "end" });
    }, [messages.length, selectedContact?.id]);

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

    useEffect(() => {
        const refreshTimer = window.setInterval(() => {
            if (document.hidden) return;

            router.reload({
                only: [
                    "contacts",
                    "selectedContact",
                    "messages",
                    "unreadMessageCount",
                ],
                preserveScroll: true,
                preserveState: true,
            });
        }, 10000);

        return () => window.clearInterval(refreshTimer);
    }, [selectedContact?.id]);

    useEffect(() => {
        if (!newMessageOpen) return undefined;

        const focusFrame = window.requestAnimationFrame(() => {
            composeRecipientRef.current?.focus();
        });
        const handleKeyDown = (event) => {
            if (event.key === "Escape") {
                setNewMessageOpen(false);
            }
        };

        window.addEventListener("keydown", handleKeyDown);

        return () => {
            window.cancelAnimationFrame(focusFrame);
            window.removeEventListener("keydown", handleKeyDown);
        };
    }, [newMessageOpen]);

    const openConversation = (contact) => {
        setNewMessageOpen(false);
        setSearch("");
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
        setNewMessageOpen(true);
    };

    const closeCompose = () => {
        composeForm.clearErrors();
        setNewMessageOpen(false);
    };

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
                ? selectedIds.filter((contactId) => !visibleIds.includes(contactId))
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
                !existingKeys.has(`${file.name}-${file.size}-${file.lastModified}`),
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
        if (!selectedContact || !replyData.body.trim() || replyProcessing) return;

        postReply(route("messages.store"), {
            preserveScroll: true,
            forceFormData: true,
            onSuccess: () => resetReply("body", "attachments"),
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
            onSuccess: () => {
                composeForm.reset();
                setComposeSubject("");
                setNewMessageOpen(false);
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
                                onChange={(event) => setSearch(event.target.value)}
                            />
                        </label>
                    </div>

                    <div className="inbox-tabs" role="tablist" aria-label="Message filters">
                        {inboxTabs.map((tab) => (
                            <button
                                type="button"
                                role="tab"
                                key={tab.id}
                                className={activeTab === tab.id ? "active" : ""}
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
                                    selectedContact?.id === contact.id ? "active" : ""
                                }`}
                                onClick={() => openConversation(contact)}
                                aria-pressed={selectedContact?.id === contact.id}
                            >
                                <span className="inbox-contact-row inbox-contact-heading">
                                    <strong>{contact.name}</strong>
                                    {contact.last_message && (
                                        <time dateTime={contact.last_message.created_at}>
                                            {formatPreviewTime(
                                                contact.last_message.created_at,
                                            )}
                                        </time>
                                    )}
                                </span>
                                <span className="inbox-contact-subject">
                                    {contact.unread_count > 0 && (
                                        <span className="inbox-unread-dot" aria-hidden="true" />
                                    )}
                                    <strong>
                                        {contact.last_message?.body ?? "Start a conversation"}
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
                                    {contact.role_label} · {contact.email}
                                </span>
                            </button>
                        ))}

                        {filteredContacts.length === 0 && (
                            <div className="inbox-no-results">
                                {search
                                    ? `No ${activeTab} messages match “${search}”.`
                                    : `No ${activeTab} messages to show.`}
                            </div>
                        )}
                    </div>
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
                                            Send a message to {selectedContact.name}. It
                                            will appear in their {selectedContact.role_label}
                                            inbox.
                                        </p>
                                    </div>
                                )}

                                {messages.map((message, index) => {
                                    const mine = message.sender_id === currentUser.id;
                                    const previous = messages[index - 1];
                                    const showDay =
                                        !previous ||
                                        new Date(previous.created_at).toDateString() !==
                                            new Date(message.created_at).toDateString();

                                    return (
                                        <div key={message.id}>
                                            {showDay && (
                                                <div className="inbox-day-divider">
                                                    <span>{formatDay(message.created_at)}</span>
                                                </div>
                                            )}
                                            <div
                                                className={`inbox-message-row ${
                                                    mine ? "mine" : "theirs"
                                                }`}
                                            >
                                                <div className="inbox-message-bubble">
                                                    <p>{message.body}</p>
                                                    {message.attachments?.length > 0 && (
                                                        <div className="inbox-message-attachments">
                                                            {message.attachments.map(
                                                                (attachment) =>
                                                                    attachment.is_image ? (
                                                                        <a
                                                                            key={attachment.id}
                                                                            className="inbox-image-attachment"
                                                                            href={attachment.url}
                                                                            target="_blank"
                                                                            rel="noreferrer"
                                                                            aria-label={`Open ${attachment.name}`}
                                                                        >
                                                                            <img
                                                                                src={attachment.url}
                                                                                alt={attachment.name}
                                                                                loading="lazy"
                                                                            />
                                                                            <span>
                                                                                {attachment.name}
                                                                            </span>
                                                                        </a>
                                                                    ) : (
                                                                        <a
                                                                            key={attachment.id}
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
                                                        <time dateTime={message.created_at}>
                                                            {formatTime(message.created_at)}
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

                            <form className="inbox-composer" onSubmit={sendReply}>
                                {replyData.attachments.length > 0 && (
                                    <div className="inbox-selected-attachments inbox-reply-attachments">
                                        {replyData.attachments.map((file, index) => (
                                            <span
                                                key={`${file.name}-${file.size}-${file.lastModified}`}
                                                className="inbox-selected-attachment"
                                            >
                                                <FaPaperclip />
                                                <span title={file.name}>{file.name}</span>
                                                <small>{formatFileSize(file.size)}</small>
                                                <button
                                                    type="button"
                                                    onClick={() =>
                                                        removeAttachment(
                                                            {
                                                                data: replyData,
                                                                setData: setReplyData,
                                                                clearErrors: clearReplyErrors,
                                                            },
                                                            index,
                                                        )
                                                    }
                                                    aria-label={`Remove ${file.name}`}
                                                >
                                                    <FaXmark />
                                                </button>
                                            </span>
                                        ))}
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
                                        replyData.attachments.length >= MAX_ATTACHMENTS
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
                                            setReplyData("body", event.target.value)
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
                                        !replyData.body.trim() || replyProcessing
                                    }
                                >
                                    <FaPaperPlane />
                                    <span>{replyProcessing ? "Sending" : "Send"}</span>
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
                                <div className="inbox-compose-field inbox-compose-recipients">
                                    <span>To (Recipients)</span>
                                    <input
                                        ref={composeRecipientRef}
                                        type="search"
                                        placeholder="Search users..."
                                        value={composeRecipientSearch}
                                        onChange={(event) =>
                                            setComposeRecipientSearch(event.target.value)
                                        }
                                        aria-label="Search message recipients"
                                    />
                                    <div className="inbox-recipient-toolbar">
                                        <span>
                                            {composeForm.data.recipient_ids.length} selected
                                        </span>
                                        <button
                                            type="button"
                                            onClick={toggleVisibleRecipients}
                                            disabled={filteredComposeContacts.length === 0}
                                        >
                                            {filteredComposeContacts.length > 0 &&
                                            filteredComposeContacts.every((contact) =>
                                                composeForm.data.recipient_ids.includes(
                                                    contact.id,
                                                ),
                                            )
                                                ? "Deselect visible"
                                                : "Select visible"}
                                        </button>
                                    </div>
                                    <div
                                        className="inbox-recipient-options"
                                        role="group"
                                        aria-label="Select message recipients"
                                    >
                                        {filteredComposeContacts.map((contact) => {
                                            const checked =
                                                composeForm.data.recipient_ids.includes(
                                                    contact.id,
                                                );

                                            return (
                                                <label
                                                    key={contact.id}
                                                    className={checked ? "selected" : ""}
                                                >
                                                    <input
                                                        type="checkbox"
                                                        checked={checked}
                                                        onChange={() =>
                                                            toggleComposeRecipient(contact.id)
                                                        }
                                                    />
                                                    <span
                                                        className={`inbox-avatar role-${contact.role}`}
                                                        aria-hidden="true"
                                                    >
                                                        {initials(contact.name)}
                                                    </span>
                                                    <span className="inbox-recipient-copy">
                                                        <strong>{contact.name}</strong>
                                                        <small>
                                                            {contact.role_label} · {contact.email}
                                                        </small>
                                                    </span>
                                                </label>
                                            );
                                        })}

                                        {filteredComposeContacts.length === 0 && (
                                            <p>No users match your search.</p>
                                        )}
                                    </div>
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
                                            setComposeSubject(event.target.value)
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
                                                composeForm.data.attachments.length >=
                                                    MAX_ATTACHMENTS
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
                                                composeForm.data.attachments.length >=
                                                    MAX_ATTACHMENTS
                                            }
                                        >
                                            <FaImage />
                                            Attach Image
                                        </button>
                                    </div>
                                    {composeForm.data.attachments.length > 0 && (
                                        <div className="inbox-selected-attachments">
                                            {composeForm.data.attachments.map(
                                                (file, index) => (
                                                    <span
                                                        key={`${file.name}-${file.size}-${file.lastModified}`}
                                                        className="inbox-selected-attachment"
                                                    >
                                                        {file.type.startsWith("image/") ? (
                                                            <FaImage />
                                                        ) : (
                                                            <FaPaperclip />
                                                        )}
                                                        <span title={file.name}>
                                                            {file.name}
                                                        </span>
                                                        <small>
                                                            {formatFileSize(file.size)}
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
                                    firstAttachmentError(composeForm.errors)) && (
                                    <p className="inbox-compose-error">
                                        {composeForm.errors.body ??
                                            firstRecipientError(composeForm.errors) ??
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
                                            composeForm.data.recipient_ids.length === 0 ||
                                            !composeForm.data.body.trim() ||
                                            composeForm.processing
                                        }
                                    >
                                        {composeForm.processing ? "Sending" : "Send"}
                                    </button>
                                </footer>
                            </form>
                        </section>
                    </div>
                )}
            </section>
        </DashboardLayout>
    );
}
