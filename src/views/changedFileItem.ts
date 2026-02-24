import * as vscode from 'vscode';
import * as path from 'path';
import { ChangedFile, FileStatus } from '../git/types';

const STATUS_ICONS: Record<FileStatus, vscode.ThemeIcon> = {
    added: new vscode.ThemeIcon('diff-added', new vscode.ThemeColor('gitDecoration.addedResourceForeground')),
    modified: new vscode.ThemeIcon('diff-modified', new vscode.ThemeColor('gitDecoration.modifiedResourceForeground')),
    deleted: new vscode.ThemeIcon('diff-removed', new vscode.ThemeColor('gitDecoration.deletedResourceForeground')),
    renamed: new vscode.ThemeIcon('diff-renamed', new vscode.ThemeColor('gitDecoration.renamedResourceForeground')),
};

/**
 * TreeItem representing a single changed file in the sidebar.
 */
export class ChangedFileItem extends vscode.TreeItem {
    public readonly file: ChangedFile;
    public reviewed: boolean;

    constructor(file: ChangedFile, reviewed: boolean) {
        super(file.path, vscode.TreeItemCollapsibleState.None);
        this.file = file;
        this.reviewed = reviewed;

        // Label is just the filename
        this.label = path.basename(file.path);

        // Description shows directory + line changes
        const dir = path.dirname(file.path);
        const lineInfo = `+${file.additions} -${file.deletions}`;
        this.description = dir === '.' ? lineInfo : `${dir} · ${lineInfo}`;

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

        // Context value for menus (reviewed status affects available actions)
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
