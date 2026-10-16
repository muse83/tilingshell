## Agent skills

### Issue tracker

Issues live in GitHub Issues (via the `gh` CLI). See `docs/agents/issue-tracker.md`.

### Triage labels

Default five-label vocabulary (needs-triage, needs-info, ready-for-agent, ready-for-human, wontfix). See `docs/agents/triage-labels.md`.

### Domain docs

Single-context: one `CONTEXT.md` + `docs/adr/` at the repo root. See `docs/agents/domain.md`.

## Git workflow (read first)

- This repo is a clone of a public GNOME extension (`origin` = upstream). All work happens in the
  maintainer's fork `muse83/tilingshell` (remote `fork`) on the branch `gnome51-port`.
- Never commit on `main`, in any repo. Never push; the maintainer pushes.
- This is the only git repo. Do not create another repo around it or beside it; docs, ADRs and
  the dev stack (`dev-stack/`) live here, on `gnome51-port`.
- Check `git branch --show-current` before every commit.
