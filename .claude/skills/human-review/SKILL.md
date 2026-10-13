---
name: human-review
description: Interactive MR/PR review mode - walks the human reviewer through a GitLab MR or GitHub PR in small chunks, answers questions and queues their feedback as draft review comments. Use when asked to review an MR/PR together / human-review an MR/PR.
allowed-tools: Read, Grep, Glob, Write, Skill, Agent, mcp__human-review__show_chunk, mcp__human-review__show_proposal, Bash(glab api:*), Bash(gh api:*), Bash(gh pr view:*), Bash(gh pr list:*), Bash(git fetch:*), Bash(git diff:*), Bash(git log:*), Bash(git merge-base:*), Bash(git remote get-url:*), Bash(git branch --show-current)
---

# Interactive MR/PR review

Walk the human reviewer through a merge request (GitLab) or pull request (GitHub), called MR below, in small chunks and answer their questions. **You do not judge the code yourself**; the background quality review is the only source of findings.

**Argument:** MR/PR number (e.g. `1234`), source branch name, or nothing (current branch). Append `--resume` to continue a review from its state file.

## Forge

`git remote get-url origin` decides: a `github.com` remote is GitHub (`gh`), anything else GitLab (`glab`). Both fill in the current repo: `projects/:id` for glab, `repos/{owner}/{repo}` for gh.

| Step | GitLab | GitHub |
|---|---|---|
| MR by number | `glab api projects/:id/merge_requests/<n>` | `gh pr view <n> --json number,title,body,headRefName,baseRefName,headRefOid` |
| MR by branch | `glab api "projects/:id/merge_requests?source_branch=<branch>&state=opened"` | `gh pr view <branch> --json …` (same fields) |
| SHAs | `diff_refs`: `base_sha`, `start_sha`, `head_sha` | `head_sha` = `headRefOid`; `base_sha` = `git merge-base origin/<baseRefName> <head_sha>` after the fetch |
| MRs stacked on it | `?target_branch=<source_branch>&state=opened` | `gh pr list --base <headRefName> --json number,title` |
| MR it targets | `?source_branch=<target_branch>&state=opened` | `gh pr list --head <baseRefName> --json number,title` |

## Rules while reviewing

- No commits, code edits or memory saves. No AskUserQuestion: chunks and replies are plain text.
- Nothing is created on GitLab before the end step.
- Fixing the code is a separate step after the review (offer a handoff for the queued notes), never mid-review.

## 1. Start

1. Resolve the MR (see Forge), with the branch given or `git branch --show-current` when no number is given.
2. Keep the number, title, description, source and target branch.
3. `git fetch origin <source_branch> <target_branch>`, then the SHAs (see Forge). Work from `git diff <base_sha>..<head_sha>`: diffing against the merge base keeps stacked MRs to their own part.
4. Stack context: the MR this one targets and the MRs stacked on it (see Forge). Note their titles.
5. Plan the chunks (section 3) and write the state file (section 6).
6. Launch the quality review (section 2) without asking.
7. Show a 2–3 sentence summary (goal, key areas, stack position), the planned chunk list, and once: "Specs and config: quality review only, majors surfaced. Say 'walk specs' to step through them." Say the quality review is running and the first chunk follows once it is done.
8. Wait for the quality review's report before showing the first chunk. Answer questions meanwhile, but start no chunk.

## 2. Quality review

Launch one `Agent`. Its prompt:

- Read `~/.claude/skills/thermo-nuclear-code-quality-review/SKILL.md` and apply it. The skill has `disable-model-invocation`, so the Skill tool refuses it.
- Scope: `git diff <base_sha>..<head_sha>`, specs included. Read-only; post nothing.
- Check how the changed code is used (callers, consumers) before calling something unused or wrong.
- The stack context from step 1.3: don't flag what a neighbouring MR handles; say so instead.
- The planned chunk list with labels.
- Report each finding as: severity, file, new-file line, chunk label, the exact quoted line, problem, remedy. No nits.

When the report arrives, verify each finding against the code. Drop findings without a matching quoted line, nits, and wrong ones (one line each saying why). Then start the chunks:

- Walked chunks: pass each finding in that chunk's `findings`.
- Specs, config and group-approved chunks: surface the major ones once before the end summary.

## 3. Chunks

Order: dependencies before dependents, so each chunk only uses what the reviewer has seen. Typically schema and data types, then core logic, then interfaces (API, events, plugin wiring), then presentation. Follow the repo's own layering where its CLAUDE.md describes one (shared crates before the crates using them, logic plugins before render plugins). Deleted code before added code. Specs/tests and config are not walked unless the reviewer asks.

Size: one logical change of roughly 5–25 lines. Split big files (one chunk per method) and long hunks. Translations: show one locale and note that the others mirror it. With more than ~25 chunks, offer to approve runs of trivial ones as a group ("these 4 type chunks only add fields, approve together?").

