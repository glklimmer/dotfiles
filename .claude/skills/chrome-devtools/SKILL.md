---
name: chrome-devtools
description: How to use the headless, isolated chrome-devtools MCP on this machine without timeouts. Load before calling any mcp__chrome-devtools__* tool.
---

# chrome-devtools MCP

Runs headless and isolated on purpose (user scope, Flatpak Chrome via `--executable-path`) so it never takes focus. Don't switch it to headful or bring windows to the front: headful hangs on hidden or covered windows (upstream #2290).

- Never `take_screenshot` right after `navigate_page`/`new_page`: wait first (`wait_for` text, or `take_snapshot`). Screenshots during post-navigation stabilization time out (upstream #2459).
- Prefer `take_snapshot` (DOM) when the check doesn't need pixels.
- Page-scoped tools need `pageId`.
- `--isolated` means an empty profile every session, so log in each time (credentials are in the project's CLAUDE.md).
- Flatpak Chrome sees its own `/tmp` and `~/.cache`: save screenshots with `filePath` under `~/.var/app/com.google.Chrome/`, or keep them inline.
