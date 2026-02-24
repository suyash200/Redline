import * as vscode from 'vscode';
import { GitService } from '../git/gitService';
import { ReviewSession } from './reviewSession';
import { ReviewDecision } from './types';
import { saveReview, getReviewHistory } from './reviewStorage';
import { DiffContentProvider } from '../diff/diffProvider';
import { openFileDiff } from '../diff/diffCommands';
import { ReviewCommentController, ReviewCommentItem } from '../comments/commentController';
import { ChangedFilesProvider } from '../views/changedFilesProvider';
import { ReviewSummaryPanel } from '../views/reviewSummaryPanel';
import { ReviewStatusBarItem } from '../views/statusBarItem';
import { ChangedFile } from '../git/types';
import { getConfig } from '../utils/config';
import { logInfo, logError, logWarn } from '../utils/logger';

/**
 * Central orchestrator for the review lifecycle.
 */
export class ReviewManager {
    private session: ReviewSession | null = null;
    private summaryPanel: ReviewSummaryPanel | null = null;

    private gitService: GitService;
    private diffProvider: DiffContentProvider;
    private commentController: ReviewCommentController;
    private changedFilesProvider: ChangedFilesProvider;
    private statusBarItem: ReviewStatusBarItem;
    private workspaceRoot: string;

    // Index of current file for next/prev navigation
    private currentFileIndex: number = 0;

    constructor(
        workspaceRoot: string,
        diffProvider: DiffContentProvider,
        commentController: ReviewCommentController,
        changedFilesProvider: ChangedFilesProvider,
        statusBarItem: ReviewStatusBarItem,
    ) {
        this.workspaceRoot = workspaceRoot;
        this.gitService = new GitService(workspaceRoot);
        this.diffProvider = diffProvider;
        this.commentController = commentController;
        this.changedFilesProvider = changedFilesProvider;
        this.statusBarItem = statusBarItem;
    }

    // ── Start Review ──────────────────────────────────────────────

    async startReview(): Promise<void> {
        if (this.session) {
            const choice = await vscode.window.showWarningMessage(
                'A review is already in progress. Discard it and start a new one?',
                'Discard & Start New',
                'Cancel',
            );
            if (choice !== 'Discard & Start New') { return; }
            this.cancelReview();
        }

        // Validate git repo
        const isGit = await this.gitService.isGitRepo();
        if (!isGit) {
            vscode.window.showErrorMessage('Redline: This workspace is not a git repository.');
            return;
        }

        // Get base ref
        const config = getConfig();
        const baseRef = await this.pickBaseRef(config.baseRef);
        if (!baseRef) { return; }

        // Validate the ref
        const valid = await this.gitService.isValidRef(baseRef);
        if (!valid) {
            vscode.window.showErrorMessage(`Redline: Invalid git reference "${baseRef}".`);
            return;
        }

        try {
            const headRef = 'HEAD';
            const files = await this.gitService.getChangedFiles(baseRef, headRef);

            if (files.length === 0) {
                vscode.window.showInformationMessage('Redline: No changes found between the selected references.');
                return;
            }

            // Create session
            this.session = new ReviewSession(baseRef, headRef, files);

            // Wire up providers
            this.diffProvider.clearCache();
            this.commentController.setSession(this.session);
            this.changedFilesProvider.setSession(this.session);
            this.statusBarItem.update(this.session);
            this.currentFileIndex = 0;

            // Set context for menu visibility
            vscode.commands.executeCommand('setContext', 'redline.active', true);

            logInfo(`Review started: ${baseRef}..${headRef} (${files.length} files)`);
            vscode.window.showInformationMessage(
                `Redline started: ${files.length} changed file(s). Click files in the sidebar to review.`,
            );
        } catch (err) {
            logError('Failed to start review', err);
            vscode.window.showErrorMessage(`Redline: Failed to start review. ${err}`);
        }
    }

    // ── Submit Review ─────────────────────────────────────────────

    async submitReview(): Promise<void> {
        if (!this.session) {
            vscode.window.showWarningMessage('Redline: No active review session.');
            return;
        }

        this.summaryPanel = new ReviewSummaryPanel(
            this.session,
            (decision, summary, autoFix) => this.handleSubmit(decision, summary, autoFix),
        );
        this.summaryPanel.show();
    }

