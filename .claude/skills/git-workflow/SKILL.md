---
name: git-workflow
description: Branching and commit habits for any repo. Load before creating a branch, committing, or temporarily swapping file versions with git.
---

# Git workflow

- **Never commit to master/main.** Branch (`type/description`) before the first commit, even for a small fix; everything lands through a PR/MR. If commits already landed on master unpushed: `git branch <name>`, then `git reset --hard origin/master`. Never force-push a shared master.
- **Commit along the way.** One commit per verified step (lint and tests green), not one big commit at the end. Each step stays reviewable and is easy to unwind.
- **Push after committing.** Once the work is committed on a feature branch, push it without asking, so the MR and CI reflect it. A force-push, or any push to master/main, still needs a clear yes.
- **No `git stash` to swap committed files.** Stashing paths without uncommitted changes stashes nothing, so the paired `pop` applies whatever unrelated stash sits at `stash@{0}`. Load the other version with `git checkout <ref> -- <paths>` and restore with `git checkout HEAD -- <paths>`. Before any `git stash pop`, check `git stash list`.
