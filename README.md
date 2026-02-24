# Redline — Redline Your AI's Code Before It Ships

**Redline** is a VS Code extension that brings a structured, intuitive, and automated code review process to AI-generated code. Instead of fragmented feedback, review changes like a real GitHub Pull Request — with inline comments, file-level tracking, and an AI-powered fix loop that works natively in your IDE's chat.

---

## 🚀 Key Features

- **GitHub-Style Sidebar** — See all changed files at a glance with status icons (Added, Modified, Deleted, Renamed) and line stats.
- **Side-by-Side Diffs** — Native VS Code diff experience for every changed file.
- **Inline Commenting** — Add comments directly on code lines with a dedicated severity picker:
  - 🔴 **Must Fix** — Blockers that must be resolved
  - 🟡 **Suggestion** — Best practices and improvements
  - 🔵 **Nitpick** — Styling and minor issues
  - ❓ **Question** — Clarification needed
- **Review Tracking** — Mark files as "Reviewed ✓" as you go. They sort to the bottom automatically.
- **TOML Export** — Generates structured, AI-readable review results in `.redline/latest.toml`.
- **`@redline` Chat Participant** — Integrated AI assistant with `/fix` and `/review` commands that work directly in your IDE's chat panel.
- **⚡ Auto-Fix** — Click "Submit & Auto-Fix" to open `@redline /fix` in the chat, where the AI reads your review and applies all fixes.
- **History** — Browse and revisit past review cycles.

---

## 🤖 `@redline` Chat Participant

Redline registers a **native chat participant** that works directly in your IDE's chat panel. No clipboard hacks, no terminal commands — it talks to the LLM natively.

### Commands

| Command | Description |
|---------|-------------|
| `@redline /fix` | Reads the latest review TOML and asks the AI to apply all must-fix and suggestion items |
| `@redline /review` | Summarises the latest review grouped by severity |
| `@redline <question>` | Ask anything about your review — the AI has full context |

### How it works

1. You submit a review (with or without "Auto-Fix")
2. The review is saved to `.redline/latest.toml`
3. Typing `@redline /fix` in chat sends the full TOML to the LLM with structured instructions
4. The AI streams back the exact code changes needed, file by file

### Supported IDEs

The chat participant uses the **VS Code Chat Participant API** (stable since VS Code 1.93), which is supported by:

- ✅ **VS Code** (with GitHub Copilot Chat)
- ✅ **Cursor**
- ✅ **Antigravity**
- ✅ **Windsurf**
- ✅ Any VS Code fork that supports the Chat Participant API

---

## 🛠️ Installation

### From VSIX
```powershell
code --install-extension redline-0.1.0.vsix
```
Or use the **"Extensions: Install from VSIX..."** command in VS Code.

### Requirements

- VS Code **1.93+** (or compatible fork like Cursor, Antigravity, Windsurf)
- A chat-capable AI extension (e.g. GitHub Copilot Chat, or the built-in AI of your IDE)

---

## 📖 Usage Guide

### 1. Start a Review
- Press `Ctrl+Shift+R` or run **"Redline: Start Review"** from the command palette.
- Pick a commit to review — the extension shows all changes introduced by that commit.

### 2. Review Files
- Select files from the **Redline sidebar** to open the diff view.
- Click the `+` icon on any line to add an inline comment.
- Choose a severity level and type your feedback.
- Use **`Alt+Shift+R`** to mark a file as reviewed.

### 3. Submit Review
- Press `Ctrl+Shift+S` to open the **Submit Review** panel.
- See your review stats at a glance — files reviewed, comment counts by severity, and a progress bar.
- Write a summary, choose a decision (Approve / Comment / Request Changes).
- Click **Submit Review** or **⚡ Submit & Auto-Fix**.

### 4. Auto-Fix with AI

When you click **⚡ Submit & Auto-Fix**:
1. The review is saved to `.redline/latest.toml`
2. The chat panel opens with `@redline /fix` pre-populated
3. The `@redline` participant reads the TOML and sends it to the LLM
4. The AI streams back actionable code fixes

You can also use `@redline /fix` manually at any time — it always reads the latest review file.

---

## ⌨️ Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Ctrl+Shift+R` | Start Review session |
| `Alt+]` | Next changed file |
| `Alt+[` | Previous changed file |
| `Alt+Shift+R` | Toggle "Reviewed" status |
| `Ctrl+Shift+S` | Submit Review dialog |

---

## 🤖 AI Agent Integration

The extension outputs structured state in TOML format for any AI agent to consume.

**Example `.redline/latest.toml`:**
```toml
[review]
decision = "request_changes"
summary = "Fix error handling and use design tokens"

[[comments]]
file = "src/utils/parser.ts"
line = 42
severity = "must_fix"
body = "Add null check before accessing .length"
codeContext = "const len = input.length;"
resolved = false

[[reviewedFiles]]
path = "src/utils/parser.ts"
status = "modified"
reviewed = true
```

### Using `@redline /fix` (Recommended)

The easiest way to auto-fix is through the chat participant:

```
@redline /fix
```

The AI reads `.redline/latest.toml` automatically and applies all fixes. You can add extra instructions too:

```
@redline /fix Only fix the must_fix items, skip suggestions
```

### Using a custom script (Advanced)

If you prefer a script-based workflow, set `redline.autoFixCommand` in settings and add the script to your project:

```json
"scripts": {
  "redline:fix": "your-custom-fix-script"
}
```

---

## ⚙️ Configuration

| Setting | Default | Description |
|---------|---------|-------------|
| `redline.baseRef` | `HEAD~1` | Default git reference for comparison |
| `redline.outputDir` | `.redline` | Where review files are saved |
| `redline.autoFixCommand` | `npm run redline:fix` | Command for script-based auto-fix (fallback) |
| `redline.defaultSeverity` | `suggestion` | Starting severity for new comments |
| `redline.addToGitignore` | `true` | Auto-add output dir to .gitignore |

---

## 📋 Changelog

See [CHANGELOG.md](CHANGELOG.md) for the full release history.

---

## License

MIT

---

*Built for developers who want to trust AI code, but verify it properly.*