    private async handleSubmit(decision: ReviewDecision, summary: string, autoFix: boolean): Promise<void> {
        if (!this.session) { return; }

        try {
            const reviewData = this.session.toReviewData(decision, summary);
            const filePath = await saveReview(this.workspaceRoot, reviewData);

            const decisionLabels: Record<ReviewDecision, string> = {
                approve: '✅ Approved',
                comment: '💬 Commented',
                request_changes: '🔄 Changes Requested',
            };

            logInfo(`Review submitted: ${decisionLabels[decision]} → ${filePath}`);

            if (autoFix) {
                await this.runAutoFix(filePath);
            } else {
                const action = await vscode.window.showInformationMessage(
                    `Review submitted: ${decisionLabels[decision]}. Saved to ${filePath}`,
                    'Open Review File',
                    'Close Review',
                );

                if (action === 'Open Review File') {
                    const doc = await vscode.workspace.openTextDocument(filePath);
                    await vscode.window.showTextDocument(doc, { preview: false });
                }
            }

            this.cancelReview();
        } catch (err) {
            logError('Failed to submit review', err);
            vscode.window.showErrorMessage(`Redline: Failed to submit review. ${err}`);
        }
    }

    // ── Auto Fix ──────────────────────────────────────────────────

    private async runAutoFix(_reviewPath: string): Promise<void> {
        logInfo('Triggering Auto-Fix via @redline /fix chat participant');

        try {
            // Open the VS Code chat panel with @redline /fix pre-populated.
            // The @redline chat participant (registered in chat/chatParticipant.ts)
            // handles the actual LLM call — it reads .redline/latest.toml and
            // asks the model to apply the fixes.
            await vscode.commands.executeCommand(
                'workbench.action.chat.open',
                { query: '@redline /fix' },
            );

            logInfo('Chat opened with @redline /fix');
        } catch (err) {
            logError('Failed to open chat for auto-fix', err);

            // Fallback: show a message telling the user to invoke it manually
            const action = await vscode.window.showWarningMessage(
                '⚡ Redline: Could not open AI chat. Type `@redline /fix` in the chat panel manually.',
                'Open Review File',
            );

            if (action === 'Open Review File') {
                const doc = await vscode.workspace.openTextDocument(_reviewPath);
                await vscode.window.showTextDocument(doc, { preview: false });
            }
        }
    }

    // ── Cancel Review ─────────────────────────────────────────────

    cancelReview(): void {
        this.session = null;
        this.commentController.setSession(null);
        this.changedFilesProvider.setSession(null);
        this.statusBarItem.update(null);
        this.summaryPanel?.dispose();
        this.summaryPanel = null;
        this.diffProvider.clearCache();
        this.currentFileIndex = 0;
        vscode.commands.executeCommand('setContext', 'redline.active', false);
        logInfo('Review cancelled/closed');
    }

    // ── File Navigation ───────────────────────────────────────────

    openFileDiff(file: ChangedFile): void {
        if (!this.session) { return; }
        openFileDiff(file, this.session.baseRef, this.workspaceRoot);

        // Update current index
        const paths = this.session.getFilePaths();
        const idx = paths.indexOf(file.path);
        if (idx >= 0) {
            this.currentFileIndex = idx;
        }
    }

    nextFile(): void {
        if (!this.session) { return; }
        const paths = this.session.getFilePaths();
        if (paths.length === 0) { return; }

        this.currentFileIndex = (this.currentFileIndex + 1) % paths.length;
        const file = this.session.getFileByPath(paths[this.currentFileIndex]);
        if (file) {
            this.openFileDiff(file);
        }
    }

    prevFile(): void {
        if (!this.session) { return; }
        const paths = this.session.getFilePaths();
        if (paths.length === 0) { return; }

        this.currentFileIndex = (this.currentFileIndex - 1 + paths.length) % paths.length;
        const file = this.session.getFileByPath(paths[this.currentFileIndex]);
        if (file) {
            this.openFileDiff(file);
        }
    }

    // ── Mark File Reviewed ────────────────────────────────────────

    markFileReviewed(file?: ChangedFile): void {
        if (!this.session) { return; }

        let targetPath: string | undefined;
        if (file) {
            targetPath = file.path;
        } else {
            // Try to find from active editor
            const activeUri = vscode.window.activeTextEditor?.document.uri;
            if (activeUri && activeUri.scheme === 'file') {
                const relativePath = vscode.workspace.asRelativePath(activeUri, false);
                targetPath = relativePath.replace(/\\/g, '/');
            }
        }

        if (!targetPath) {
            vscode.window.showWarningMessage('Redline: No file to mark as reviewed.');
            return;
        }

        const toggled = this.session.toggleFileReviewed(targetPath);
        this.changedFilesProvider.refresh();
        this.statusBarItem.update(this.session);

        vscode.window.showInformationMessage(
            toggled
                ? `✓ ${targetPath} marked as reviewed`
                : `${targetPath} unmarked as reviewed`,
        );
    }

    // ── Comment Handlers ──────────────────────────────────────────

    async createComment(reply: vscode.CommentReply): Promise<void> {
        await this.commentController.handleCreateComment(reply);
        this.statusBarItem.update(this.session);
        this.changedFilesProvider.refresh();
    }

