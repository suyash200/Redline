export type CommentSeverity = 'must_fix' | 'suggestion' | 'nitpick' | 'question';
export type ReviewDecision = 'approve' | 'comment' | 'request_changes';

export interface ReviewComment {
    id: string;
    file: string;
    line: number;
    endLine?: number;
    severity: CommentSeverity;
    body: string;
    codeContext?: string;
    resolved: boolean;
    timestamp: string;
}

export interface ReviewedFile {
    path: string;
    status: string;
    reviewed: boolean;
}

export interface ReviewStats {
    filesChanged: number;
    filesReviewed: number;
    totalComments: number;
    mustFix: number;
    suggestions: number;
    nitpicks: number;
    questions: number;
}

export interface ReviewData {
    id: string;
    timestamp: string;
    baseRef: string;
    headRef: string;
    decision: ReviewDecision;
    summary: string;
    stats: ReviewStats;
    comments: ReviewComment[];
    reviewedFiles: ReviewedFile[];
}

export const SEVERITY_LABELS: Record<CommentSeverity, string> = {
    must_fix: '🔴 Must Fix',
    suggestion: '🟡 Suggestion',
    nitpick: '🔵 Nitpick',
    question: '❓ Question',
};

export const SEVERITY_ORDER: CommentSeverity[] = ['must_fix', 'suggestion', 'nitpick', 'question'];
