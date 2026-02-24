import * as vscode from 'vscode';

let outputChannel: vscode.OutputChannel | undefined;

function getChannel(): vscode.OutputChannel {
    if (!outputChannel) {
        outputChannel = vscode.window.createOutputChannel('Redline');
    }
    return outputChannel;
}

export function logInfo(message: string): void {
    getChannel().appendLine(`[INFO  ${timestamp()}] ${message}`);
}

export function logError(message: string, error?: unknown): void {
    const errorMsg = error instanceof Error ? error.message : String(error ?? '');
    getChannel().appendLine(`[ERROR ${timestamp()}] ${message}${errorMsg ? ': ' + errorMsg : ''}`);
}

export function logWarn(message: string): void {
    getChannel().appendLine(`[WARN  ${timestamp()}] ${message}`);
}

export function showChannel(): void {
    getChannel().show(true);
}

export function disposeLogger(): void {
    outputChannel?.dispose();
    outputChannel = undefined;
}

function timestamp(): string {
    return new Date().toISOString().substring(11, 23);
}
