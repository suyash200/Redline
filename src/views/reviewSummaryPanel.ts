import * as vscode from 'vscode';
import { ReviewSession } from '../review/reviewSession';
import { ReviewDecision, ReviewStats, SEVERITY_LABELS } from '../review/types';

/**
 * Webview panel for submitting a review — shows stats & lets the user
 * write a summary, choose a decision, and submit.
 */
export class ReviewSummaryPanel {
  private panel: vscode.WebviewPanel | undefined;
  private session: ReviewSession;
  private onSubmitCallback: (decision: ReviewDecision, summary: string, autoFix: boolean) => void;

  constructor(
    session: ReviewSession,
    onSubmit: (decision: ReviewDecision, summary: string, autoFix: boolean) => void,
  ) {
    this.session = session;
    this.onSubmitCallback = onSubmit;
  }

  show(): void {
    if (this.panel) {
      this.panel.reveal();
      this.updateContent();
      return;
    }

    this.panel = vscode.window.createWebviewPanel(
      'redline.submitReview',
      'Submit Review — Redline',
      vscode.ViewColumn.One,
      { enableScripts: true, retainContextWhenHidden: true },
    );

    this.panel.onDidDispose(() => {
      this.panel = undefined;
    });

    this.panel.webview.onDidReceiveMessage((message) => {
      if (message.type === 'submit') {
        this.onSubmitCallback(message.decision, message.summary, !!message.autoFix);
        this.panel?.dispose();
      }
    });

    this.updateContent();
  }

  private updateContent(): void {
    if (!this.panel) { return; }
    const stats = this.session.getStats();
    this.panel.webview.html = this.getHtml(stats);
  }

  private getHtml(stats: ReviewStats): string {
    return /* html */ `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Submit Review</title>
  <style>
    :root {
      --bg: #0d1117;
      --surface: #161b22;
      --border: #30363d;
      --text: #e6edf3;
      --text-muted: #8b949e;
      --accent-green: #238636;
      --accent-green-hover: #2ea043;
      --accent-yellow: #d29922;
      --accent-red: #da3633;
      --accent-blue: #58a6ff;
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif;
      background: var(--bg);
      color: var(--text);
      padding: 32px;
      line-height: 1.5;
    }
    h1 { font-size: 22px; margin-bottom: 24px; font-weight: 600; }
    .stats-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
      gap: 12px;
      margin-bottom: 28px;
    }
    .stat-card {
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: 8px;
      padding: 14px;
      text-align: center;
    }
    .stat-card .value {
      font-size: 28px;
      font-weight: 700;
    }
    .stat-card .label {
      font-size: 12px;
      color: var(--text-muted);
      text-transform: uppercase;
      letter-spacing: 0.5px;
      margin-top: 4px;
    }
    .stat-card.must-fix .value { color: var(--accent-red); }
    .stat-card.suggestion .value { color: var(--accent-yellow); }
    .stat-card.nitpick .value { color: var(--accent-blue); }
    .stat-card.files .value { color: var(--accent-green); }

    .section { margin-bottom: 24px; }
    .section label {
      display: block;
      font-size: 14px;
      font-weight: 600;
      margin-bottom: 8px;
    }
    textarea {
      width: 100%;
      min-height: 100px;
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: 6px;
      color: var(--text);
      padding: 12px;
      font-size: 14px;
      font-family: inherit;
      resize: vertical;
    }
    textarea:focus { outline: none; border-color: var(--accent-blue); }

    .decision-group {
      display: flex;
      gap: 12px;
      margin-bottom: 28px;
      flex-wrap: wrap;
    }
    .decision-btn {
      flex: 1;
      min-width: 160px;
      padding: 14px 16px;
      border: 2px solid var(--border);
      border-radius: 8px;
      background: var(--surface);
      color: var(--text);
      cursor: pointer;
      font-size: 14px;
      font-weight: 500;
      text-align: center;
      transition: all 0.15s ease;
    }
    .decision-btn:hover { border-color: var(--text-muted); }
    .decision-btn.selected.approve { border-color: var(--accent-green); background: #23863620; }
    .decision-btn.selected.comment { border-color: var(--accent-blue); background: #58a6ff20; }
    .decision-btn.selected.request_changes { border-color: var(--accent-red); background: #da363320; }
    .decision-btn .icon { font-size: 20px; display: block; margin-bottom: 6px; }

    .submit-group {
      display: flex;
      gap: 12px;
      align-items: center;
    }
    .submit-btn {
      padding: 12px 24px;
      border: none;
      border-radius: 6px;
      font-size: 14px;
      font-weight: 600;
      cursor: pointer;
      color: white;
      background: var(--accent-green);
      transition: background 0.1s;
    }
    .submit-btn:hover { background: var(--accent-green-hover); }
    .submit-btn:disabled { opacity: 0.5; cursor: not-allowed; }
    .submit-btn.auto-fix {
      background: var(--accent-blue);
    }
    .submit-btn.auto-fix:hover { background: #4a9eff; }
  </style>
</head>
<body>
  <h1>� Submit Review</h1>

  <div class="stats-grid">
    <div class="stat-card files">
      <div class="value">${stats.filesReviewed}/${stats.filesChanged}</div>
      <div class="label">Files Reviewed</div>
    </div>
    <div class="stat-card">
      <div class="value">${stats.totalComments}</div>
      <div class="label">Total Comments</div>
    </div>
    <div class="stat-card must-fix">
      <div class="value">${stats.mustFix}</div>
      <div class="label">🔴 Must Fix</div>
    </div>
    <div class="stat-card suggestion">
      <div class="value">${stats.suggestions}</div>
      <div class="label">🟡 Suggestions</div>
    </div>
    <div class="stat-card nitpick">
      <div class="value">${stats.nitpicks}</div>
      <div class="label">🔵 Nitpicks</div>
    </div>
  </div>

  <div class="section">
    <label for="summary">Review Summary</label>
    <textarea id="summary" placeholder="Write an overall summary of your review..."></textarea>
  </div>

  <div class="section">
    <label>Decision</label>
    <div class="decision-group">
      <button class="decision-btn approve" data-decision="approve" onclick="selectDecision(this)">
        <span class="icon">✅</span> Approve
      </button>
      <button class="decision-btn comment" data-decision="comment" onclick="selectDecision(this)">
        <span class="icon">💬</span> Comment
      </button>
      <button class="decision-btn request_changes" data-decision="request_changes" onclick="selectDecision(this)">
        <span class="icon">🔄</span> Request Changes
      </button>
    </div>
  </div>

  <div class="submit-group">
    <button class="submit-btn" id="submitBtn" disabled onclick="submitReview(false)">
      Submit Review
    </button>
    <button class="submit-btn auto-fix" id="autoFixBtn" disabled onclick="submitReview(true)">
      ⚡ Submit & Auto-Fix
    </button>
  </div>

  <script>
    const vscode = acquireVsCodeApi();
    let selectedDecision = null;

    function selectDecision(btn) {
      document.querySelectorAll('.decision-btn').forEach(b => b.classList.remove('selected'));
      btn.classList.add('selected');
      selectedDecision = btn.dataset.decision;
      document.getElementById('submitBtn').disabled = false;
      document.getElementById('autoFixBtn').disabled = false;
    }

    function submitReview(autoFix) {
      const summary = document.getElementById('summary').value;
      if (!selectedDecision) return;
      vscode.postMessage({
        type: 'submit',
        decision: selectedDecision,
        summary: summary,
        autoFix: autoFix
      });
    }
  </script>
</body>
</html>`;
  }

  dispose(): void {
    this.panel?.dispose();
  }
}