    async replyComment(reply: vscode.CommentReply): Promise<void> {
        await this.commentController.handleReplyComment(reply);
        this.statusBarItem.update(this.session);
    }

    saveComment(comment: ReviewCommentItem): void {
        this.commentController.handleSaveComment(comment);
    }

    editComment(comment: ReviewCommentItem): void {
        this.commentController.handleEditComment(comment);
    }

    cancelEdit(comment: ReviewCommentItem): void {
        this.commentController.handleCancelEdit(comment);
    }

    deleteComment(comment: ReviewCommentItem): void {
        this.commentController.handleDeleteComment(comment);
        this.statusBarItem.update(this.session);
        this.changedFilesProvider.refresh();
    }

    toggleResolved(comment: ReviewCommentItem): void {
        this.commentController.handleToggleResolved(comment);
    }

    // ── Change Base Ref ───────────────────────────────────────────

    async changeBaseRef(): Promise<void> {
        const config = getConfig();
        const ref = await this.pickBaseRef(config.baseRef);
        if (!ref) { return; }

        // If review is active, restart with new ref
        if (this.session) {
            this.cancelReview();
        }

        // Update config and start new review
        const configTarget = vscode.ConfigurationTarget.Workspace;
        await vscode.workspace.getConfiguration('redline').update('baseRef', ref, configTarget);
        await this.startReview();
    }

    // ── Show History ──────────────────────────────────────────────

    async showHistory(): Promise<void> {
        const history = getReviewHistory(this.workspaceRoot);

        if (history.length === 0) {
            vscode.window.showInformationMessage('Redline: No review history found.');
            return;
        }

        const items = history.map((entry) => ({
            label: entry.name,
            description: entry.date.toLocaleDateString() + ' ' + entry.date.toLocaleTimeString(),
            path: entry.path,
        }));

        const picked = await vscode.window.showQuickPick(items, {
            placeHolder: 'Select a past review to view',
            title: 'Review History',
        });

        if (picked) {
            const doc = await vscode.workspace.openTextDocument(picked.path);
            await vscode.window.showTextDocument(doc, { preview: false });
        }
    }

    // ── Refresh ───────────────────────────────────────────────────

    async refreshFiles(): Promise<void> {
        if (!this.session) { return; }

        try {
            const files = await this.gitService.getChangedFiles(
                this.session.baseRef,
                this.session.headRef,
            );
            // Recreate session preserving comments (simplified: restart)
            logInfo(`Refreshed: ${files.length} changed files`);
            this.changedFilesProvider.refresh();
        } catch (err) {
            logError('Failed to refresh files', err);
        }
    }

    // ── Helpers ───────────────────────────────────────────────────

    private async pickBaseRef(defaultRef: string): Promise<string | undefined> {
        // Show recent commits as QuickPick options
        try {
            const commits = await this.gitService.getRecentCommits(15);

            // Build items: selecting a commit means "review changes from this commit onwards"
            // So we use commit~1 (parent) as the actual base reference
            const commitItems = commits.map((c) => ({
                label: `${c.hash.substring(0, 7)}  ${c.message}`,
                description: `${c.author} · ${c.date}`,
                detail: '↳ Review changes introduced by this commit',
                // The actual value to use: parent of this commit
                baseRef: `${c.hash.substring(0, 7)}~1`,
            }));

            const items: (vscode.QuickPickItem & { baseRef?: string })[] = [
                {
                    label: defaultRef,
                    description: '(default from settings)',
                    detail: `↳ Compare ${defaultRef}..HEAD`,
                    baseRef: defaultRef,
                },
                { label: '', kind: vscode.QuickPickItemKind.Separator },
                ...commitItems,
            ];

            const picked = await vscode.window.showQuickPick(items, {
                placeHolder: 'Select a commit to review (shows changes from that commit onwards)',
                title: 'AI Review — What do you want to review?',
            });

            if (!picked) { return undefined; }

            const selectedRef = (picked as { baseRef?: string }).baseRef;
            if (!selectedRef) { return undefined; }

            // Validate the ref — if commit~1 doesn't exist (initial commit),
            // fall back to the empty tree hash to show all files as added
            const valid = await this.gitService.isValidRef(selectedRef);
            if (!valid) {
                logWarn(`Ref "${selectedRef}" has no parent (initial commit?), using empty tree.`);
                // Git's well-known empty tree hash
                return '4b825dc642cb6eb9a060e54bf899d15f3b4bab47';
            }

            return selectedRef;
        } catch {
            // Fallback to text input
            return vscode.window.showInputBox({
                prompt: 'Enter base git reference (e.g. HEAD~1, main, abc1234)',
                value: defaultRef,
                title: 'AI Review — Base Reference',
            });
        }
    }

    get isActive(): boolean {
        return this.session !== null;
    }

    dispose(): void {
        this.cancelReview();
    }
}
