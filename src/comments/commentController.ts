import * as vscode from 'vscode';
import * as path from 'path';
import { ReviewSession } from '../review/reviewSession';
import { CommentSeverity, SEVERITY_LABELS, SEVERITY_ORDER } from '../review/types';
import { getConfig } from '../utils/config';
import { logInfo } from '../utils/logger';

/**
 * Internal comment class that implements vscode.Comment and stores our metadata.
 */
export class ReviewCommentItem implements vscode.Comment {
    body: string | vscode.MarkdownString;
    mode: vscode.CommentMode;
    author: vscode.CommentAuthorInformation;
    label?: string;
    contextValue?: string;
    timestamp?: Date;

    /** Our internal review comment ID */
    reviewCommentId: string;
    severity: CommentSeverity;

    constructor(
        body: string,
        severity: CommentSeverity,
        reviewCommentId: string,
        mode: vscode.CommentMode = vscode.CommentMode.Preview,
    ) {
        this.body = body;
        this.severity = severity;
        this.reviewCommentId = reviewCommentId;
        this.mode = mode;
        this.author = { name: '🔍 Reviewer' };
        this.label = SEVERITY_LABELS[severity];
        this.contextValue = 'reviewComment';
        this.timestamp = new Date();
    }
}

/**
 * Manages the VS Code CommentController for inline review comments.
 */
export class ReviewCommentController {
    private controller: vscode.CommentController;
    private threads: Map<string, vscode.CommentThread> = new Map();
    private session: ReviewSession | null = null;
    private workspaceRoot: string;

    constructor(workspaceRoot: string) {
        this.workspaceRoot = workspaceRoot;
        this.controller = vscode.comments.createCommentController(
            'redline-comments',
            'Redline Comments',
        );

        // Allow commenting on any line when a review is active
        this.controller.commentingRangeProvider = {
            provideCommentingRanges: (document: vscode.TextDocument): vscode.Range[] => {
                if (!this.session) {
                    return [];
                }

                // Only allow commenting on files that are part of the review
                const relativePath = this.getRelativePath(document.uri);
                if (!relativePath || !this.session.getFileByPath(relativePath)) {
                    return [];
                }

                return [new vscode.Range(0, 0, document.lineCount - 1, 0)];
            },
        };
    }

    /**
     * Set the active review session.
     */
    setSession(session: ReviewSession | null): void {
        this.session = session;
        if (!session) {
            this.clearAllThreads();
        }
    }

    /**
     * Handle the "Create Comment" action from the VS Code comment UI.
     */
    async handleCreateComment(reply: vscode.CommentReply): Promise<void> {
        if (!this.session) { return; }

        const severity = await this.pickSeverity();
        if (!severity) { return; } // User cancelled

        const relativePath = this.getRelativePath(reply.thread.uri);
        if (!relativePath) { return; }

        const range = reply.thread.range;
        const line = range ? range.start.line + 1 : 1; // 1-indexed

        // Get code context from the document
        let codeContext: string | undefined;
        try {
            const doc = await vscode.workspace.openTextDocument(reply.thread.uri);
            const startLine = range ? range.start.line : 0;
            codeContext = doc.lineAt(startLine).text.trim();
        } catch {
            // Ignore — code context is optional
        }

        // Store in review session
        const reviewComment = this.session.addComment(
            relativePath,
            line,
            reply.text,
            severity,
            undefined,
            codeContext,
        );

        // Create the VS Code comment
        const commentItem = new ReviewCommentItem(
            reply.text,
            severity,
            reviewComment.id,
            vscode.CommentMode.Preview,
        );

        reply.thread.comments = [...reply.thread.comments, commentItem];
        reply.thread.label = SEVERITY_LABELS[severity];
        reply.thread.contextValue = 'activeThread';

        // Track the thread
        this.threads.set(reviewComment.id, reply.thread);
        logInfo(`Comment added: ${relativePath}:${line} [${severity}]`);
    }

    /**
     * Handle reply to an existing comment thread.
     */
    async handleReplyComment(reply: vscode.CommentReply): Promise<void> {
        // Replies use the same flow as creation
        await this.handleCreateComment(reply);
    }

