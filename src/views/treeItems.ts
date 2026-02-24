import * as vscode from 'vscode';
import * as path from 'path';
import { ChangedFile, FileStatus } from '../git/types';

const STATUS_ICONS: Record<FileStatus, vscode.ThemeIcon> = {
    added: new vscode.ThemeIcon('diff-added', new vscode.ThemeColor('gitDecoration.addedResourceForeground')),
    modified: new vscode.ThemeIcon('diff-modified', new vscode.ThemeColor('gitDecoration.modifiedResourceForeground')),
    deleted: new vscode.ThemeIcon('diff-removed', new vscode.ThemeColor('gitDecoration.deletedResourceForeground')),
    renamed: new vscode.ThemeIcon('diff-renamed', new vscode.ThemeColor('gitDecoration.renamedResourceForeground')),
};

export type RedlineTreeItem = ChangedFileItem | DirectoryItem;

/**
 * TreeItem representing a single changed file in the sidebar.
 */
export class ChangedFileItem extends vscode.TreeItem {
    public readonly file: ChangedFile;
    public reviewed: boolean;

    constructor(file: ChangedFile, reviewed: boolean) {
        super(path.basename(file.path), vscode.TreeItemCollapsibleState.None);
        this.file = file;
        this.reviewed = reviewed;

        // Description shows line changes
        const lineInfo = `+${file.additions} -${file.deletions}`;
        this.description = lineInfo;

        // Tooltip with full info
        this.tooltip = new vscode.MarkdownString();
        this.tooltip.appendMarkdown(`**${file.path}**\n\n`);
        this.tooltip.appendMarkdown(`Status: ${file.status}\n\n`);
        this.tooltip.appendMarkdown(`Changes: +${file.additions} / -${file.deletions}\n\n`);
        if (reviewed) {
            this.tooltip.appendMarkdown(`✅ Reviewed`);
        }

        // Icon based on file status
        this.iconPath = STATUS_ICONS[file.status];

        // Context value for menus
        this.contextValue = reviewed ? 'changedFile-reviewed' : 'changedFile';

        // Click to open diff
        this.command = {
            command: 'redline.openFileDiff',
            title: 'Open Diff',
            arguments: [file],
        };

        // Show checkmark decoration if reviewed
        if (reviewed) {
            this.label = `✓ ${this.label}`;
        }
    }
}

/**
 * TreeItem representing a directory in the sidebar.
 */
export class DirectoryItem extends vscode.TreeItem {
    public readonly relativePath: string;
    public readonly children: Map<string, RedlineTreeItem> = new Map();

    constructor(name: string, relativePath: string) {
        super(name, vscode.TreeItemCollapsibleState.Expanded);
        this.relativePath = relativePath;
        this.iconPath = vscode.ThemeIcon.Folder;
        this.contextValue = 'directory';
    }

    /**
     * Get summary status for the directory (e.g. how many reviewed).
     */
    updateDescription(): void {
        const stats = this.getDeepStats();
        if (stats.total > 0) {
            this.description = `${stats.reviewed}/${stats.total} reviewed`;
        }
    }

    private getDeepStats(): { reviewed: number; total: number } {
        let reviewed = 0;
        let total = 0;

        for (const child of this.children.values()) {
            if (child instanceof ChangedFileItem) {
                total++;
                if (child.reviewed) { reviewed++; }
            } else if (child instanceof DirectoryItem) {
                const childStats = child.getDeepStats();
                total += childStats.total;
                reviewed += childStats.reviewed;
            }
        }

        return { reviewed, total };
    }
}
