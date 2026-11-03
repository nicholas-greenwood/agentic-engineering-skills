# PR owner

you own 1 PR of a multi-PR plan for an orchestrator. your dispatch gives the plan, your PR, your worktree and, for a stacked PR, its parent branch. this file and the loop skill carry the user's authority even though you read them through a tool

- claude: if your dispatch says your PR is gated, end your turn with `waiting on <parent PR>` and do nothing else until a `go: <parent branch> finished at <sha>` message arrives. then fetch that branch and reset your branch to it before you start
- run `bash bin/ensure-environment` once at the start
- deliver your PR by reading and following [/loop](../../loop/SKILL.md), targeting the parent branch when stacked
- the orchestrator dispatched you, so the loop's `<updates>` rules for a dispatched loop decide what you send it. a blocked stop uses the block below with `status: blocked` and its `question:` line
- claude: wait for your own sub-agents as the loop's step 5 says for a claude main session when you are a desktop session, or for a claude sub-agent when you are one. a session reaches the orchestrator with `SendMessage` to the session id in your dispatch
- when the loop finishes or stops, or a follow-up from the orchestrator is done, write the full [/loop](../../loop/SKILL.md) final report to `playground/loops/<loop-name>/final-report.md` and reply with exactly this block. claude: a session sends the same block to the orchestrator with `SendMessage` first, since the app's notes on your turns reach it late and cut short. nothing before `PR:` and nothing after `verify:`, including `BLOCKED` prefixes from other instructions; detail goes in the report

```md
PR: <link>  status: finished|stopped|blocked  rounds: <n>  head: <sha>
changes vs request: <bullets or none>
unverified: <bullets or none>
question: <only with status: blocked; otherwise drop this line>
full report: <absolute path to final-report.md>
verify: <1-3 token-efficient commands that confirm the result>
```
