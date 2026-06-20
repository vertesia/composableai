import type { DocumentComment, DocumentCommentAnchor, DocumentCommentStatus } from '@vertesia/common';
import { Button, Textarea } from '@vertesia/ui/core';
import { useUITranslation } from '@vertesia/ui/i18n';
import { CheckIcon, Loader2Icon, Trash2Icon } from 'lucide-react';
import { useState } from 'react';

interface DocumentCommentsSidebarProps {
    comments: DocumentComment[];
    /** True while the comments artifact is still loading. */
    isLoading?: boolean;
    currentAuthor: string;
    editable: boolean;
    /** When set, a composer is shown for a comment about this anchor. */
    pendingAnchor: DocumentCommentAnchor | null;
    onSubmitPending: (body: string) => void;
    onCancelPending: () => void;
    onSetStatus: (id: string, status: DocumentCommentStatus) => void;
    onDelete: (id: string) => void;
}

export function DocumentCommentsSidebar({
    comments,
    isLoading = false,
    currentAuthor,
    editable,
    pendingAnchor,
    onSubmitPending,
    onCancelPending,
    onSetStatus,
    onDelete,
}: DocumentCommentsSidebarProps) {
    const { t } = useUITranslation();
    const [draft, setDraft] = useState('');

    const submit = () => {
        const body = draft.trim();
        if (!body) return;
        onSubmitPending(body);
        setDraft('');
    };
    const cancel = () => {
        setDraft('');
        onCancelPending();
    };

    const authorLabel = (author: string): string => {
        if (author === 'agent') return t('agent.agentAuthor');
        if (author === currentAuthor) return t('agent.you');
        return author;
    };

    return (
        <div className="flex flex-col h-full">
            {pendingAnchor && (
                <div className="p-2 border-b border-muted/20">
                    {pendingAnchor.quote && (
                        <div className="mb-1 text-xs text-muted border-s-2 border-muted/40 ps-2 line-clamp-2">
                            “{pendingAnchor.quote}”
                        </div>
                    )}
                    <Textarea
                        value={draft}
                        onChange={(e) => setDraft(e.target.value)}
                        placeholder={t('agent.commentPlaceholder')}
                        rows={3}
                    />
                    <div className="flex justify-end gap-1 mt-1">
                        <Button variant="ghost" size="sm" onClick={cancel}>
                            {t('agent.cancel')}
                        </Button>
                        <Button size="sm" onClick={submit} disabled={!draft.trim()}>
                            {t('agent.addComment')}
                        </Button>
                    </div>
                </div>
            )}

            <div className="flex-1 overflow-y-auto">
                {comments.length === 0 && !pendingAnchor ? (
                    isLoading ? (
                        <div className="p-4 flex items-center justify-center text-muted">
                            <Loader2Icon className="size-4 animate-spin" />
                        </div>
                    ) : (
                        <div className="p-4 text-center text-sm text-muted">{t('agent.noCommentsYet')}</div>
                    )
                ) : (
                    comments.map((comment) => (
                        <div key={comment.id} className="p-2 border-b border-muted/10">
                            {comment.anchor.quote && (
                                <div className="mb-1 text-xs text-muted border-s-2 border-muted/40 ps-2 line-clamp-2">
                                    “{comment.anchor.quote}”
                                </div>
                            )}
                            <div
                                className={
                                    comment.status === 'resolved' ? 'text-sm text-muted line-through' : 'text-sm'
                                }
                            >
                                {comment.body}
                            </div>
                            <div className="flex items-center gap-2 mt-1">
                                <span className="text-xs text-muted">{authorLabel(comment.author)}</span>
                                {comment.status === 'resolved' && (
                                    <span className="text-xs px-1.5 py-0.5 rounded bg-success/15 text-success">
                                        {t('agent.commentResolved')}
                                    </span>
                                )}
                                {editable && (
                                    <div className="ms-auto flex items-center gap-1">
                                        {comment.status === 'resolved' ? (
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                onClick={() => onSetStatus(comment.id, 'open')}
                                            >
                                                {t('agent.reopen')}
                                            </Button>
                                        ) : (
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                onClick={() => onSetStatus(comment.id, 'resolved')}
                                            >
                                                <CheckIcon className="size-3.5 me-1" />
                                                {t('agent.resolve')}
                                            </Button>
                                        )}
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            aria-label={t('agent.deleteComment')}
                                            onClick={() => onDelete(comment.id)}
                                        >
                                            <Trash2Icon className="size-3.5 text-destructive" />
                                        </Button>
                                    </div>
                                )}
                            </div>
                        </div>
                    ))
                )}
            </div>
        </div>
    );
}
