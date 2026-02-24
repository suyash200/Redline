import { ChangedFile, FileStatus } from '../git/types';
import {
    ReviewComment,
    ReviewData,
    ReviewDecision,
    ReviewStats,
    ReviewedFile,
    CommentSeverity,
} from './types';

let nextCommentId = 1;

export class ReviewSession {
    private _files: Map<string, { file: ChangedFile; reviewed: boolean }> = new Map();
    private _comments: Map<string, ReviewComment> = new Map();
    private _baseRef: string;
    private _headRef: string;
    private _startedAt: Date;

    constructor(baseRef: string, headRef: string, files: ChangedFile[]) {
        this._baseRef = baseRef;
        this._headRef = headRef;
        this._startedAt = new Date();

        for (const file of files) {
            this._files.set(file.path, { file, reviewed: false });
        }
    }

    // ── Comments ──────────────────────────────────────────────────

    addComment(
        file: string,
        line: number,
        body: string,
        severity: CommentSeverity,
        endLine?: number,
        codeContext?: string,
    ): ReviewComment {
        const id = `comment-${nextCommentId++}`;
        const comment: ReviewComment = {
            id,
            file,
            line,
            endLine,
            severity,
            body,
            codeContext,
            resolved: false,
            timestamp: new Date().toISOString(),
        };
        this._comments.set(id, comment);
        return comment;
    }

    removeComment(commentId: string): boolean {
        return this._comments.delete(commentId);
    }

    updateComment(commentId: string, body: string, severity?: CommentSeverity): void {
        const comment = this._comments.get(commentId);
        if (comment) {
            comment.body = body;
            if (severity !== undefined) {
                comment.severity = severity;
            }
        }
    }

    toggleResolved(commentId: string): boolean {
        const comment = this._comments.get(commentId);
        if (comment) {
            comment.resolved = !comment.resolved;
            return comment.resolved;
        }
        return false;
    }

    getComment(commentId: string): ReviewComment | undefined {
        return this._comments.get(commentId);
    }

    getComments(): ReviewComment[] {
        return Array.from(this._comments.values());
    }

    getCommentsForFile(filePath: string): ReviewComment[] {
        return this.getComments().filter((c) => c.file === filePath);
    }

    // ── File review status ────────────────────────────────────────

    markFileReviewed(filePath: string): void {
        const entry = this._files.get(filePath);
        if (entry) {
            entry.reviewed = true;
        }
    }

    unmarkFileReviewed(filePath: string): void {
        const entry = this._files.get(filePath);
        if (entry) {
            entry.reviewed = false;
        }
    }

    toggleFileReviewed(filePath: string): boolean {
        const entry = this._files.get(filePath);
        if (entry) {
            entry.reviewed = !entry.reviewed;
            return entry.reviewed;
        }
        return false;
    }

    isFileReviewed(filePath: string): boolean {
        return this._files.get(filePath)?.reviewed ?? false;
    }

    // ── Getters ───────────────────────────────────────────────────

    get baseRef(): string {
        return this._baseRef;
    }

    get headRef(): string {
        return this._headRef;
    }

    get startedAt(): Date {
        return this._startedAt;
    }

    getFiles(): ChangedFile[] {
        return Array.from(this._files.values()).map((e) => e.file);
    }

    getFileByPath(filePath: string): ChangedFile | undefined {
        return this._files.get(filePath)?.file;
    }

    getFilePaths(): string[] {
        return Array.from(this._files.keys());
    }

    // ── Stats & export ────────────────────────────────────────────

    getStats(): ReviewStats {
        const comments = this.getComments();
        return {
            filesChanged: this._files.size,
            filesReviewed: Array.from(this._files.values()).filter((e) => e.reviewed).length,
            totalComments: comments.length,
            mustFix: comments.filter((c) => c.severity === 'must_fix').length,
            suggestions: comments.filter((c) => c.severity === 'suggestion').length,
            nitpicks: comments.filter((c) => c.severity === 'nitpick').length,
            questions: comments.filter((c) => c.severity === 'question').length,
        };
    }

    toReviewData(decision: ReviewDecision, summary: string): ReviewData {
        return {
            id: `review-${formatDateId(this._startedAt)}`,
            timestamp: this._startedAt.toISOString(),
            baseRef: this._baseRef,
            headRef: this._headRef,
            decision,
            summary,
            stats: this.getStats(),
            comments: this.getComments(),
            reviewedFiles: Array.from(this._files.values()).map(
                (e): ReviewedFile => ({
                    path: e.file.path,
                    status: e.file.status,
                    reviewed: e.reviewed,
                }),
            ),
        };
    }
}

function formatDateId(date: Date): string {
    const pad = (n: number) => String(n).padStart(2, '0');
    return (
        `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}` +
        `-${pad(date.getHours())}${pad(date.getMinutes())}${pad(date.getSeconds())}`
    );
}
