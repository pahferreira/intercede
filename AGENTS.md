## Agent skills

### Issue tracker

Issues are tracked in GitHub Issues on `pahferreira/intercede` via the `gh` CLI. See `docs/agents/issue-tracker.md`.

### Triage labels

Default vocabulary: `needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix`. See `docs/agents/triage-labels.md`.

### Domain docs

Single-context: one `GLOSSARY.md` and `docs/adr/` at the repo root. See `docs/agents/domain.md`. When a ticket can only be built by working around an ADR, stop and report the conflict.

### Testing

Before writing tests, read `docs/agents/testing.md` for the agreed test seams.

### Review

Reviewers enforce `CODING_STANDARDS.md`.

### Worktrees

A fresh worktree has no `node_modules`: run `bun install` first.
