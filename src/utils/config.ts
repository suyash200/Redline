import * as vscode from 'vscode';
import { CommentSeverity } from '../review/types';

export interface ExtensionConfig {
    baseRef: string;
    outputDir: string;
    autoDetectChanges: boolean;
    defaultSeverity: CommentSeverity;
    addToGitignore: boolean;
    autoFixCommand: string;
}

export function getConfig(): ExtensionConfig {
    const config = vscode.workspace.getConfiguration('redline');
    return {
        baseRef: config.get<string>('baseRef', 'HEAD~1'),
        outputDir: config.get<string>('outputDir', '.redline'),
        autoDetectChanges: config.get<boolean>('autoDetectChanges', true),
        defaultSeverity: config.get<CommentSeverity>('defaultSeverity', 'suggestion'),
        addToGitignore: config.get<boolean>('addToGitignore', true),
        autoFixCommand: config.get<string>('autoFixCommand', 'npm run redline:fix'),
    };
}
