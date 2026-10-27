## start

run every codex command below exactly as 1 line with no redirects. from claude code, run it with `run_in_background: true` and wait for its completion notification, because a codex run outlasts the foreground bash timeout

choose a fresh caller-selected `<output-path>` for every start or resume attempt; its parent directory must exist and the path must not already exist

set `<sandbox>` to the literal `read-only` when edits are forbidden or `workspace-write` when allowed:

```bash
codex -C "<checkout>" --sandbox <sandbox> --model gpt-6.1-sol exec --ignore-user-config -c approval_policy='on-request' -c approvals_reviewer='auto_review' -c model_reasoning_effort='high' --output-last-message "<output-path>" "follow the task in <prompt-file>"
```

`--ignore-user-config` keeps authentication and repository `AGENTS.md` while ignoring personal `config.toml`
keep approval overrides after `exec --ignore-user-config`; global approval flags do not retain these settings in the child
auto-review assesses requested escalations; the selected sandbox remains the default
retain the `session id:` printed by codex as `<codex-session-id>`. accept the non-empty final message at `<output-path>` only after this attempt exits 0; on failure, keep its output for diagnosis. file existence alone does not prove success
never add full-access flags

## computer use

`--ignore-user-config` also drops the `computer-use` MCP server, which only the codex desktop app turns on. when the task needs to click in apps or chrome, start with its 2 overrides and add them to every follow-up too:

```bash
codex -C "<checkout>" --sandbox <sandbox> --model gpt-6.1-sol exec --ignore-user-config -c approval_policy='on-request' -c approvals_reviewer='auto_review' -c model_reasoning_effort='high' -c "mcp_servers.computer-use.command=\"$HOME/.codex/computer-use/Codex Computer Use.app/Contents/SharedSupport/SkyComputerUseClient.app/Contents/MacOS/SkyComputerUseClient\"" -c 'mcp_servers.computer-use.args=["mcp"]' --output-last-message "<output-path>" "follow the task in <prompt-file>"
```

## follow up

rewrite `<prompt-file>` with the exact follow-up, choose another fresh `<output-path>`, then resume with the same sandbox and successful-exit gate:

```bash
codex -C "<checkout>" --sandbox <sandbox> --model gpt-6.1-sol exec resume <codex-session-id> --ignore-user-config -c approval_policy='on-request' -c approvals_reviewer='auto_review' -c model_reasoning_effort='high' --output-last-message "<output-path>" "follow the task in <prompt-file>"
```

replace the shown model or effort when the user explicitly requests another value
