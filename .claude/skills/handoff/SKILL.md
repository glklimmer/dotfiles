---
name: handoff
description: Package a task in the dental (panter/dental) or warppcs (glklimmer/warppcs) repo as a self-contained handoff spec for a fresh Claude agent, then launch it in a new git worktree by running the launch command. Use when the user wants to hand off / delegate / spin up an agent for a feature or fix (e.g. "create a handoff for X", "hand this off", "spin up an agent to do Y").
---

# Handoff to a worktree agent

Turn a task into a spec a fresh agent (no memory of this conversation) can execute,
save it outside the worktrees, and launch it in its own worktree. Pick the repo from
the current working directory (or ask if neither applies):

| | dental | warppcs |
|---|---|---|
| Repo | `~/denteo/dental` (GitLab, `glab`) | `~/development/warppcs` (GitHub, `gh`) |
| Specs | `~/denteo/handoffs/<slug>.md` | `~/development/handoffs/<slug>.md` |
| `nt` flag | none (default) | `-r warppcs` |
| Worktree | `pan.do code:new` + `bin/setup-worktree` | plain `git worktree add` under `.claude/worktrees/`, no setup step |
| Links | `!<iid>` MRs, `#<num>` issues | `#<num>` PRs and issues |
| Ends with | an MR | a PR |

Specs live outside the worktrees so the path is stable and readable from any of them.

## Local tooling prerequisite

The launch step uses `nt` (`~/scripts/worktrees/nt`), a personal helper:
`nt [-r dental|dhc|warppcs] <branch> [prompt...]` creates (or reuses) the worktree,
opens a new tmux window in it, runs the repo's setup step, and starts a `claude`
seeded with the prompt (`claude --continue` when reusing a worktree). Set `NT_AUTO=1`
to launch that `claude` in auto-accept mode (`--permission-mode auto`) so the handoff
agent runs unattended — this is the default for handoffs. `nt` must be run inside
tmux. Without `nt`, produce the spec file and give the equivalent worktree-creation
+ read-the-spec steps.

## Workflow

1. **Research first — a thin spec is a failed handoff.** Locate the real files,
   the closest prior art (a merged/open MR or PR doing a similar thing), the code
   to reuse, and any known gaps or decision points. Use `glab` (`glab mr list --search`,
   `glab mr diff <iid>`, `glab issue view <num>`) or `gh` (`gh pr list --search`,
   `gh pr diff <num>`, `gh issue view <num>`) and grep the codebase. The agent must
   not have to rediscover what you already know.

2. **Pick a branch name** `type/description` (`feat/`, `fix/`, `chore/`,
   `refactor/`, `perf/`, `docs/`, `build/`, …), branched from `origin/master`.
   Confirm the name with the user if ambiguous.

3. **Write the spec** to the repo's spec dir as `<slug>.md` (slug = the branch's
   description part; `mkdir -p` the dir if missing), using the structure below.

4. **Run the launch command** to create the worktree and start the agent in
   auto-accept mode:

   ```
   # dental
   NT_AUTO=1 nt <branch> "Read ~/denteo/handoffs/<slug>.md and implement it. Work in this worktree. Create an MR when done."
   # warppcs
   NT_AUTO=1 nt -r warppcs <branch> "Read ~/development/handoffs/<slug>.md and implement it. Work in this worktree. Create a PR when done."
   ```

   Keep the prompt short; put the real detail in the file (specs contain
   backticks/code that are fragile as a shell arg).

   The agent runs in a background tmux window (`tmux list-windows -a` to find it;
   warppcs windows are named `warppcs/<word>`), not in this session. After running,
   report that the agent is launched and name the tmux window so the user can switch
   to it. Don't `tmux capture-pane` to verify the launch; the user sees the window.
   Only skip running `nt`, or drop `NT_AUTO=1`, if the user explicitly says so.

## Spec structure

Adapt to the task; omit sections that don't apply. Reference concrete paths as
`file:line` and MRs/PRs/issues in the repo's link form (table above).

- **Top line**: which branch/worktree the agent is on; tell it to read `CLAUDE.md`
  (dental: also `spec/CLAUDE.md`) first and follow all repo conventions.
- **Goal**: the user-facing outcome and the motivating pain (e.g. a recurring
  #support request, a playtest bug), in a couple of sentences.
- **Prior art**: the single closest existing MR/PR/branch to mirror, and how to read
  it (`glab mr diff <iid>` / `gh pr diff <num>`). Highest-leverage part of the spec.
- **Files to touch**: concrete files to create or touch and what to reuse, plus the
  repo gotchas that apply (below).
- **Decision points**: anything genuinely ambiguous — flag it and tell the agent
  to ask rather than guess. Never bury a real open question.
- **MR / PR**: see the repo section below.
- **Quality gate**: before opening the MR/PR, read
  `~/.claude/plugins/marketplaces/denteo/plugins/human-review/skills/thermo-nuclear-code-quality-review/SKILL.md`
  and apply it to the branch diff (the skill tool refuses it: `disable-model-invocation`),
  fix what's worth it, re-run the gates, and report what was flagged, fixed and
  skipped (with reasons). Name where findings likely cluster for this task; a generic
  "review your diff" gets generic results.
- **References**: bullet list of the paths/MRs/PRs/issues cited above.

### dental gotchas

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
- **MR** (per CLAUDE.md MR Description Format): human-readable title of business
  value; lead with 1-3 user-facing bullets (no implementation-voice); add
  `## Test Plan` with browser steps and `## Evidence` for observable-behaviour
  changes; `remove_source_branch: true`; monitor the pipeline until green.

### warppcs gotchas

- Name the crate the code belongs in (CLAUDE.md "Where code goes") and the project
  skills under `.claude/skills/` the agent must load for this task (e.g.
  `replicon-networking`, `logic-render-split`, `game-feel`, `ui-skin`,
  `warppc-tests`, `rust-style`).
- Gates match CI: `cargo fmt --all --check`,
  `cargo clippy --workspace --all-targets --locked -- -D warnings`,
  `cargo test --workspace --locked`. Use `cargo check` while iterating.
- Never-crash rule: no `unwrap`/`expect`/panics in gameplay crates; `-> Result` + `?`.
- The host also plays, so say whether behaviour must be verified as host, guest or
  both; point at the `run` / `network-benchmark` skills when a live check is needed.
- **PR**: short title in the style of `git log` on master; body explains why in a
  few short paragraphs or bullets, not a file list; no Claude attribution; watch
  `gh pr checks <num> --watch` until green.

## Example

The `merge-patients-maintenance` handoff (`~/denteo/handoffs/merge-patients-maintenance.md`)
is a worked dental example: goal tied to a recurring #support request, prior art
`!11319` (guarantors merge) to mirror, reuse of `Patient#take_over_data_from`, and an
explicit decision point on closed MR `!9398`.
