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
     * Get changed files using `git status --porcelain`.
     * This matches exactly what `git status` shows:
     *   - Staged changes
     *   - Unstaged modifications
     *   - Untracked new files
     *
     * The baseRef is still accepted for API compatibility (used by the
     * diff provider to show the "before" content) but is NOT used
     * for discovering which files to list.
     */
    async getChangedFiles(baseRef: string, _headRef: string = 'HEAD'): Promise<ChangedFile[]> {
        logInfo(`Getting changed files (git status mode)`);

        const files: ChangedFile[] = [];
        const seenPaths = new Set<string>();

        // ── Use git status --porcelain to match exactly what `git status` shows ──
        const statusOutput = await this.git.raw(['status', '--porcelain']);

        for (const line of statusOutput.split('\n').filter(Boolean)) {
            // Format: XY filename   or   XY old -> new  (for renames)
            // X = index/staging status, Y = working tree status
            // First 2 chars are the status codes, position 3 is a space
            if (line.length < 4) { continue; }

            const indexStatus = line.charAt(0);
            const workTreeStatus = line.charAt(1);
            let filePath: string;
            let oldPath: string | undefined;

            // Handle renames: "R  old.txt -> new.txt"
            const rest = line.substring(3);
            if (rest.includes(' -> ')) {
                const parts = rest.split(' -> ');
                oldPath = parts[0].trim();
                filePath = parts[1].trim();
            } else {
                filePath = rest.trim();
            }

            if (!filePath || seenPaths.has(filePath)) { continue; }

            // Determine file status from the porcelain codes
            const status = mapPorcelainStatus(indexStatus, workTreeStatus);

            files.push({
                path: filePath,
                status,
                additions: 0,
                deletions: 0,
                oldPath,
            });
            seenPaths.add(filePath);
        }

        // ── Get line counts for better display ──
        try {
            // Staged line counts
            const stagedSummary = await this.git.diffSummary(['--cached']);
            for (const file of stagedSummary.files) {
                const textFile = file as DiffResultTextFile;
                const match = files.find(f => f.path === textFile.file);
                if (match) {
                    match.additions += textFile.insertions ?? 0;
                    match.deletions += textFile.deletions ?? 0;
                }
            }

            // Unstaged line counts
            const unstagedSummary = await this.git.diffSummary([]);
            for (const file of unstagedSummary.files) {
                const textFile = file as DiffResultTextFile;
                const match = files.find(f => f.path === textFile.file);
                if (match) {
                    match.additions += textFile.insertions ?? 0;
                    match.deletions += textFile.deletions ?? 0;
                }
            }
        } catch (err) {
            logWarn(`Could not get line counts: ${err}`);
        }

        logInfo(`Found ${files.length} changed files (matching git status)`);
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

/**
 * Map git status --porcelain codes to our FileStatus.
 *
 * Porcelain format: XY
 *   X = staging area status
 *   Y = working tree status
 *   ? = untracked
 *   ! = ignored
 */
function mapPorcelainStatus(indexStatus: string, workTreeStatus: string): FileStatus {
    // Untracked
    if (indexStatus === '?' && workTreeStatus === '?') { return 'added'; }

    // Deleted
    if (indexStatus === 'D' || workTreeStatus === 'D') { return 'deleted'; }

    // Renamed
    if (indexStatus === 'R') { return 'renamed'; }

    // Added (new file staged)
    if (indexStatus === 'A') { return 'added'; }

    // Modified (everything else: M, MM, AM, etc.)
    return 'modified';
}
