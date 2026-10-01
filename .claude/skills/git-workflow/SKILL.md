---
name: git-workflow
description: Branching and commit habits for any repo. Load before creating a branch, committing, or temporarily swapping file versions with git.
---

# Git workflow

- **Never commit to master/main.** Branch (`type/description`) before the first commit, even for a small fix; everything lands through a PR/MR. If commits already landed on master unpushed: `git branch <name>`, then `git reset --hard origin/master`. Never force-push a shared master.
- **Commit along the way.** One commit per verified step (lint and tests green), not one big commit at the end. Each step stays reviewable and is easy to unwind.
- **No `git stash` to swap committed files.** Stashing paths without uncommitted changes stashes nothing, so the paired `pop` applies whatever unrelated stash sits at `stash@{0}`. Load the other version with `git checkout <ref> -- <paths>` and restore with `git checkout HEAD -- <paths>`. Before any `git stash pop`, check `git stash list`.
