import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { getConfig } from '../utils/config';
import { logInfo, logError } from '../utils/logger';

const PARTICIPANT_ID = 'redline.chat';

interface RedlineChatResult extends vscode.ChatResult {
    metadata: {
        command: string;
    };
}

/**
 * Register the @redline chat participant.
 *
 * Supports:
 *  - `/fix`    — Read the latest review TOML and ask the LLM to apply fixes
 *  - `/review` — Summarise the latest review
 *  - (default) — Answer questions about the review
 */
export function registerChatParticipant(
    context: vscode.ExtensionContext,
    workspaceRoot: string,
): void {
    const handler: vscode.ChatRequestHandler = async (
        request: vscode.ChatRequest,
        chatContext: vscode.ChatContext,
        stream: vscode.ChatResponseStream,
        token: vscode.CancellationToken,
    ): Promise<RedlineChatResult> => {
        // ── /fix command ──────────────────────────────────────────
        if (request.command === 'fix') {
            return handleFixCommand(request, stream, token, workspaceRoot);
        }

        // ── /review command ───────────────────────────────────────
        if (request.command === 'review') {
            return handleReviewCommand(request, stream, token, workspaceRoot);
        }

        // ── Default: answer questions about the review ────────────
        return handleGeneralQuestion(request, chatContext, stream, token, workspaceRoot);
    };

    // Create the participant
    const participant = vscode.chat.createChatParticipant(PARTICIPANT_ID, handler);
    participant.iconPath = vscode.Uri.joinPath(context.extensionUri, 'media', 'icons', 'logo.png');

    // Follow-up provider
    participant.followupProvider = {
        provideFollowups(
            result: RedlineChatResult,
            _context: vscode.ChatContext,
            _token: vscode.CancellationToken,
        ) {
            if (result.metadata.command === 'fix') {
                return [
                    {
                        prompt: 'Show me the review summary',
                        label: '📋 View review summary',
                        command: 'review',
                    } satisfies vscode.ChatFollowup,
                ];
            }
            if (result.metadata.command === 'review') {
                return [
                    {
                        prompt: 'Apply the fixes from the review',
                        label: '⚡ Auto-fix these issues',
                        command: 'fix',
                    } satisfies vscode.ChatFollowup,
                ];
            }
            return [];
        },
    };

    context.subscriptions.push(participant);
    logInfo('Registered @redline chat participant');
}

// ─────────────────────────────────────────────────────────────────
// Command handlers
// ─────────────────────────────────────────────────────────────────

async function handleFixCommand(
    request: vscode.ChatRequest,
    stream: vscode.ChatResponseStream,
    token: vscode.CancellationToken,
    workspaceRoot: string,
): Promise<RedlineChatResult> {
    stream.progress('Reading latest Redline review…');

    const reviewContent = readLatestReview(workspaceRoot);
    if (!reviewContent) {
        stream.markdown(
            '⚠️ **No review found.** Run a Redline review first (`Redline: Start Review` → `Submit Review`) ' +
            'and then come back here with `@redline /fix`.',
        );
        return { metadata: { command: 'fix' } };
    }

    stream.progress('Sending review to AI for auto-fix…');

    const systemPrompt = [
        'You are an expert code fixer integrated into VS Code via the Redline extension.',
        'The user has submitted a code review and wants you to apply the suggested fixes.',
        '',
        'Rules:',
        '1. Read the TOML review below carefully.',
        '2. For each comment with severity "must_fix", you MUST apply the fix.',
        '3. For comments with severity "suggestion", apply the fix if it makes sense.',
        '4. For "nitpick" and "question" items, mention them but do NOT change code unless asked.',
        '5. Show the exact file path, the original code, and the fixed code for each change.',
        '6. Use fenced code blocks with the language identifier for syntax highlighting.',
        '7. If you are unsure about a fix, explain your reasoning and ask for clarification.',
        '8. As u are updating the issues plz mark it resolved in the TOML file for the respective comments',
        '9.Always check for linting errors, type safety',
        '',
        '=== REDLINE REVIEW (TOML) ===',
        reviewContent,
        '=== END OF REVIEW ===',
    ].join('\n');

    // Use the model the user has selected in the chat dropdown
    const messages = [
        vscode.LanguageModelChatMessage.User(systemPrompt),
    ];

    // If the user provided additional instructions with /fix, include them
    if (request.prompt.trim()) {
        messages.push(
            vscode.LanguageModelChatMessage.User(
                `Additional instructions from the user: ${request.prompt}`,
            ),
        );
    }

    try {
        const response = await request.model.sendRequest(messages, {}, token);

        for await (const fragment of response.text) {
            stream.markdown(fragment);
        }
    } catch (err) {
        logError('LLM request failed in /fix', err);
        stream.markdown(
            `\n\n❌ **Error**: Failed to get a response from the language model.\n\`\`\`\n${err}\n\`\`\``,
        );
    }

    // Add reference to the review file
    const config = getConfig();
    const latestPath = path.join(workspaceRoot, config.outputDir, 'latest.toml');
    if (fs.existsSync(latestPath)) {
        stream.reference(vscode.Uri.file(latestPath));
    }

    return { metadata: { command: 'fix' } };
}