    /**
     * Handle saving an edited comment.
     */
    handleSaveComment(comment: ReviewCommentItem): void {
        if (!this.session) { return; }

        comment.mode = vscode.CommentMode.Preview;
        this.session.updateComment(
            comment.reviewCommentId,
            typeof comment.body === 'string' ? comment.body : comment.body.value,
            comment.severity,
        );

        // Refresh the thread display
        const thread = this.threads.get(comment.reviewCommentId);
        if (thread) {
            thread.comments = [...thread.comments];
        }
    }

    /**
     * Handle editing a comment (switch to edit mode).
     */
    handleEditComment(comment: ReviewCommentItem): void {
        comment.mode = vscode.CommentMode.Editing;

        const thread = this.threads.get(comment.reviewCommentId);
        if (thread) {
            thread.comments = [...thread.comments];
        }
    }

    /**
     * Handle cancelling an edit.
     */
    handleCancelEdit(comment: ReviewCommentItem): void {
        if (!this.session) { return; }

        const original = this.session.getComment(comment.reviewCommentId);
        if (original) {
            comment.body = original.body;
        }
        comment.mode = vscode.CommentMode.Preview;

        const thread = this.threads.get(comment.reviewCommentId);
        if (thread) {
            thread.comments = [...thread.comments];
        }
    }

    /**
     * Handle deleting a comment.
     */
    handleDeleteComment(comment: ReviewCommentItem): void {
        if (!this.session) { return; }

        this.session.removeComment(comment.reviewCommentId);

        const thread = this.threads.get(comment.reviewCommentId);
        if (thread) {
            thread.comments = thread.comments.filter(
                (c) => (c as ReviewCommentItem).reviewCommentId !== comment.reviewCommentId,
            );

            // If thread is empty, dispose it
            if (thread.comments.length === 0) {
                thread.dispose();
            }
        }

        this.threads.delete(comment.reviewCommentId);
        logInfo(`Comment deleted: ${comment.reviewCommentId}`);
    }

    /**
     * Handle toggling resolved state.
     */
    handleToggleResolved(comment: ReviewCommentItem): void {
        if (!this.session) { return; }

        const resolved = this.session.toggleResolved(comment.reviewCommentId);

        const thread = this.threads.get(comment.reviewCommentId);
        if (thread) {
            thread.contextValue = resolved ? 'resolvedThread' : 'activeThread';
            thread.collapsibleState = resolved
                ? vscode.CommentThreadCollapsibleState.Collapsed
                : vscode.CommentThreadCollapsibleState.Expanded;
        }

        logInfo(`Comment ${comment.reviewCommentId} ${resolved ? 'resolved' : 'unresolved'}`);
    }

    /**
     * Clear all comment threads.
     */
    clearAllThreads(): void {
        for (const thread of this.threads.values()) {
            thread.dispose();
        }
        this.threads.clear();
    }

    /**
     * Show a QuickPick for selecting comment severity.
     */
    private async pickSeverity(): Promise<CommentSeverity | undefined> {
        const config = getConfig();
        const items = SEVERITY_ORDER.map((sev) => ({
            label: SEVERITY_LABELS[sev],
            description: sev,
            severity: sev,
        }));

        // Put default severity first
        const defaultIndex = items.findIndex((i) => i.severity === config.defaultSeverity);
        if (defaultIndex > 0) {
            const [defaultItem] = items.splice(defaultIndex, 1);
            items.unshift(defaultItem);
        }

        const picked = await vscode.window.showQuickPick(items, {
            placeHolder: 'Select comment severity',
            title: 'Comment Severity',
        });

        return picked?.severity;
    }

    /**
     * Get the workspace-relative path for a URI.
     */
    private getRelativePath(uri: vscode.Uri): string | undefined {
        const fsPath = uri.fsPath;
        if (fsPath.startsWith(this.workspaceRoot)) {
            return path.relative(this.workspaceRoot, fsPath).replace(/\\/g, '/');
        }
        return undefined;
    }

    dispose(): void {
        this.clearAllThreads();
        this.controller.dispose();
    }
}
