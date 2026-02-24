import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { ReviewData } from './types';
import { serializeToToml } from '../utils/toml';
import { getConfig } from '../utils/config';
import { logInfo, logError } from '../utils/logger';

/**
 * Save a review to disk as a TOML file.
 * Also writes a `latest.toml` copy for easy AI consumption.
 */
export async function saveReview(workspaceRoot: string, review: ReviewData): Promise<string> {
    const config = getConfig();
    const outputDir = path.join(workspaceRoot, config.outputDir);

    // Ensure output directory exists
    if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
    }

    const tomlContent = serializeToToml(review);

    // Write timestamped file
    const fileName = `${review.id}.toml`;
    const filePath = path.join(outputDir, fileName);
    fs.writeFileSync(filePath, tomlContent, 'utf-8');
    logInfo(`Review saved: ${filePath}`);

    // Write latest.toml (overwrite)
    const latestPath = path.join(outputDir, 'latest.toml');
    fs.writeFileSync(latestPath, tomlContent, 'utf-8');
    logInfo(`Latest review updated: ${latestPath}`);

    // Add to .gitignore if configured
    if (config.addToGitignore) {
        await ensureGitignore(workspaceRoot, config.outputDir);
    }

    return filePath;
}

/**
 * List all past review files in the output directory.
 */
export function getReviewHistory(workspaceRoot: string): { name: string; path: string; date: Date }[] {
    const config = getConfig();
    const outputDir = path.join(workspaceRoot, config.outputDir);

    if (!fs.existsSync(outputDir)) {
        return [];
    }

    return fs
        .readdirSync(outputDir)
        .filter((f) => f.startsWith('review-') && f.endsWith('.toml'))
        .map((f) => {
            const fullPath = path.join(outputDir, f);
            const stat = fs.statSync(fullPath);
            return { name: f, path: fullPath, date: stat.mtime };
        })
        .sort((a, b) => b.date.getTime() - a.date.getTime());
}

/**
 * Ensure the output directory is in .gitignore.
 */
async function ensureGitignore(workspaceRoot: string, outputDir: string): Promise<void> {
    const gitignorePath = path.join(workspaceRoot, '.gitignore');
    const entry = outputDir.endsWith('/') ? outputDir : outputDir + '/';

    try {
        let content = '';
        if (fs.existsSync(gitignorePath)) {
            content = fs.readFileSync(gitignorePath, 'utf-8');
        }

        // Check if already present
        const lines = content.split('\n');
        const alreadyPresent = lines.some(
            (line) => line.trim() === entry || line.trim() === outputDir,
        );

        if (!alreadyPresent) {
            const newContent = content.endsWith('\n') || content === ''
                ? content + entry + '\n'
                : content + '\n' + entry + '\n';
            fs.writeFileSync(gitignorePath, newContent, 'utf-8');
            logInfo(`Added ${entry} to .gitignore`);
        }
    } catch (err) {
        logError('Failed to update .gitignore', err);
    }
}
