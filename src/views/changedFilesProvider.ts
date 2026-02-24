import * as vscode from 'vscode';
import { ReviewSession } from '../review/reviewSession';
import { ChangedFileItem } from './changedFileItem';

/**
 * TreeDataProvider that populates the "Changed Files" sidebar panel.
 */
export class ChangedFilesProvider implements vscode.TreeDataProvider<ChangedFileItem> {
    private _onDidChangeTreeData = new vscode.EventEmitter<ChangedFileItem | undefined>();
    readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

    private session: ReviewSession | null = null;

    /**
     * Update the active review session and refresh the tree.
     */
    setSession(session: ReviewSession | null): void {
        this.session = session;
        this.refresh();
    }

    /**
     * Refresh the tree view.
     */
    refresh(): void {
        this._onDidChangeTreeData.fire(undefined);
    }

    getTreeItem(element: ChangedFileItem): vscode.TreeItem {
        return element;
    }

    getChildren(_element?: ChangedFileItem): Thenable<ChangedFileItem[]> {
        if (!this.session) {
            return Promise.resolve([]);
        }

        const files = this.session.getFiles();

        // Sort: unreviewed first, then by path
        const items = files
            .map((file) => {
                const reviewed = this.session!.isFileReviewed(file.path);
                return new ChangedFileItem(file, reviewed);
            })
            .sort((a, b) => {
                if (a.reviewed !== b.reviewed) {
                    return a.reviewed ? 1 : -1; // Unreviewed first
                }
                return a.file.path.localeCompare(b.file.path);
            });

        return Promise.resolve(items);
    }

    dispose(): void {
        this._onDidChangeTreeData.dispose();
    }
}
