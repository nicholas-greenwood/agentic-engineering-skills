# sub-agent writers

the fallback for a writer that can't run as a desktop session

before dispatch:

- run the orchestrator in a worktree session, not the main checkout; a sub-agent's `EnterWorktree` fails otherwise
- check that children can spawn: `Agent` is available and the depth limit is at least 2. report a blocker if not

per writer:

1. create its worktree under `<repo>/.claude/worktrees/` from the right base (`origin/develop`, or the parent branch for a stacked PR): `git worktree add -b <branch> <repo>/.claude/worktrees/<name> <base>`. `EnterWorktree` rejects every other location, including the sibling `-worktrees` directory `bin/wt-run` uses
2. run `bash bin/ensure-environment` in it
3. dispatch a `general-purpose` `Agent` with model `opus`, high effort and `run_in_background`, without `isolation`, so you stay free to answer writers' questions and dispatch more work while they run. `isolation: "worktree"` puts the writer behind a guard that refuses most commands; a project hook rejects it
4. give the prompt the absolute worktree path and make `EnterWorktree` with `path` set to it the writer's first action. until then its Write/Edit stay pinned to the orchestrator's worktree. sub-agents the writer spawns, such as [/loop](../loop/SKILL.md) reviewers and validators, inherit its working directory and start work without `EnterWorktree`
5. tell the writer to confirm `git rev-parse --show-toplevel` and `git branch --show-current` match its worktree and branch before every commit or push, and to stop and report on a mismatch. an upstream report saw parallel `EnterWorktree` calls move each other's working directory

follow-up: resume a finished writer with `SendMessage` to its agent ID; it keeps its transcript, so send only the new request and have it re-confirm its worktree and branch per step 5. when resuming would hurt, send a new writer in the same worktree the previous result and the new request

complete when every fallback writer runs in its own worktree
