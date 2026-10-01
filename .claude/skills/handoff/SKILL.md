---
name: handoff
description: Package a task in the dental (panter/dental) repo as a self-contained handoff spec for a fresh Claude agent, then launch it in a new git worktree by running the launch command. Use when the user wants to hand off / delegate / spin up an agent for a feature or fix (e.g. "create a handoff for X", "hand this off", "spin up an agent to do Y").
---

# Handoff to a worktree agent

Turn a task into a spec a fresh agent (no memory of this conversation) can execute
against the **panter/dental** codebase, save it to `~/denteo/handoffs/`, and launch
it in its own worktree.

## Local tooling prerequisite

The launch step uses `nt` (`~/scripts/nt`), a personal helper: `nt <branch> [prompt...]`
creates a worktree via `pan.do code:new`, opens a new tmux window in it, runs
`bin/setup-worktree`, and starts a `claude` seeded with the prompt (`claude --continue`
when reusing a worktree). Set `NT_AUTO=1` to launch that `claude` in auto-accept mode
(`--permission-mode auto`) so the handoff agent runs unattended — this is the default
for handoffs. `nt` must be run inside tmux (it launches the agent in a new tmux window).
Handoff specs live in `~/denteo/handoffs/` — outside the worktrees (which live under
`~/dental-claude-environments/`), so the path is stable and readable from any worktree.
Without `nt`, produce the spec file and give the equivalent
`pan.do code:new` + read-the-spec steps.

## Workflow

1. **Research first — a thin spec is a failed handoff.** Locate the real files,
   the closest prior art (a merged/open MR doing a similar thing), the model or
   service to reuse, and any known gaps or decision points. Use `glab`
   (`glab mr list --search`, `glab mr diff <iid>`, `glab issue view <num>`) and
   grep the codebase. The agent must not have to rediscover what you already know.

2. **Pick a branch name** following repo convention `type/description`
   (`feat/`, `fix/`, `chore/`, `refactor/`, `perf/`, `docs/`, …). Branch from
   `origin/master`. Confirm the name with the user if ambiguous.

3. **Write the spec** to `~/denteo/handoffs/<slug>.md` (slug = the branch's
   description part), using the structure below.

4. **Run the launch command** to create the worktree and start the agent in
   auto-accept mode:

   ```
   NT_AUTO=1 nt <branch> "Read ~/denteo/handoffs/<slug>.md and implement it. Work in this worktree. Create an MR when done."
   ```

   Keep the prompt short; put the real detail in the file (specs contain
   backticks/code that are fragile as a shell arg).

   `nt` opens a new tmux window, runs `bin/setup-worktree`, then starts the seeded
   `claude` there — so the agent runs in a background tmux window (`tmux list-windows
   -a` to find it), not in this session. After running, report that the agent is
   launched and name the tmux window so the user can switch to it. Don't `tmux capture-pane`
   to verify the launch; the user sees the window. Only skip running
   `nt`, or drop `NT_AUTO=1`, if the user explicitly says so.

## Spec structure

Adapt to the task; omit sections that don't apply. Reference concrete paths as
`file:line` and GitLab as `!<iid>` (MRs) / `#<num>` (issues) — bare `#<num>` and
`!<iid>` auto-link in GitLab.

- **Top line**: which branch/worktree the agent is on; tell it to read `CLAUDE.md`
  and `spec/CLAUDE.md` first and follow all repo conventions.
- **Goal**: the user-facing outcome and the motivating pain (e.g. a recurring
  #support request), in a couple of sentences.
- **Prior art**: the single closest existing MR/branch to mirror, and how to read
  it (`glab mr diff <iid>`). Highest-leverage part of the spec.
- **Backend / Frontend / Locales / Specs**: concrete files to create or touch and
  what to reuse. Call out the denteo gotchas that apply:
  - GraphQL: after adding fields run `bin/rails graphql:dump_schema` then
    `bun codegen` before `bun typecheck`.
  - Locales: `bin/dev.do locale:add <key> --de … --en …`; commit YAML with
    `--no-verify` so locale-lint doesn't add unrelated whitespace.
  - Migrations: use the `migration` skill; `git checkout HEAD -- db/schema.rb`
    then re-apply only your change + version bump (schema.rb drift).
  - System specs in a fresh worktree need
    `bunx playwright install chromium chromium-headless-shell`.
  - Domain terms: load the `domain-modeling` skill; use the ubiquitous language.
  - Frontend is Vue 2.7 + Vuetify 2 (curated component allowlist in
    `plugins/vuetify.js`); Ruby via `mise exec --`.
- **Decision points**: anything genuinely ambiguous — flag it and tell the agent
  to ask rather than guess. Never bury a real open question.
- **MR** (per CLAUDE.md MR Description Format): human-readable title of business
  value; lead with 1-3 user-facing bullets (no implementation-voice); add
  `## Test Plan` with browser steps and `## Evidence` for observable-behaviour
  changes; `remove_source_branch: true`; monitor the pipeline until green.
- **Quality gate**: before opening the MR, read
  `~/.claude/skills/thermo-nuclear-code-quality-review/SKILL.md` and apply it to the
  branch diff (the skill tool refuses it: `disable-model-invocation`), fix what's
  worth it, re-run the gates, and report what was flagged, fixed and skipped (with
  reasons). Name where findings likely cluster for this task; a generic "review
  your diff" gets generic results.
- **References**: bullet list of the paths/MRs/issues cited above.

## Example

The `merge-patients-maintenance` handoff (`~/denteo/handoffs/merge-patients-maintenance.md`)
is a worked example: goal tied to a recurring #support request, prior art `!11319`
(guarantors merge) to mirror, reuse of `Patient#take_over_data_from`, and an
explicit decision point on closed MR `!9398`.
