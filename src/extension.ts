import * as vscode from 'vscode';
import { GitService } from './git/gitService';
import { DiffContentProvider, DIFF_SCHEME } from './diff/diffProvider';
import { ReviewCommentController, ReviewCommentItem } from './comments/commentController';
import { ChangedFilesProvider } from './views/changedFilesProvider';
import { ReviewStatusBarItem } from './views/statusBarItem';
import { ReviewManager } from './review/reviewManager';
import { ChangedFile } from './git/types';
import { logInfo, disposeLogger } from './utils/logger';
import { registerChatParticipant } from './chat/chatParticipant';

let reviewManager: ReviewManager;

export function activate(context: vscode.ExtensionContext) {
    logInfo('Redline extension activating...');

    const workspaceRoot = getWorkspaceRoot();
    if (!workspaceRoot) {
        logInfo('No workspace folder open — extension idle.');
        return;
    }

    // ── Initialize services ───────────────────────────────────────

    const gitService = new GitService(workspaceRoot);
    const diffProvider = new DiffContentProvider(gitService);
    const commentController = new ReviewCommentController(workspaceRoot);
    const changedFilesProvider = new ChangedFilesProvider();
    const statusBarItem = new ReviewStatusBarItem();

    reviewManager = new ReviewManager(
        workspaceRoot,
        diffProvider,
        commentController,
        changedFilesProvider,
        statusBarItem,
    );

    // ── Register content provider ─────────────────────────────────

    context.subscriptions.push(
        vscode.workspace.registerTextDocumentContentProvider(DIFF_SCHEME, diffProvider),
    );

    // ── Register tree view ────────────────────────────────────────

    const treeView = vscode.window.createTreeView('redline.changedFiles', {
        treeDataProvider: changedFilesProvider,
        showCollapseAll: false,
    });
    context.subscriptions.push(treeView);

    // ── Register commands ─────────────────────────────────────────

    const commands: [string, (...args: any[]) => any][] = [
        ['redline.startReview', () => reviewManager.startReview()],
        ['redline.submitReview', () => reviewManager.submitReview()],
        ['redline.cancelReview', () => reviewManager.cancelReview()],
        ['redline.refreshFiles', () => reviewManager.refreshFiles()],
        ['redline.changeBaseRef', () => reviewManager.changeBaseRef()],
        ['redline.showHistory', () => reviewManager.showHistory()],

        // File navigation
        ['redline.openFileDiff', (file: ChangedFile) => reviewManager.openFileDiff(file)],
        ['redline.nextFile', () => reviewManager.nextFile()],
        ['redline.prevFile', () => reviewManager.prevFile()],
        ['redline.markFileReviewed', (item: any) => {
            const file = item?.file as ChangedFile | undefined;
            reviewManager.markFileReviewed(file);
        }],

        // Comment actions
        ['redline.createComment', (reply: vscode.CommentReply) => reviewManager.createComment(reply)],
        ['redline.replyComment', (reply: vscode.CommentReply) => reviewManager.replyComment(reply)],
        ['redline.saveComment', (comment: ReviewCommentItem) => reviewManager.saveComment(comment)],
        ['redline.editComment', (comment: ReviewCommentItem) => reviewManager.editComment(comment)],
        ['redline.cancelEdit', (comment: ReviewCommentItem) => reviewManager.cancelEdit(comment)],
        ['redline.deleteComment', (comment: ReviewCommentItem) => reviewManager.deleteComment(comment)],
        ['redline.toggleResolved', (comment: ReviewCommentItem) => reviewManager.toggleResolved(comment)],
    ];

    for (const [id, handler] of commands) {
        context.subscriptions.push(vscode.commands.registerCommand(id, handler));
    }

    // ── Register disposables ──────────────────────────────────────

    context.subscriptions.push(
        diffProvider,
        commentController,
        changedFilesProvider,
        statusBarItem,
        { dispose: () => reviewManager.dispose() },
    );

    // ── Register chat participant ─────────────────────────────────

    registerChatParticipant(context, workspaceRoot);

    // Set initial context
    vscode.commands.executeCommand('setContext', 'redline.active', false);

    logInfo('Redline extension activated');
}

export function deactivate() {
    disposeLogger();
}

function getWorkspaceRoot(): string | undefined {
    const folders = vscode.workspace.workspaceFolders;
    if (!folders || folders.length === 0) {
        return undefined;
    }
    return folders[0].uri.fsPath;
}