async function handleReviewCommand(
    request: vscode.ChatRequest,
    stream: vscode.ChatResponseStream,
    token: vscode.CancellationToken,
    workspaceRoot: string,
): Promise<RedlineChatResult> {
    stream.progress('Reading latest Redline review…');

    const reviewContent = readLatestReview(workspaceRoot);
    if (!reviewContent) {
        stream.markdown(
            '⚠️ **No review found.** Start and submit a Redline review first.',
        );
        return { metadata: { command: 'review' } };
    }

    const messages = [
        vscode.LanguageModelChatMessage.User(
            [
                'Summarise the following Redline code review in a clear, structured way.',
                'Group the findings by severity (must_fix, suggestion, nitpick, question).',
                'For each item, show the file, line, and a brief description.',
                '',
                '=== REDLINE REVIEW (TOML) ===',
                reviewContent,
                '=== END OF REVIEW ===',
                '',
                request.prompt ? `User's additional question: ${request.prompt}` : '',
            ].join('\n'),
        ),
    ];

    try {
        const response = await request.model.sendRequest(messages, {}, token);
        for await (const fragment of response.text) {
            stream.markdown(fragment);
        }
    } catch (err) {
        logError('LLM request failed in /review', err);
        stream.markdown(`\n\n❌ **Error**: ${err}`);
    }

    return { metadata: { command: 'review' } };
}

async function handleGeneralQuestion(
    request: vscode.ChatRequest,
    chatContext: vscode.ChatContext,
    stream: vscode.ChatResponseStream,
    token: vscode.CancellationToken,
    workspaceRoot: string,
): Promise<RedlineChatResult> {
    const reviewContent = readLatestReview(workspaceRoot);

    const contextBlock = reviewContent
        ? `\nFor context, here is the latest Redline review:\n\`\`\`toml\n${reviewContent}\n\`\`\``
        : '\n(No Redline review is available yet.)';

    const messages = [
        vscode.LanguageModelChatMessage.User(
            [
                'You are @redline, a code review assistant in VS Code.',
                'You help users understand their code reviews and apply fixes.',
                contextBlock,
                '',
                `User question: ${request.prompt}`,
            ].join('\n'),
        ),
    ];

    try {
        const response = await request.model.sendRequest(messages, {}, token);
        for await (const fragment of response.text) {
            stream.markdown(fragment);
        }
    } catch (err) {
        logError('LLM request failed in general question', err);
        stream.markdown(`\n\n❌ **Error**: ${err}`);
    }

    return { metadata: { command: '' } };
}

// ─────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────

function readLatestReview(workspaceRoot: string): string | null {
    const config = getConfig();
    const latestPath = path.join(workspaceRoot, config.outputDir, 'latest.toml');

    if (!fs.existsSync(latestPath)) {
        logInfo(`No latest review found at: ${latestPath}`);
        return null;
    }

    try {
        return fs.readFileSync(latestPath, 'utf-8');
    } catch (err) {
        logError(`Failed to read review file: ${latestPath}`, err);
        return null;
    }
}
