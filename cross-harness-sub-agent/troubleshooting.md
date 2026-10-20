# troubleshooting

during delegation:

- skip an unavailable or unauthenticated target
- surface the failure, likely cause, and shortest fix without weakening permissions
- install, update, or authenticate only when the user asks for setup or repair, then retry once
- if files changed before failure, inspect them and resume the same session instead of starting another writer

## missing output

for a yielded claude run, active empty output is [buffered silence](claude-subagent.md#wait). enter this branch only after the wait step reaches its process-exit completion criterion

## diagnose

run only the failing target's checks:

```bash
claude --version
claude auth status --text >/dev/null 2>&1 && echo "claude authenticated" || echo "claude not authenticated"
codex --version
codex login status >/dev/null 2>&1 && echo "codex authenticated" || echo "codex not authenticated"
```

if these pass, run `claude doctor` or `codex doctor`

## claude code authentication

on macOS, a failed `claude auth status --text` probe inside a codex workspace sandbox is inconclusive because the sandbox may isolate Keychain access. rerun the probe with scoped host/escalated access

- host probe succeeds: treat claude as authenticated and dispatch a fresh claude task/process with host access without asking the user to log in again
- host probe fails: recommend `claude auth login`

## claude code fixes

- missing: `curl -fsSL https://claude.ai/install.sh | bash`
- not authenticated after the host probe: `claude auth login`
- host cannot see terminal login: allow macos keychain access, then create a fresh child process
- outdated, unhealthy, or invalid model: `claude update`, then `claude doctor`

see the [install guide](https://code.claude.com/docs/en/quickstart) and [installation troubleshooting](https://code.claude.com/docs/en/troubleshoot-install)

## codex fixes

- missing: `pnpm add --global @openai/codex`
- not authenticated: `codex login`
- outdated, unhealthy, or invalid model: `codex update`, then `codex doctor`

see the [codex cli documentation](https://developers.openai.com/codex/cli/)

## claude code sandbox

- versions from 2.1.196 may overflow the macos sandbox profile with registered worktrees and fail bash with `E2BIG`
- restart through [claude-subagent.md](claude-subagent.md). its neutral launch directory avoids the overflow without configuring claude code's sandbox
- worktree cleanup is not a routine fix because it may remove another harness's active checkout and the failure returns as the registry grows

see [claude code issue 73437](https://github.com/anthropics/claude-code/issues/73437) and the [sandbox documentation](https://code.claude.com/docs/en/sandboxing)

## separate worktree

- if `bin/wt-run HEAD -- pwd` fails, surface the first failing `bin/ensure-environment` step
- missing parent changes are expected because a worktree starts from committed `HEAD`
- perform git operations blocked by the checkout sandbox from the parent
- before pruning, classify active, dirty, locked, missing, and prunable entries. prune only inactive, missing, unlocked entries
- report retained worktree paths and never force-remove changed worktrees

if something doesn't work, report to the user
