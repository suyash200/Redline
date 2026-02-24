# Changelog

All notable changes to the **Redline** extension will be documented in this file.

## [0.2.0] - 2026-02-24

### Added
- **`@redline` Chat Participant** — Native AI chat integration using the VS Code Chat Participant API.
  - `@redline /fix` — Reads the latest review TOML and asks the LLM to apply all must-fix and suggestion items.
  - `@redline /review` — Summarises the latest review grouped by severity.
  - `@redline <question>` — General Q&A with full review context.
  - **Participant detection** — VS Code auto-routes review-related prompts to `@redline`.
  - **Follow-up suggestions** — After `/fix`, suggests viewing the review summary (and vice versa).
- **Redesigned Submit Review UI** — Polished webview with:
  - Animated stat cards with gradient accents and hover glow.
  - File review progress bar.
  - Character-counted textarea with focus ring.
  - Glow-on-select decision buttons with descriptive subtitles.
  - Sticky frosted-glass footer bar with gradient submit buttons.
  - Double-submit prevention.

### Changed
- **Auto-Fix** now opens `@redline /fix` in the IDE chat panel instead of spawning a terminal. Works natively with VS Code (Copilot), Cursor, Antigravity, and Windsurf.
- Bumped minimum VS Code engine to `^1.93.0` (required for Chat Participant API).

## [0.1.0] - 2026-02-24

### Initial Release
- **GitHub PR-Style Sidebar**: Dedicated view to track all changed files in a git session.
- **Side-by-Side Diffs**: Native VS Code diff integration for seamless code examination.
- **Inline Commenting**: Ability to add comments directly on any line with custom severity levels.
- **Severity Pickers**: Choose between `Must Fix`, `Suggestion`, `Nitpick`, and `Question`.
- **Review Progress Tracking**: Mark files as "Reviewed" with `Alt+Shift+R` to sort them and track progress.
- **TOML Export**: Structured output to `.redline/latest.toml` for AI agent consumption.
- **⚡ Auto-Fix Loop**: Integration with AI agents via the "Submit & Auto-Fix" button to automate resolutions.
- **Review History**: Browse and reopen past review cycles.
- **Keyboard Shortcuts**: Full keyboard control for navigation, reviewing, and submission.