Each chunk: call `mcp__human-review__show_chunk` with `index`, `total` (update the estimate as files get split), `path`, `base_sha`, `head_sha`, `new_start`/`new_end` (new-file lines; add `old_start`/`old_end` only for removals outside the new range, such as a deleted file), the verified `findings`, and a `summary` of one or two sentences: what the change does, how it relates to other chunks, where it is used (Grep the callers) and any new domain term. The tool reads the code from git and draws it; never paste the code yourself, and do not repeat it after the call. After the call, end with exactly the line `ok · fb … · skip`: a turn needs visible text, and the reviewer replies next.

If the tool is unavailable or fails: print the header `Chunk n/~total: <file>`, the summary, and the code yourself. Pure additions in a block fenced with the file's language, with the new-file start line in the header; anything else in a ```` ```diff ```` block with 2–3 context lines. Put the chunk's verified findings under the code.

## 4. Replies

Replies are plain text. Never suggest `!` or `?` prefixes: `!` runs a shell command in Claude Code.

- `ok`, `approve`, `lgtm`: next chunk.
- `skip`: revisit after the last chunk.
- Feedback: starts with `fb` or `note`, or says so ("queue it", "as question", "fold into 3"). Queue a note (section 5), then next chunk.
- `walk specs`: add spec and config chunks to the end of the plan.
- Anything else is a question: answer from the code (Read/Grep as needed; say so when only the author can know), then wait.

When proposing a change (a fix, "how would it look"), call `mcp__human-review__show_proposal` once per file with the diff: hunks with real line numbers (Read the file first), unchanged stretches omitted by starting a new hunk. Put any context needed to follow it after the call. Without the tool, use one ```` ```diff ```` block.

## 5. Feedback queue

Load the `comment-voice` skill if available. On feedback, write the note text right away and echo it with its number. Don't ask how it should read.

- Default framing for a change: "could we … instead?". When asked for a question, ask whether the idea is good, not why the author did it.
- No `suggestion:`/`question:`/`nit:` prefixes, no hypotheticals.
- Commands: `drop N`, `edit N <text>`, `fold into N` (merge the feedback into note N), `show N`, `notes` (list all).

Each note: number, `path`, `new_line` (or `old_line` for lines that exist only in the old file), `body`. Notes live only in the state file until the end step. Anchor notes on lines inside the diff's hunks: both forges refuse a position outside them.

## 6. State and resume

Keep `~/.claude/human-review/<repo>-<n>/state.json` (`<repo>` is the basename of the origin URL without `.git`: a fixed path, unlike the scratchpad, so a new session finds it), rewritten with `Write` after every reply: the `diff_refs`, the chunk plan (label, path, ranges, status ok/skipped/pending), the current index and the notes. With `--resume`, read it, say where the review stands, and continue with the next pending chunk. The file lets a review survive compaction or a new session.

## 7. End

Show the summary: chunks reviewed, each note as `file:line` plus its gist. Then offer, in plain text: **create** (unpublished drafts), **publish** (create and publish), **edit**, **discard**. Approve only if the reviewer asks.

### GitLab

To create a draft note, `Write` `~/.claude/human-review/<repo>-<n>/note-<k>.json`:

```json
{
  "note": "<body>",
  "position": {
    "base_sha": "<base_sha>",
    "start_sha": "<start_sha>",
    "head_sha": "<head_sha>",
    "position_type": "text",
    "old_path": "<path>",
    "new_path": "<path>",
    "new_line": 42
  }
}
```

and post it (the header is required, otherwise GitLab answers 415):

```
glab api projects/:id/merge_requests/<n>/draft_notes -X POST -H "Content-Type: application/json" --input <file>
```

To change a draft already on GitLab, PUT `projects/:id/merge_requests/<n>/draft_notes/<draft_id>` with the same body, **full `position` included**: a PUT without it wipes the line. Then GET the draft back and confirm `position.new_line` (or `old_line`) before saying done.

Publish with `glab api -X POST projects/:id/merge_requests/<n>/draft_notes/bulk_publish`. Approve with `glab api -X POST projects/:id/merge_requests/<n>/approve`.

### GitHub

All notes go into one pending review. `Write` `~/.claude/human-review/<repo>-<n>/review.json` (no `event`, so the review stays pending and only the reviewer sees it):

```json
{
  "commit_id": "<head_sha>",
  "comments": [
    { "path": "<path>", "line": 42, "side": "RIGHT", "body": "<body>" }
  ]
}
```

`side` is `LEFT` for an `old_line` note. Create it with `gh api repos/{owner}/{repo}/pulls/<n>/reviews -X POST --input <file>` and keep the returned `id`. GitHub allows one pending review per user: to change notes afterwards, `DELETE repos/{owner}/{repo}/pulls/<n>/reviews/<id>` and create it again from the updated file.

Publish with `gh api repos/{owner}/{repo}/pulls/<n>/reviews/<id>/events -X POST -f event=COMMENT`, or `event=APPROVE` when the reviewer asks to approve. GitHub refuses approving your own PR; publish as `COMMENT` then and say so.
