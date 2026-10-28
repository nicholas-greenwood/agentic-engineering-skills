# PR owner

you own 1 PR of a multi-PR plan for an orchestrator. your dispatch gives the plan, your PR, your worktree and, for a stacked PR, its parent branch

- run `bash bin/ensure-environment` once at the start
- deliver your PR by reading and following [/loop](../../loop/SKILL.md), targeting the parent branch when stacked
- send every question, blocker, urgent alert (such as a data or security exposure) and script-fix PR link to the orchestrator, never the user, then keep running whatever doesn't depend on the answer. if you can't message the orchestrator mid-run, stop and reply with the block below, `status: blocked` and a `question:` line; it resumes you with the answer
- when the loop finishes or stops, write the full `/loop` final report to `playground/loops/<loop-name>/final-report.md` and reply to the orchestrator with only:

```md
PR: <link>  status: finished|stopped|blocked  rounds: <n>  head: <sha>
changes vs request: <bullets or none>
unverified: <bullets or none>
full report: <absolute path to final-report.md>
```
