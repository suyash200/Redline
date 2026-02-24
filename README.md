# Redline — Redline Your AI's Code Before It Ships

**Redline** is a VS Code extension that brings a structured, intuitive, and automated code review process to AI-generated code. Instead of fragmented feedback, review changes like a real GitHub Pull Request — with inline comments, file-level tracking, and automated fix loops.

---

## 🚀 Key Features

- **GitHub-Style Sidebar**: See all changed files at a glance with status icons (Added, Modified, Deleted, Renamed) and line stats.
- **Side-by-Side Diffs**: Native VS Code diff experience for every changed file.
- **Inline Commenting**: Add comments directly on code lines with a dedicated severity picker:
  - 🔴 **Must Fix** (Blockers)
  - 🟡 **Suggestion** (Best practices)
  - 🔵 **Nitpick** (Styling/Minor)
  - ❓ **Question** (Clarification)
- **Review Tracking**: Mark files as "Reviewed ✓" as you go. They sort to the bottom automatically.
- **TOML Export**: Generates structured, AI-readable review results in `.redline/latest.toml`.
- **⚡ Automated Fix Loop**: Use the "Submit & Auto-Fix" button to automatically trigger your AI agent to apply resolutions to your comments.
- **History**: Browse and revisit past review cycles.

---

## 🛠️ Installation

1. Download the `redline-0.1.0.vsix` file.
2. Run the following command in your terminal:
   ```powershell
   code --install-extension redline-0.1.0.vsix
   ```
   *Or use the "Extensions: Install from VSIX..." command in VS Code.*

---

## 📖 Usage Guide

### 1. Start a Review
- Press `Ctrl+Shift+R` or run **"Redline: Start Review"**.
- Pick a commit to review — the extension shows changes introduced by that commit.

### 2. Conduct Review
- Select files from the sidebar to open the diff.
- Click the `+` icon on any line to add a comment.
- Select severity and type your feedback.
- Use **`Alt+Shift+R`** to mark a file as reviewed.

### 3. Submit & Fix
- Press `Ctrl+Shift+S` to open the Submit dialog.
- Choose **Submit & Auto-Fix** to trigger an automated fix cycle by your AI agent.
- Your AI agent reads `.redline/latest.toml` and applies fixes automatically.

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

### Automation Script
To enable **Auto-Fix**, add this to your project's `package.json`:
```json
"scripts": {
  "redline:fix": "echo '[REDLINE_AUTO_FIX_REQUESTED]'"
}
```

---

## ⚙️ Configuration

| Setting | Default | Description |
|---------|---------|-------------|
| `redline.baseRef` | `HEAD~1` | Default git reference for comparison |
| `redline.outputDir` | `.redline` | Where review files are saved |
| `redline.autoFixCommand` | `npm run redline:fix` | Command run on Auto-Fix |
| `redline.defaultSeverity` | `suggestion` | Starting severity for new comments |
| `redline.addToGitignore` | `true` | Auto-add output dir to .gitignore |

---

## License

MIT

---

*Built for developers who want to trust AI code, but verify it properly.*
