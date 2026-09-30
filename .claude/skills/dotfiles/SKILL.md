---
name: dotfiles
description: Keep the public ~/.dotfiles repo and ~/scripts/bootstrap in sync with machine changes. Load whenever you edit a config file under $HOME, or install or configure anything by hand (apt package, tmux/Claude plugin, MCP server, system setting).
---

# Dotfiles

`$HOME` is versioned in a **public** bare repo: `git --git-dir=$HOME/.dotfiles --work-tree=$HOME ...` (alias `dotfiles`, `status.showUntrackedFiles no`).

- After editing a tracked config file, offer to commit it. Offer only. Stage just the relevant files or hunks, because other uncommitted changes are often present.
- When installing or configuring something by hand, also add it to `~/scripts/bootstrap` so a new machine gets it. Every step must be idempotent (skip what's already there), since the script is re-run.
- Never commit personal or secret data (emails, tokens, internal hostnames). Bootstrap prompts for those and writes them to machine-local files (`~/.gitconfig`, `~/.gitconfig-denteo`, `~/.zshrc.local`).
- User-scope Claude state lives partly in untracked `~/.claude.json` (MCP servers), so wire those via `claude mcp add` in bootstrap instead.
- The repo README is `~/.github/README.md`, which keeps `~` clean.
