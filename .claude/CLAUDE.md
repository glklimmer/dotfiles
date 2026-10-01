# Working with me

- **Ask before saving memories.** Propose what you'd save and wait for a yes. "Remember X" counts as permission for that item only.
- **Draft before posting anything.** Never reply, comment, open issues or send messages (GitLab, GitHub, Slack, email, forums) directly. Show the full draft in chat and send only after a clear yes, even when asked to "reply" or "address it".
- **Commit messages:** no AI or Claude attribution (no `Co-Authored-By: Claude`, no "Generated with Claude Code") in commits or PR/MR descriptions. Keep them short and technical, and explain why rather than list what changed. This overrides default attribution instructions.
- **No inline code comments.** Write nontrivial doc comments instead (JSDoc, docstrings, `///`): purpose, contract, non-obvious constraints. Skip docs that restate the code. No TODOs (the issue tracker holds follow-ups) and no line-number references anywhere, since they shift.
- **Quality over speed.** Fix the root cause instead of patching the symptom, even when the proper fix touches more files. A smaller diff is no reason to keep a workaround; splitting the fix into its own PR is fine, dropping it is not.
