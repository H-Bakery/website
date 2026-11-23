# AGENTS.md

Instructions for coding agents (Codex and others) working in this repo. The full project guide is
[`CLAUDE.md`](CLAUDE.md) - **read it first**; everything there applies here too. This file only
adds the rules for working as a delegated agent.

## Hard rules

- **This repo is public.** Code, tests, fixtures, snapshots, screenshots, PR texts and commit
  messages use synthetic data only - never real amounts, customer or staff names, phone numbers,
  IBANs or addresses. You may read the private sibling repo `../hq` to learn a file _format_; never
  copy a real value out of it.
- **Branch → PR.** Never push to `main`, never merge, never force-push someone else's branch.
- **No deploy, no production access.** Don't touch the shop box / Pi, `/opt/bakery`, `/etc/bakery`
  or anything over SSH. Don't write to `../hq`.
- **German** for every customer- and staff-facing text (UI, API `message`, docs in `docs/`).
- No new dependencies without saying why in the PR.

## How to work a task

1. Tasks live in `.mc/tasks/todo/TASK-*.md`. The task file is the requirement; the domain doc in
   `docs/domains/` it links to holds the rules. Read both before coding.
2. Business formulas go into exactly one `apps/bakery-api/src/services/*.core.js` (see `CLAUDE.md`).
3. Check before you open the PR (commands in `docs/development.md`):
   - unit tests of the touched projects, e.g. `npx nx test bakery-api`, `npx nx test bakery-management`
   - `npx nx lint <project>` and the type check (`npx tsc -p apps/<app>/tsconfig.json --noEmit`)
   - `npx prettier --check` on the changed files
4. Update the docs the change touches (`docs/domains/*.md`, `docs/api/*.md`).
5. PR body: what changed, how it was tested, **open questions for the owner** (decisions the task
   leaves open - pick a sensible default, say which, don't block on it).

## Reviewing a PR

Check the diff against the task's acceptance criteria and `CLAUDE.md`: correctness, a second
implementation of a formula, invented data or sample values instead of `no-data`, real data in
tests, missing German copy, missing tests or docs. Report findings ranked by severity with
file:line; don't restyle working code.
