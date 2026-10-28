---
name: orchestrate-multi-pr-work
description: orchestrate multi-PR work
disable-model-invocation: true
---

- input: a multi-PR plan
- output: 1 retained task or PR-owner sub-agent and completed `/loop` per PR, tracked in the [status file](#status-file)

- task: in desktop task mode, a codex/claude thread/session/chat visible in its desktop app, created through desktop task tooling; in sub-agent mode, a PR-owner sub-agent
- codex task deeplink: wait for worktree setup to resolve to a `threadId`, then use `[label](codex://threads/<threadId>)`
- finished: a PR whose loop has finished with every goal met, whose CI is green apart from failures its loop recorded as waivers per `/loop`, and whose branch merges cleanly into `origin/develop` (`git fetch origin develop`, then `git merge-tree --write-tree origin/develop <branch>`). a stack is finished when all its PRs are
- dispatchable: a root PR, or a stacked PR whose parent PR has finished

## execution mode

- codex orchestrator: desktop task mode by default; use sub-agent mode only when the user requests it
- claude orchestrator: sub-agent mode by default; use desktop task mode only when the user requests it
- steps 2, 3 and 5 describe desktop task mode. for sub-agent mode, apply the [sub-agent mode](#sub-agent-mode) adaptations; steps 1 and 4 are shared

## 1. map

- group independent PRs into parallel waves and stack each dependency behind its parent. take the dependencies from the plan; re-stack only when a real conflict shows up
- if the rollout requires some actions beyond the PRs, decide who's going to do them: you, the tasks that implement the relevant PRs, or (if it can only be done by the user) the user
- create the status file and send the start line per [updates](#updates)
- complete when every PR belongs to a wave, every dependent PR has a parent, every action beyond the PRs is assigned to the appropriate party, and the status file records all of it

## 2. dispatch

give every dispatchable PR exactly 1 task:

- use a separate worktree, branched from the parent branch for a stacked PR
- minimal prompt: read `<checkout>/.agents/skills/orchestrate-multi-pr-work/prompts/owner.md` in full before anything else and follow it, then the plan, assigned PR, worktree path and parent branch when stacked. `<checkout>` is `git rev-parse --show-toplevel`
- codex: `gpt-6.1-sol` with high reasoning
- claude: `claude-opus-5-5` with high reasoning through `spawn_task`, `auto` permission mode, and `/goal` mode in the prompt
- when a claude auth probe fails in a codex sandbox on macOS, follow [claude code authentication](../cross-harness-sub-agent/troubleshooting.md#claude-code-authentication) before classifying the target as unauthenticated
- retain the task for follow-up requests

complete when every dispatchable PR has 1 configured task and the rest remain gated

## 3. monitor and advance

- wait on task completion notifications silently
- on every wake-up, refresh the status file, including PRs the user merged; children of a merged PR carry on under `/loop`'s stacked-PR rules. take round counts from the highest `handoffs/r<n>-*` in each loop dir; counts that lag between wake-ups are fine
- answer an owner's question yourself when the plan settles it, and record it under `deviations` when the answer departs from the plan. otherwise spawn a [helper](#helpers) when the answer may already be in the code or data; only a question nothing settles goes to `needs you`
- when an owner reports, check its block against the PR's head, base and CI before marking the PR finished. before announcing a finished stack, re-check every PR in it the same way. a loop that stopped with goals unmet is a blocker. carry big departures from the plan in its `changes vs request` into `deviations`
- let each task cook; message a task only to correct off-rails work, unblock it, or pass on the user's answer to its `needs you` item; don't encourage too much back-and-forth between tasks
- dispatch newly dispatchable PRs through step 2

complete when every planned PR has a retained task and every `/loop` has finished

## 4. bring everything together (skip if all PRs are in 1 stack)

- a [helper](#helpers) creates a throwaway branch from a freshly fetched `origin/develop` in its own worktree, brings all the changes there and confirms everything works. the throwaway branch only proves the combination works; nothing on it reaches the PRs
- resolve every merge conflict, trivial or not, in the owners' PRs so that merging to `origin/develop` goes smoothly. for example, you can make the conflicting PRs stacked on each other, then send the follow-up messages to the related tasks so their owners resolve the conflicts. once their heads move, rerun step 4 on the new heads
- add non-trivial changes to `needs you` and stop

## 5. finish

- re-check each open PR's head, base and CI against the status file, then its merge into a freshly fetched `origin/develop`. an open PR whose head or base moved after it finished, or that no longer merges cleanly, goes back to its owner, along with every open PR stacked on it. `merged` is terminal
- set line 1 to `DONE` once every loop has finished, step 4 has passed on the current `origin/develop` and every open PR's current head, or was skipped, and every action beyond the PRs is done
- send the final report per [updates](#updates)
- complete after the message is sent and every task remains accessible for follow-up

## status file

`playground/orchestrations/<name>/status.md` in your checkout, where `<name>` is a short slug of the plan. you are its only writer. it is your memory, so reread it after compaction

update it before the matching chat message, whenever something material changes: a PR opens, finishes, merges or blocks, a blocker appears or resolves, a deviation is decided, or a round count moves

```md
WORKING
last updated: 28 Oct 14:32 GMT
[PRs](#prs) · [finished stacks](#finished-stacks) · [needs you](#needs-you) · [deviations](#deviations) · [orchestrator memory](#orchestrator-memory)

## PRs

| PR | stack | status | round | owner | blockers |
| --- | --- | --- | --- | --- | --- |

## finished stacks

1. <stack>: #101 -> #102, merge in this order

## needs you

### B1: <question>

recommended: <answer>, ideally as a 1-click fix or exact command
alternative: <closest real alternative>

## deviations

- <plan said> -> <what happened>; why; decided by orchestrator|<PR> loop|user

## orchestrator memory

expand below

<details><summary>memory</summary>

</details>
```

- line 1: `DONE`, `COMPLETELY BLOCKED` when nothing can advance without the user, `PARTIALLY BLOCKED` when some work still can, or `WORKING`
- last updated: local time with timezone
- status: `waiting`, `running`, `blocked`, `finished` or `merged`. owner: task deeplink or agent ID. blockers: the PR's `needs you` ids, each linked to its heading
- needs you: only what the user alone can resolve, after you've tried every route. resolved items move into memory
- deviations: big decisions by you or the loops that depart from the plan. small in-loop deviations stay out
- memory: enough to carry on after compaction: plan location and amendments, wave and stack map, parent branches, absolute worktree and loop-dir paths, owners, last verified head per PR, step 4 evidence, actions beyond the PRs and their owners, resolved blockers, next steps
- section links point only at headings outside `<details>`, since anchors don't expand it

## updates

these rules override your harness's progress-update guidance for the whole run

the user follows the run through the status file. write to the chat only:

- at the start: 1 sentence naming the waves
- when you add a `needs you` item, ideally with a 1-click fix
- when something needs action now, such as a data or security exposure
- when a stack finishes: 1 line naming it
- when an owner reports a script-fix PR: its link
- at the end: the final report

every message starts with line 1 of the status file as a markdown link to the file's absolute path, so it opens in the harness, such as `[WORKING](/abs/path/playground/orchestrations/<name>/status.md)`

say each question once, then keep running whatever doesn't depend on the answer

everything else is quiet: dispatches, rounds, waits, owner reports and pushes

- a notification or timer is environment, not the user: update the status file and keep waiting
- where a wake-up must end with text, that text is 1 short line

the final report stands on its own: every status file section above memory, with the file linked for the rest

## helpers

follow `/helper-sub-agents` (`.agents/skills/helper-sub-agents/SKILL.md`), with output under `playground/orchestrations/<name>/helpers/` and at most 5 at once. spawn one:

- before adding an owner's question to `needs you`, to check whether the plan, code or data answers it
- to diagnose a stuck or off-rails loop from its loop dir
- for step 4: the only helper that may commit, only to the throwaway branch, and never pushes
- for actions beyond the PRs assigned to you that take more than a few commands

you stay the only writer of the status file, and owners stay the only writers of their PRs

## sub-agent mode

adapt steps 2, 3 and 5 as follows:

- dispatch 1 PR-owner sub-agent per dispatchable PR in a separate worktree. give it the step 2 prompt. it reads and follows [/loop](../loop/SKILL.md) and may spawn its own review and validation sub-agents in that worktree
- codex: `spawn_agent`, `fork_turns: none`, `gpt-6.1-sol`, high reasoning. check that children can spawn before dispatch: codex needs `spawn_agent`. report a blocker if unavailable
- claude code: set up the worktrees and dispatch per the `/claude-sub-agents` skill
- keep step 3, using agent IDs in place of task deeplinks and the sub-agent dispatch above for newly dispatchable PRs. handle follow-up in this conversation
