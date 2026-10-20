## start

from codex, run claude commands outside the codex sandbox for macOS Keychain access

set `<mode>` to the literal `read-only` for investigation or `write` when edits are allowed. run `uuidgen` separately and reuse its output in lowercase as `<session-id>`. pass `--model` or `--effort` only for an explicit override. for a saved report, choose an `<output-path>` with an existing parent directory and pass `--output`; omit it when no report file is needed

run from the checkout containing the runner, with literal arguments and no assignments, substitutions or redirects:

```bash
bash .agents/skills/cross-harness-sub-agent/scripts/run-claude --mode <mode> --workspace "<checkout>" --prompt-file "<prompt-file>" --session-id <session-id> --output "<output-path>"
```

the runner starts claude in a neutral temporary directory and adds `<checkout>` for file access. `CLAUDE.md` loads when present; the task prompt must require reading `AGENTS.md`. repository permission rules, hooks and sandbox settings are not loaded; the child changes to `<checkout>` for Bash commands as the runner directs

## wait

buffered silence: `--output-format text` emits only the final report. while the process handle is active, empty stdout and a 0-byte mirror are an expected running state

poll the shell process every 30s until it returns an exit code, using its handle for polling and `<session-id>` for `--resume`. this step completes only at process exit; preserve the session and any requested handoff while it is active

the runner mirrors the final report under the macOS user temporary directory at `cross-harness-claude/<workspace-hash>/<session-id>.out`, where `<workspace-hash>` is the first 16 hex characters of the SHA-256 of the absolute checkout path. partial output remains there on failure. if the process handle is lost, inspect the mirror for diagnosis; without a confirmed successful exit, it is not an accepted report

accept a report only after this attempt exits 0 and its report is non-empty. `--output` atomically publishes the mirror after successful non-empty completion; provider failure, empty output or publication failure leaves the previous report intact and exits non-zero. an old file does not prove this attempt succeeded

## follow up

the runner deletes `<prompt-file>` after success. write the exact follow-up to that path again with the file-writing tool, then resume from the runner checkout with the same mode and the same successful-exit gate:

```bash
bash .agents/skills/cross-harness-sub-agent/scripts/run-claude --mode <mode> --workspace "<checkout>" --prompt-file "<prompt-file>" --resume <session-id> --output "<output-path>"
```

retain the session id until completion
