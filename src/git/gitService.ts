import simpleGit, { SimpleGit, DiffResultTextFile } from 'simple-git';
import { ChangedFile, FileStatus, CommitInfo } from './types';
import { logInfo, logWarn } from '../utils/logger';

export class GitService {
    private git: SimpleGit;
    private workingDir: string;

    constructor(workingDir: string) {
        this.workingDir = workingDir;
        this.git = simpleGit(workingDir);
    }

    /**
     * Check if the working directory is a valid git repository.
     */
    async isGitRepo(): Promise<boolean> {
        try {
            await this.git.revparse(['--is-inside-work-tree']);
            return true;
        } catch {
            return false;
        }
    }

    /**
     * Get the list of changed files between two refs, PLUS any staged,
     * unstaged, or untracked working-tree changes.
     *
     * This means brand-new files (never committed) like `main/index.ts`
     * will still appear in the review session — no commit required.
     */
    async getChangedFiles(baseRef: string, headRef: string = 'HEAD'): Promise<ChangedFile[]> {
        logInfo(`Getting changed files: ${baseRef}..${headRef}`);

        const seenPaths = new Set<string>();
        const files: ChangedFile[] = [];

        // ── 1. Committed diff between baseRef and headRef ─────────────────────
        try {
            const nameStatusOutput = await this.git.raw(['diff', '--name-status', baseRef, headRef]);
            const diffSummary = await this.git.diffSummary([`${baseRef}..${headRef}`]);

            const statsByFile = new Map<string, { additions: number; deletions: number }>();
            for (const file of diffSummary.files) {
                const textFile = file as DiffResultTextFile;
                statsByFile.set(textFile.file, {
                    additions: textFile.insertions ?? 0,
                    deletions: textFile.deletions ?? 0,
                });
            }

            for (const line of nameStatusOutput.trim().split('\n').filter(Boolean)) {
                const parts = line.split('\t');
                if (parts.length < 2) { continue; }

                const statusCode = parts[0].charAt(0);
                const filePath = parts[parts.length === 3 ? 2 : 1].trim();
                const oldPath = parts.length === 3 ? parts[1].trim() : undefined;
                if (!filePath || seenPaths.has(filePath)) { continue; }

                const stats = statsByFile.get(filePath) ?? statsByFile.get(oldPath ?? '') ?? { additions: 0, deletions: 0 };
                files.push({ path: filePath, status: mapGitStatus(statusCode), additions: stats.additions, deletions: stats.deletions, oldPath });
                seenPaths.add(filePath);
            }
        } catch (err) {
            logWarn(`Could not get committed diff: ${err}`);
        }

        // ── 2. Staged changes (git add'd but not yet committed) ───────────────
        try {
            const staged = await this.git.raw(['diff', '--name-status', '--cached']);
            for (const line of staged.trim().split('\n').filter(Boolean)) {
                const parts = line.split('\t');
                if (parts.length < 2) { continue; }
                const filePath = parts[parts.length === 3 ? 2 : 1].trim();
                if (!filePath || seenPaths.has(filePath)) { continue; }

                files.push({
                    path: filePath,
                    status: mapGitStatus(parts[0].charAt(0)),
                    additions: 0,
                    deletions: 0,
                    oldPath: parts.length === 3 ? parts[1].trim() : undefined,
                });
                seenPaths.add(filePath);
            }
        } catch (err) {
            logWarn(`Could not get staged changes: ${err}`);
        }

        // ── 3. Unstaged modifications to tracked files ────────────────────────
        try {
            const unstaged = await this.git.raw(['diff', '--name-status']);
            for (const line of unstaged.trim().split('\n').filter(Boolean)) {
                const parts = line.split('\t');
                if (parts.length < 2) { continue; }
                const filePath = parts[parts.length === 3 ? 2 : 1].trim();
                if (!filePath || seenPaths.has(filePath)) { continue; }

                files.push({
                    path: filePath,
                    status: mapGitStatus(parts[0].charAt(0)),
                    additions: 0,
                    deletions: 0,
                    oldPath: parts.length === 3 ? parts[1].trim() : undefined,
                });
                seenPaths.add(filePath);
            }
        } catch (err) {
            logWarn(`Could not get unstaged changes: ${err}`);
        }

        // ── 4. Untracked files (brand-new, never committed) ───────────────────
        try {
            const untracked = await this.git.raw(['ls-files', '--others', '--exclude-standard']);
            for (const rawPath of untracked.trim().split('\n').filter(Boolean)) {
                const filePath = rawPath.trim();
                if (!filePath || seenPaths.has(filePath)) { continue; }

                files.push({ path: filePath, status: 'added', additions: 0, deletions: 0 });
                seenPaths.add(filePath);
            }
        } catch (err) {
            logWarn(`Could not get untracked files: ${err}`);
        }

        logInfo(`Found ${files.length} changed files (committed + working tree)`);
        return files;
    }

    /**
     * Get the content of a file at a specific git ref.
     * Returns empty string if the file doesn't exist at that ref.
     */
    async getFileAtRef(filePath: string, ref: string): Promise<string> {
        try {
            const normalizedPath = filePath.replace(/\\/g, '/');
            return await this.git.show([`${ref}:${normalizedPath}`]);
        } catch {
            return '';
        }
    }

    /**
     * Get recent commits for the user to pick a base ref.
     */
    async getRecentCommits(count: number = 10): Promise<CommitInfo[]> {
        const log = await this.git.log({ maxCount: count });
        return log.all.map((entry) => ({
            hash: entry.hash,
            message: entry.message,
            author: entry.author_name,
            date: entry.date,
        }));
    }

    /**
     * Get the current branch name.
     */
    async getCurrentBranch(): Promise<string> {
        const branch = await this.git.revparse(['--abbrev-ref', 'HEAD']);
        return branch.trim();
    }

    /**
     * Validate that a git ref exists.
     */
    async isValidRef(ref: string): Promise<boolean> {
        try {
            await this.git.revparse([ref]);
            return true;
        } catch {
            return false;
        }
    }

    /**
     * Get the short hash for HEAD.
     */
    async getHeadShortHash(): Promise<string> {
        const hash = await this.git.revparse(['--short', 'HEAD']);
        return hash.trim();
    }

    get rootDir(): string {
        return this.workingDir;
    }
}

function mapGitStatus(code: string): FileStatus {
    switch (code) {
        case 'A': return 'added';
        case 'D': return 'deleted';
        case 'R': return 'renamed';
        case 'M':
        default: return 'modified';
    }
}
