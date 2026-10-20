---
name: orchestrate-multi-pr-work
description: orchestrate multi-PR work
disable-model-invocation: true
---

- input: a multi-PR plan
- output: 1 retained task or PR-owner sub-agent and completed `/loop` per PR, with rounds, PR links and task deeplinks or agent IDs reported

- task: in desktop task mode, a codex/claude thread/session/chat visible in its desktop app, created through desktop task tooling; in sub-agent mode, a PR-owner sub-agent
- codex task deeplink: wait for worktree setup to resolve to a `threadId`, then use `[label](codex://threads/<threadId>)`
- ready: a root PR, or a stacked PR whose parent loop has finished and parent PR is ready to merge

## execution mode

- codex orchestrator: desktop task mode by default; use sub-agent mode only when the user requests it
- claude orchestrator: sub-agent mode by default; use desktop task mode only when the user requests it
- steps 2, 3 and 5 describe desktop task mode. for sub-agent mode, apply the [sub-agent mode](#sub-agent-mode) adaptations; steps 1 and 4 are shared

## 1. map

- group independent PRs into parallel waves and stack each dependency behind its parent
- if the rollout requires some actions beyond the PRs, decide who's going to do them: you, the tasks that implement the relevant PRs, or (if it can only be done by the user) the user
- complete when every PR belongs to a wave, every dependent PR has a parent, and every action beyond the PRs is assigned to the appropriate party

## 2. dispatch

give every ready PR exactly 1 task:

- use a separate worktree, branched from the parent branch for a stacked PR
- minimal prompt. the plan and the `/loop` skill describe everything. only include the plan, assigned PR, its parent branch when stacked, instructions to run `bash bin/ensure-environment` once at the start, instructions to follow the `/loop` skill, instructions to report back to you when the work has finished/stopped
- codex: `gpt-6.1-sol` with high reasoning
- claude: `claude-opus-5-5` with high reasoning through `spawn_task`, `auto` permission mode, and `/goal` mode in the prompt
- when a claude auth probe fails in a codex sandbox on macOS, follow [claude code authentication](../cross-harness-sub-agent/troubleshooting.md#claude-code-authentication) before classifying the target as unauthenticated
- retain the task for follow-up requests

complete when every ready PR has 1 configured task and blocked PRs remain gated

## 3. monitor and advance

- wait on task completion notifications silently
- message the user only when a PR changes materially (opened, ready to merge, scope or design changed) or a new blocker appears; a new round, an interim notification or a still-running task is not a reason
- each such message includes a table with `PR link`, `round`, `task deeplink`, and `blockers` if any
- begin every message to the user with an uppercase status: WORKING/FINISHED/BLOCKED
- let each task cook; message only to correct off-rails work or get it unblocked where user input is not needed; don't encourage too much back-and-forth between tasks
- dispatch newly ready PRs through step 2

complete when every planned PR has a retained task and every `/loop` has finished

## 4. bring everything together (skip if all PRs are in 1 stack)

- create a new throwaway branch from `origin/develop`, bring all the changes there, confirm everything works
- if there are merge conflicts, resolve them so that merging to `origin/develop` goes smoothly. for example, you can make the conflicting PRs stacked on each other and resolve the conflicts yourself, or send the follow-up messages to the related tasks
- stop and notify the user if the changes are not trivial

## 5. finish

- tell the user all loops have finished; include a table with all the PRs, number of rounds, and links
- complete after the message is sent and every task remains accessible for follow-up

## sub-agent mode

adapt steps 2, 3 and 5 as follows:

- dispatch 1 PR-owner sub-agent per ready PR in a separate worktree. give it the step 2 prompt plus the absolute worktree path. it runs `/loop` and may spawn its own review and validation sub-agents in that worktree
- codex: `spawn_agent`, `fork_turns: none`, `gpt-6.1-sol`, high reasoning. check that children can spawn before dispatch: codex needs `spawn_agent`. report a blocker if unavailable
- claude code: set up the worktrees and dispatch per the `/claude-sub-agents` skill
- keep step 3, using agent IDs in place of task deeplinks and the sub-agent dispatch above for newly ready PRs. finish when every `/loop` completes; report PR links, rounds and agent IDs. handle follow-up in this conversation
