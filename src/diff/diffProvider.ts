import * as vscode from 'vscode';
import { GitService } from '../git/gitService';
import { logError } from '../utils/logger';

export const DIFF_SCHEME = 'redline';

/**
 * TextDocumentContentProvider that serves file content at a specific git ref.
 * Used as the "base" side of diff views.
 */
export class DiffContentProvider implements vscode.TextDocumentContentProvider {
    private _onDidChange = new vscode.EventEmitter<vscode.Uri>();
    readonly onDidChange = this._onDidChange.event;

    private cache = new Map<string, string>();

    constructor(private gitService: GitService) { }

    async provideTextDocumentContent(uri: vscode.Uri): Promise<string> {
        const params = new URLSearchParams(uri.query);
        const ref = params.get('ref');
        const empty = params.get('empty');

        // Return empty content for added/deleted file placeholders
        if (empty === 'true') {
            return '';
        }

        if (!ref) {
            return '';
        }

        const filePath = uri.path.startsWith('/') ? uri.path.substring(1) : uri.path;
        const cacheKey = `${ref}:${filePath}`;

        // Check cache first
        if (this.cache.has(cacheKey)) {
            return this.cache.get(cacheKey)!;
        }

        try {
            const content = await this.gitService.getFileAtRef(filePath, ref);
            this.cache.set(cacheKey, content);
            return content;
        } catch (err) {
            logError(`Failed to get file at ref: ${ref}:${filePath}`, err);
            return '';
        }
    }

    /**
     * Clear the content cache (call on new review session).
     */
    clearCache(): void {
        this.cache.clear();
    }

    dispose(): void {
        this._onDidChange.dispose();
    }
}
