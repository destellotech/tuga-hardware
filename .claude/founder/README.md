# Founder skills

The 13 skills in `.claude/skills/` come from [emotixco/claude-skills-founder](https://github.com/emotixco/claude-skills-founder) v2.0.2 (commit `41ee742`), MIT licensed (see `LICENSE`).

They are committed here as project skills instead of installed as a plugin, so every Claude Code session in this repo, including fresh cloud sessions, has them without an install step. Run them as `/validate-idea`, `/pricing-strategy`, `/pitch-deck` and so on. Their outputs go to `founder/` at the repo root.

The only change from upstream: each skill's `${CLAUDE_PLUGIN_ROOT}/shared/conventions.md` reference now points at `.claude/founder/conventions.md`.

To update, copy `skills/*` and `shared/conventions.md` from a newer upstream checkout over these files, then redo that path change.
