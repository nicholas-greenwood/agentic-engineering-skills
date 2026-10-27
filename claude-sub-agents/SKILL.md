---
name: claude-sub-agents
description: run parallel claude code writers as sub-agents in their own worktrees
disable-model-invocation: true
---

how a claude code orchestrator runs parallel writers, such as PR owners or dependency workers, as sub-agents. codex does not use this skill: by default it runs parallel writers as new threads

## before dispatch

- run the orchestrator in a worktree session, not the main checkout; a sub-agent's `EnterWorktree` fails otherwise
- check that children can spawn: `Agent` is available and the depth limit is at least 2. report a blocker if not

## per worker

1. create its worktree under `<repo>/.claude/worktrees/` from the right base (`origin/develop`, or the parent branch for a stacked PR): `git worktree add -b <branch> <repo>/.claude/worktrees/<name> <base>`. `EnterWorktree` rejects every other location, including the sibling `-worktrees` directory `bin/wt-run` uses
2. run `bash bin/ensure-environment` in it
3. dispatch a `general-purpose` `Agent` with `claude-opus-5-5` and high effort, without `isolation`. `isolation: "worktree"` puts the worker behind a guard that refuses most commands; a project hook rejects it
4. give the prompt the absolute worktree path and make `EnterWorktree` with `path` set to it the worker's first action. until then its Write/Edit stay pinned to the orchestrator's worktree. sub-agents the worker spawns, such as `/loop` reviewers and validators, inherit its working directory and start work without `EnterWorktree`
5. tell the worker to confirm `git rev-parse --show-toplevel` and `git branch --show-current` match its worktree and branch before every commit or push, and to stop and report on a mismatch. an upstream report saw parallel `EnterWorktree` calls move each other's working directory

complete when every worker runs in its own worktree

## follow-up

resume a finished worker with `SendMessage` to its agent ID; it keeps its transcript, so send only the new request and have it re-confirm its worktree and branch per step 5. when resuming would hurt, send a new worker in the same worktree the previous result and the new request
