import * as vscode from 'vscode';
import * as path from 'path';
import { ChangedFile } from '../git/types';
import { DIFF_SCHEME } from './diffProvider';

/**
 * Open a diff view for a changed file.
 */
export function openFileDiff(
    file: ChangedFile,
    baseRef: string,
    workspaceRoot: string,
): void {
    const leftUri = buildLeftUri(file, baseRef);
    const rightUri = buildRightUri(file, workspaceRoot);
    const title = buildDiffTitle(file);

    vscode.commands.executeCommand('vscode.diff', leftUri, rightUri, title);
}

/**
 * Build the URI for the left (base) side of the diff.
 */
function buildLeftUri(file: ChangedFile, baseRef: string): vscode.Uri {
    if (file.status === 'added') {
        // Added file has no base → empty content
        return vscode.Uri.from({
            scheme: DIFF_SCHEME,
            path: '/' + file.path.replace(/\\/g, '/'),
            query: 'empty=true',
        });
    }

    // For renamed files, use the old path
    const filePath = file.status === 'renamed' && file.oldPath
        ? file.oldPath
        : file.path;

    return vscode.Uri.from({
        scheme: DIFF_SCHEME,
        path: '/' + filePath.replace(/\\/g, '/'),
        query: `ref=${encodeURIComponent(baseRef)}`,
    });
}

/**
 * Build the URI for the right (current) side of the diff.
 */
function buildRightUri(file: ChangedFile, workspaceRoot: string): vscode.Uri {
    if (file.status === 'deleted') {
        // Deleted file doesn't exist on disk → empty content
        return vscode.Uri.from({
            scheme: DIFF_SCHEME,
            path: '/' + file.path.replace(/\\/g, '/'),
            query: 'empty=true',
        });
    }

    return vscode.Uri.file(path.join(workspaceRoot, file.path));
}

/**
 * Build the title for the diff editor tab.
 */
function buildDiffTitle(file: ChangedFile): string {
    const basename = path.basename(file.path);
    const statusLabels: Record<string, string> = {
        added: 'Added',
        modified: 'Modified',
        deleted: 'Deleted',
        renamed: 'Renamed',
    };
    return `${basename} (${statusLabels[file.status] ?? 'Changed'}) — AI Review`;
}
