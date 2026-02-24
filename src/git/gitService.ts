import * as path from 'path';
import simpleGit, { SimpleGit, DiffResultTextFile } from 'simple-git';
import { ChangedFile, FileStatus, CommitInfo } from './types';
import { logInfo, logError } from '../utils/logger';

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
     * Get the list of changed files between two refs.
     */
    async getChangedFiles(baseRef: string, headRef: string = 'HEAD'): Promise<ChangedFile[]> {
        logInfo(`Getting changed files: ${baseRef}..${headRef}`);

        // Get file statuses (A/M/D/R)
        const nameStatusOutput = await this.git.raw([
            'diff', '--name-status', baseRef, headRef,
        ]);

        // Get line counts
        const diffSummary = await this.git.diffSummary([`${baseRef}..${headRef}`]);

        // Build a lookup for line counts by file path
        const statsByFile = new Map<string, { additions: number; deletions: number }>();
        for (const file of diffSummary.files) {
            const textFile = file as DiffResultTextFile;
            statsByFile.set(textFile.file, {
                additions: textFile.insertions ?? 0,
                deletions: textFile.deletions ?? 0,
            });
        }

        // Parse name-status output
        const files: ChangedFile[] = [];
        const lines = nameStatusOutput.trim().split('\n').filter(Boolean);

        for (const line of lines) {
            const parts = line.split('\t');
            if (parts.length < 2) { continue; }

            const statusCode = parts[0].charAt(0);
            const filePath = parts[parts.length === 3 ? 2 : 1]; // For renames, new path is index 2
            const oldPath = parts.length === 3 ? parts[1] : undefined;

            const status = mapGitStatus(statusCode);
            const stats = statsByFile.get(filePath) ?? statsByFile.get(oldPath ?? '') ?? { additions: 0, deletions: 0 };

            files.push({
                path: filePath,
                status,
                additions: stats.additions,
                deletions: stats.deletions,
                oldPath,
            });
        }

        logInfo(`Found ${files.length} changed files`);
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
