import * as vscode from 'vscode';
import { ReviewSession } from '../review/reviewSession';

/**
 * Status bar item that shows review progress during an active session.
 */
export class ReviewStatusBarItem {
    private item: vscode.StatusBarItem;

    constructor() {
        this.item = vscode.window.createStatusBarItem(
            vscode.StatusBarAlignment.Left,
            100,
        );
        this.item.command = 'redline.submitReview';
    }

    /**
     * Update the status bar with current review session stats.
     */
    update(session: ReviewSession | null): void {
        if (!session) {
            this.item.hide();
            return;
        }

        const stats = session.getStats();
        const mustFixCount = stats.mustFix;

        this.item.text = `$(eye) Review: ${stats.filesReviewed}/${stats.filesChanged} files · ${stats.totalComments} comments`;

        if (mustFixCount > 0) {
            this.item.backgroundColor = new vscode.ThemeColor('statusBarItem.warningBackground');
            this.item.tooltip = `Redline review in progress — ${mustFixCount} must-fix comment(s). Click to submit.`;
        } else {
            this.item.backgroundColor = undefined;
            this.item.tooltip = 'Redline review in progress. Click to submit.';
        }

        this.item.show();
    }

    dispose(): void {
        this.item.dispose();
    }
}
