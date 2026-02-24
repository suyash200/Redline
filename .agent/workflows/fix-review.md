---
description: How to process an AI Review TOML file and apply fixes
---

# /fix-review

When a user provides a `.ai-review/latest.toml` file or a specific review file, follow these steps to apply the requested changes.

## Steps

1. **Read the TOML file**
   - Use `view_file` to get the content of the review file.
   - Parse the `[review]` summary and the `[[comments]]` array.

2. **Categorize by Severity**
   - Prioritize `must_fix` comments.
   - Address `suggestion` and `nitpick` comments as needed.

3. **Apply Fixes Sequentially**
   - For each comment:
     - Open the specified `file`.
     - Locate the `line`.
     - Generate the fix based on the `body` and `codeContext`.
     - Apply using `replace_file_content`.

4. **Summarize**
   - Tell the user which comments you've addressed.
