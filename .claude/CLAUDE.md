# Dotfiles

`$HOME` is versioned in a **public** bare repo: `git --git-dir=$HOME/.dotfiles --work-tree=$HOME ...` (alias `dotfiles`).

- After editing a tracked config file under `$HOME`, offer to commit it. Offer only; stage just the relevant files/hunks, other uncommitted changes are often present.
- When installing or configuring something by hand (apt package, plugin, MCP server, system setting), also add it to `~/scripts/bootstrap` so a new machine gets it. Keep each step idempotent.
- Never commit personal or secret data (emails, tokens, internal hostnames). Bootstrap prompts for those and writes them to machine-local files (`~/.gitconfig*`, `~/.zshrc.local`).
