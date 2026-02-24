import { ReviewData } from '../review/types';

/**
 * Serialize a ReviewData object into TOML format.
 * Hand-written serializer for our specific schema — no external dependencies.
 */
export function serializeToToml(review: ReviewData): string {
    const lines: string[] = [];

    lines.push('# AI Review Output');
    lines.push(`# Generated at ${review.timestamp}`);
    lines.push('');

    // [review]
    lines.push('[review]');
    lines.push(`id = ${tomlStr(review.id)}`);
    lines.push(`timestamp = ${review.timestamp}`);
    lines.push(`baseRef = ${tomlStr(review.baseRef)}`);
    lines.push(`headRef = ${tomlStr(review.headRef)}`);
    lines.push(`decision = ${tomlStr(review.decision)}`);
    lines.push(`summary = ${tomlStr(review.summary)}`);
    lines.push('');

    // [stats]
    lines.push('[stats]');
    lines.push(`filesChanged = ${review.stats.filesChanged}`);
    lines.push(`filesReviewed = ${review.stats.filesReviewed}`);
    lines.push(`totalComments = ${review.stats.totalComments}`);
    lines.push(`mustFix = ${review.stats.mustFix}`);
    lines.push(`suggestions = ${review.stats.suggestions}`);
    lines.push(`nitpicks = ${review.stats.nitpicks}`);
    lines.push(`questions = ${review.stats.questions}`);

    // [[comments]]
    if (review.comments.length > 0) {
        lines.push('');
        for (const comment of review.comments) {
            lines.push('[[comments]]');
            lines.push(`file = ${tomlStr(comment.file)}`);
            lines.push(`line = ${comment.line}`);
            if (comment.endLine !== undefined && comment.endLine !== comment.line) {
                lines.push(`endLine = ${comment.endLine}`);
            }
            lines.push(`severity = ${tomlStr(comment.severity)}`);
            lines.push(`body = ${tomlStr(comment.body)}`);
            if (comment.codeContext) {
                lines.push(`codeContext = ${tomlStr(comment.codeContext)}`);
            }
            lines.push(`resolved = ${comment.resolved}`);
            lines.push(`timestamp = ${comment.timestamp}`);
            lines.push('');
        }
    }

    // [[reviewedFiles]]
    if (review.reviewedFiles.length > 0) {
        for (const file of review.reviewedFiles) {
            lines.push('[[reviewedFiles]]');
            lines.push(`path = ${tomlStr(file.path)}`);
            lines.push(`status = ${tomlStr(file.status)}`);
            lines.push(`reviewed = ${file.reviewed}`);
            lines.push('');
        }
    }

    return lines.join('\n');
}

/**
 * Encode a string as a TOML basic string (double-quoted) or
 * multi-line basic string (triple-double-quoted) if it contains newlines.
 */
function tomlStr(value: string): string {
    if (value.includes('\n')) {
        const escaped = value
            .replace(/\\/g, '\\\\')
            .replace(/"""/g, '\\"\\"\\"');
        return '"""\n' + escaped + '\n"""';
    }

    const escaped = value
        .replace(/\\/g, '\\\\')
        .replace(/"/g, '\\"')
        .replace(/\t/g, '\\t')
        .replace(/\r/g, '\\r');
    return `"${escaped}"`;
}
