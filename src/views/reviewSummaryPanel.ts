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
    const reviewPct = stats.filesChanged > 0
      ? Math.round((stats.filesReviewed / stats.filesChanged) * 100)
      : 0;
    return /* html */ `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Submit Review — Redline</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');

    :root {
      --bg: #0d1117;
      --surface: #161b22;
      --surface-hover: #1c2129;
      --border: #30363d;
      --border-subtle: #21262d;
      --text: #e6edf3;
      --text-muted: #8b949e;
      --text-faint: #484f58;
      --green: #3fb950;
      --green-dim: #238636;
      --green-glow: rgba(63,185,80,.18);
      --yellow: #e3b341;
      --yellow-dim: #d29922;
      --yellow-glow: rgba(227,179,65,.15);
      --red: #f85149;
      --red-dim: #da3633;
      --red-glow: rgba(248,81,73,.15);
      --blue: #58a6ff;
      --blue-dim: #1f6feb;
      --blue-glow: rgba(88,166,255,.15);
      --purple: #bc8cff;
    }

    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

    body {
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      background: var(--bg);
      color: var(--text);
      padding: 28px 32px 120px;
      line-height: 1.5;
      min-height: 100vh;
    }

    /* ── Header ── */
    .header {
      display: flex;
      align-items: center;
      gap: 12px;
      margin-bottom: 28px;
    }
    .header-icon {
      width: 38px; height: 38px;
      background: linear-gradient(135deg, #1f6feb 0%, #58a6ff 100%);
      border-radius: 10px;
      display: flex; align-items: center; justify-content: center;
      font-size: 18px;
      box-shadow: 0 0 16px rgba(88,166,255,.3);
    }
    .header h1 {
      font-size: 20px;
      font-weight: 700;
      letter-spacing: -0.3px;
    }
    .header .subtitle {
      font-size: 12px;
      color: var(--text-muted);
      margin-top: 1px;
    }

    /* ── Progress bar ── */
    .progress-wrap {
      margin-bottom: 24px;
    }
    .progress-meta {
      display: flex;
      justify-content: space-between;
      font-size: 12px;
      color: var(--text-muted);
      margin-bottom: 6px;
    }
    .progress-meta strong { color: var(--text); }
    .progress-track {
      height: 6px;
      background: var(--border-subtle);
      border-radius: 99px;
      overflow: hidden;
    }
    .progress-fill {
      height: 100%;
      border-radius: 99px;
      background: linear-gradient(90deg, var(--green-dim) 0%, var(--green) 100%);
      transition: width 0.6s cubic-bezier(.22,1,.36,1);
      width: ${reviewPct}%;
    }

    /* ── Stat cards ── */
    .stats-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(110px, 1fr));
      gap: 10px;
      margin-bottom: 28px;
    }
    .stat-card {
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: 10px;
      padding: 16px 12px;
      text-align: center;
      position: relative;
      overflow: hidden;
      transition: transform 0.15s ease, border-color 0.15s ease, box-shadow 0.15s ease;
      animation: cardIn 0.4s ease both;
    }
    .stat-card::before {
      content: '';
      position: absolute;
      top: 0; left: 0; right: 0;
      height: 2px;
    }
    .stat-card:hover { transform: translateY(-2px); }

    .stat-card.files::before   { background: linear-gradient(90deg, var(--green-dim), var(--green)); }
    .stat-card.total::before   { background: linear-gradient(90deg, var(--purple), var(--blue)); }
    .stat-card.must-fix::before  { background: linear-gradient(90deg, var(--red-dim), var(--red)); }
    .stat-card.suggestion::before{ background: linear-gradient(90deg, var(--yellow-dim), var(--yellow)); }
    .stat-card.nitpick::before   { background: linear-gradient(90deg, var(--blue-dim), var(--blue)); }

    .stat-card:hover.files     { border-color: var(--green-dim);   box-shadow: 0 4px 16px var(--green-glow); }
    .stat-card:hover.total     { border-color: var(--blue);        box-shadow: 0 4px 16px var(--blue-glow); }
    .stat-card:hover.must-fix  { border-color: var(--red);         box-shadow: 0 4px 16px var(--red-glow); }
    .stat-card:hover.suggestion{ border-color: var(--yellow);      box-shadow: 0 4px 16px var(--yellow-glow); }
    .stat-card:hover.nitpick   { border-color: var(--blue);        box-shadow: 0 4px 16px var(--blue-glow); }

    .stat-card .emoji { font-size: 18px; margin-bottom: 6px; display: block; }
    .stat-card .value {
      font-size: 26px;
      font-weight: 700;
      letter-spacing: -0.5px;
      display: block;
      line-height: 1;
      margin-bottom: 6px;
    }
    .stat-card .label {
      font-size: 10px;
      color: var(--text-muted);
      text-transform: uppercase;
      letter-spacing: 0.6px;
    }
    .stat-card.files .value    { color: var(--green); }
    .stat-card.total .value    { color: var(--purple); }
    .stat-card.must-fix .value { color: var(--red); }
    .stat-card.suggestion .value { color: var(--yellow); }
    .stat-card.nitpick .value  { color: var(--blue); }

    @keyframes cardIn {
      from { opacity: 0; transform: translateY(8px); }
      to   { opacity: 1; transform: translateY(0); }
    }
    .stats-grid .stat-card:nth-child(1) { animation-delay: 0.05s; }
    .stats-grid .stat-card:nth-child(2) { animation-delay: 0.10s; }
    .stats-grid .stat-card:nth-child(3) { animation-delay: 0.15s; }
    .stats-grid .stat-card:nth-child(4) { animation-delay: 0.20s; }
    .stats-grid .stat-card:nth-child(5) { animation-delay: 0.25s; }

    /* ── Section ── */
    .section { margin-bottom: 24px; }
    .section-label {
      font-size: 12px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.8px;
      color: var(--text-muted);
      margin-bottom: 10px;
      display: flex;
      align-items: center;
      gap: 6px;
    }
    .section-label::after {
      content: '';
      flex: 1;
      height: 1px;
      background: var(--border-subtle);
    }

    /* ── Textarea ── */
    .textarea-wrap { position: relative; }
    textarea {
      width: 100%;
      min-height: 110px;
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: 8px;
      color: var(--text);
      padding: 12px 14px;
      font-size: 13.5px;
      font-family: inherit;
      resize: vertical;
      transition: border-color 0.15s, box-shadow 0.15s;
      line-height: 1.6;
    }
    textarea::placeholder { color: var(--text-faint); }
    textarea:focus {
      outline: none;
      border-color: var(--blue);
      box-shadow: 0 0 0 3px rgba(88,166,255,.12);
    }
    .char-count {
      position: absolute;
      bottom: 10px; right: 12px;
      font-size: 11px;
      color: var(--text-faint);
      pointer-events: none;
      transition: color 0.15s;
    }
    .char-count.warn { color: var(--yellow); }

    /* ── Decision buttons ── */
    .decision-group {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 10px;
    }
    .decision-btn {
      padding: 16px 12px;
      border: 1.5px solid var(--border);
      border-radius: 10px;
      background: var(--surface);
      color: var(--text);
      cursor: pointer;
      font-size: 13px;
      font-weight: 500;
      font-family: inherit;
      text-align: center;
      transition: all 0.18s ease;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 8px;
      position: relative;
      overflow: hidden;
    }
    .decision-btn::before {
      content: '';
      position: absolute;
      inset: 0;
      opacity: 0;
      transition: opacity 0.18s;
    }
    .decision-btn:hover { border-color: var(--text-muted); transform: translateY(-1px); }
    .decision-btn .btn-icon { font-size: 22px; transition: transform 0.2s; }
    .decision-btn:hover .btn-icon { transform: scale(1.15); }
    .decision-btn .btn-label { font-size: 13px; font-weight: 600; }
    .decision-btn .btn-sub { font-size: 11px; color: var(--text-muted); }

    /* Selected states */
    .decision-btn.selected.approve {
      border-color: var(--green);
      background: rgba(63,185,80,.08);
      box-shadow: 0 0 20px var(--green-glow), inset 0 0 20px var(--green-glow);
    }
    .decision-btn.selected.comment {
      border-color: var(--blue);
      background: rgba(88,166,255,.08);
      box-shadow: 0 0 20px var(--blue-glow), inset 0 0 20px var(--blue-glow);
    }
    .decision-btn.selected.request_changes {
      border-color: var(--red);
      background: rgba(248,81,73,.08);
      box-shadow: 0 0 20px var(--red-glow), inset 0 0 20px var(--red-glow);
    }
    .decision-btn.selected .btn-sub { color: var(--text); }

    /* ── Sticky footer ── */
    .footer-bar {
      position: fixed;
      bottom: 0; left: 0; right: 0;
      padding: 14px 32px;
      background: rgba(13,17,23,.88);
      backdrop-filter: blur(12px);
      -webkit-backdrop-filter: blur(12px);
      border-top: 1px solid var(--border);
      display: flex;
      gap: 10px;
      align-items: center;
      z-index: 100;
    }
    .footer-hint {
      flex: 1;
      font-size: 12px;
      color: var(--text-muted);
    }
    .footer-hint strong { color: var(--text); }

    .submit-btn {
      padding: 11px 22px;
      border: none;
      border-radius: 8px;
      font-size: 13.5px;
      font-weight: 600;
      font-family: inherit;
      cursor: pointer;
      color: #fff;
      transition: all 0.15s ease;
      display: flex;
      align-items: center;
      gap: 7px;
      position: relative;
      overflow: hidden;
    }
    .submit-btn::after {
      content: '';
      position: absolute;
      inset: 0;
      background: rgba(255,255,255,.08);
      opacity: 0;
      transition: opacity 0.15s;
    }
    .submit-btn:hover::after { opacity: 1; }
    .submit-btn:active { transform: scale(0.97); }
    .submit-btn:disabled {
      opacity: 0.38;
      cursor: not-allowed;
      pointer-events: none;
    }
    .submit-btn.primary {
      background: linear-gradient(135deg, var(--green-dim) 0%, var(--green) 100%);
      box-shadow: 0 2px 12px rgba(63,185,80,.25);
    }
    .submit-btn.primary:hover {
      box-shadow: 0 4px 20px rgba(63,185,80,.4);
      transform: translateY(-1px);
    }
    .submit-btn.autofix {
      background: linear-gradient(135deg, var(--blue-dim) 0%, var(--blue) 100%);
      box-shadow: 0 2px 12px rgba(88,166,255,.25);
    }
    .submit-btn.autofix:hover {
      box-shadow: 0 4px 20px rgba(88,166,255,.4);
      transform: translateY(-1px);
    }
  </style>
</head>
<body>

  <!-- Header -->
  <div class="header">
    <div class="header-icon">🔍</div>
    <div>
      <h1>Submit Review</h1>
      <div class="subtitle">Redline · Code Review</div>
    </div>
  </div>

  <!-- Progress -->
  <div class="progress-wrap">
    <div class="progress-meta">
      <span>Files reviewed</span>
      <span><strong>${stats.filesReviewed}</strong> / ${stats.filesChanged} &nbsp;(${reviewPct}%)</span>
    </div>
    <div class="progress-track"><div class="progress-fill"></div></div>
  </div>

  <!-- Stats grid -->
  <div class="stats-grid">
    <div class="stat-card files">
      <span class="emoji">📁</span>
      <span class="value">${stats.filesReviewed}/${stats.filesChanged}</span>
      <span class="label">Files</span>
    </div>
    <div class="stat-card total">
      <span class="emoji">💬</span>
      <span class="value">${stats.totalComments}</span>
      <span class="label">Comments</span>
    </div>
    <div class="stat-card must-fix">
      <span class="emoji">🔴</span>
      <span class="value">${stats.mustFix}</span>
      <span class="label">Must Fix</span>
    </div>
    <div class="stat-card suggestion">
      <span class="emoji">🟡</span>
      <span class="value">${stats.suggestions}</span>
      <span class="label">Suggestions</span>
    </div>
    <div class="stat-card nitpick">
      <span class="emoji">🔵</span>
      <span class="value">${stats.nitpicks}</span>
      <span class="label">Nitpicks</span>
    </div>
  </div>

  <!-- Summary -->
  <div class="section">
    <div class="section-label">✏️ Review Summary</div>
    <div class="textarea-wrap">
      <textarea id="summary" maxlength="2000"
        placeholder="Summarise the overall quality, key concerns, and any praise..."
        oninput="updateCharCount(this)"></textarea>
      <span class="char-count" id="charCount">0 / 2000</span>
    </div>
  </div>

  <!-- Decision -->
  <div class="section">
    <div class="section-label">⚖️ Decision</div>
    <div class="decision-group">
      <button class="decision-btn approve" data-decision="approve" onclick="selectDecision(this)">
        <span class="btn-icon">✅</span>
        <span class="btn-label">Approve</span>
        <span class="btn-sub">Looks good to merge</span>
      </button>
      <button class="decision-btn comment" data-decision="comment" onclick="selectDecision(this)">
        <span class="btn-icon">💬</span>
        <span class="btn-label">Comment</span>
        <span class="btn-sub">Feedback only</span>
      </button>
      <button class="decision-btn request_changes" data-decision="request_changes" onclick="selectDecision(this)">
        <span class="btn-icon">🔄</span>
        <span class="btn-label">Request Changes</span>
        <span class="btn-sub">Needs more work</span>
      </button>
    </div>
  </div>

  <!-- Sticky footer -->
  <div class="footer-bar">
    <span class="footer-hint" id="footerHint">Select a decision above to enable submission</span>
    <button class="submit-btn primary" id="submitBtn" disabled onclick="submitReview(false)">
      ✔ Submit Review
    </button>
    <button class="submit-btn autofix" id="autoFixBtn" disabled onclick="submitReview(true)">
      ⚡ Submit &amp; Auto-Fix
    </button>
  </div>

  <script>
    const vscode = acquireVsCodeApi();
    let selectedDecision = null;
    const decisionLabels = {
      approve: 'Approve · Ready to submit',
      comment: 'Comment · Ready to submit',
      request_changes: 'Request Changes · Ready to submit'
    };

    function selectDecision(btn) {
      document.querySelectorAll('.decision-btn').forEach(b => b.classList.remove('selected'));
      btn.classList.add('selected');
      selectedDecision = btn.dataset.decision;
      document.getElementById('submitBtn').disabled = false;
      document.getElementById('autoFixBtn').disabled = false;
      document.getElementById('footerHint').textContent = decisionLabels[selectedDecision] || '';
    }

    function updateCharCount(ta) {
      const count = ta.value.length;
      const el = document.getElementById('charCount');
      el.textContent = count + ' / 2000';
      el.classList.toggle('warn', count > 1800);
    }

    function submitReview(autoFix) {
      const summary = document.getElementById('summary').value.trim();
      if (!selectedDecision) return;
      // Disable buttons to prevent double-submit
      document.getElementById('submitBtn').disabled = true;
      document.getElementById('autoFixBtn').disabled = true;
      document.getElementById('footerHint').textContent = autoFix ? '⚡ Launching auto-fix...' : '⏳ Submitting...';
      vscode.postMessage({
        type: 'submit',
        decision: selectedDecision,
        summary,
        autoFix
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
