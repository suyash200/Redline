import * as vscode from 'vscode';
import { ReviewSession } from '../review/reviewSession';
import { RedlineTreeItem, ChangedFileItem, DirectoryItem } from './treeItems';

/**
 * TreeDataProvider that populates the "Changed Files" sidebar panel.
 * Supports hierarchical directory views for better efficiency with nested files.
 */
export class ChangedFilesProvider implements vscode.TreeDataProvider<RedlineTreeItem> {
    private _onDidChangeTreeData = new vscode.EventEmitter<RedlineTreeItem | undefined>();
    readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

    private session: ReviewSession | null = null;
    private rootItems: RedlineTreeItem[] = [];

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
        this.buildTree();
        this._onDidChangeTreeData.fire(undefined);
    }

    getTreeItem(element: RedlineTreeItem): vscode.TreeItem {
        return element;
    }

    getChildren(element?: RedlineTreeItem): Thenable<RedlineTreeItem[]> {
        if (!this.session) {
            return Promise.resolve([]);
        }

        if (element instanceof DirectoryItem) {
            return Promise.resolve(
                Array.from(element.children.values()).sort(sortTreeItems)
            );
        }

        return Promise.resolve(this.rootItems);
    }

    private buildTree(): void {
        if (!this.session) {
            this.rootItems = [];
            return;
        }

        const files = this.session.getFiles();
        const rootMap = new Map<string, RedlineTreeItem>();

        for (const file of files) {
            const reviewed = this.session.isFileReviewed(file.path);
            const pathParts = file.path.split('/');

            let currentMap = rootMap;
            let currentPath = '';

            for (let i = 0; i < pathParts.length - 1; i++) {
                const part = pathParts[i];
                currentPath = currentPath ? `${currentPath}/${part}` : part;

                let dirItem = currentMap.get(part) as DirectoryItem;
                if (!dirItem) {
                    dirItem = new DirectoryItem(part, currentPath);
                    currentMap.set(part, dirItem);
                }
                currentMap = dirItem.children;
            }

            const fileName = pathParts[pathParts.length - 1];
            currentMap.set(fileName, new ChangedFileItem(file, reviewed));
        }

        // Update descriptions for all directories
        this.updateDirDescriptions(rootMap);

        this.rootItems = Array.from(rootMap.values()).sort(sortTreeItems);
    }

    private updateDirDescriptions(nodeMap: Map<string, RedlineTreeItem>): void {
        for (const item of nodeMap.values()) {
            if (item instanceof DirectoryItem) {
                this.updateDirDescriptions(item.children); // Recurse first
                item.updateDescription();
            }
        }
    }

    dispose(): void {
        this._onDidChangeTreeData.dispose();
    }
}

/**
 * Sort items: Folders first, then by reviewed status (unreviewed first), then alphabetical.
 */
function sortTreeItems(a: RedlineTreeItem, b: RedlineTreeItem): number {
    // Directories first
    if (a instanceof DirectoryItem && !(b instanceof DirectoryItem)) { return -1; }
    if (!(a instanceof DirectoryItem) && b instanceof DirectoryItem) { return 1; }

    if (a instanceof ChangedFileItem && b instanceof ChangedFileItem) {
        // Unreviewed first
        if (a.reviewed !== b.reviewed) {
            return a.reviewed ? 1 : -1;
        }
    }

    // Alphabetical
    return (a.label as string).localeCompare(b.label as string);
}
