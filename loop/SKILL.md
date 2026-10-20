---
name: loop
description: use only when the user or another skill tags it
---

you are the orchestrator: you do the work yourself and spawn sub-agents only for review and validation

<what-to-do>

1. write the loop docs:
   - `contract.md` with sections:
     - goals: specific and verifiable
     - non-goals: what's out of scope
     - behaviour to preserve
     - things to reuse for sure
     - non-functional requirements
     - accepted tradeoffs: known nuances the user has accepted, so reviewers don't re-flag them
     - risky paths
     - hard boundaries: loop-specific never-violate rules on top of AGENTS.md (data, infra, external systems)
     - environment notes: facts verified live in this environment (exact commands, quirks, timings) so sub-agents don't rediscover them
     - stop conditions
   - `validation.md`: 1-20 assertions with stable ids (`VAL-01`, ...)
     - each is manual and side-effect-free: a headless `agent-browser` flow, a curl call against a local endpoint, a read-only data check (local/prod)
     - never "tests or static code checks pass" - CI already covers that
     - each assertion states surface, exact steps, pass criteria, and required evidence (screenshots mandatory for UI flows)
     - each must be executable by a fresh agent with no context beyond the loop dir
     - for any user-facing change, manual `agent-browser` validation is mandatory. to make testing easier consider adding a `tmp` story per the `/storybook` skill
   - init `validation-state.json` per `<validation-state>`
   - run `mkdir -p "playground/loops/<loop-name>"/{handoffs,evidence}`
   - size the docs to the change: a small loop may be a few-line contract with sections marked "n/a" and 1 assertion; a 500 loc loop earns the full template
2. complete the task against that contract
   - test it adversarially: if needed, add data to local DB, use smoke tests, use browser, etc.
   - make sure it will work in prod against prod DB; don't edit prod data
   - done when every contract goal is implemented and every assertion is either self-marked passed with evidence (trivially cheap ones only) or left failed for the validator
3. open a PR with the `/pr` skill
4. pin round `<n>` to the pushed commit: on a clean worktree run `git rev-parse --verify 'HEAD^{commit}' > playground/loops/<loop-name>/round-head`, then leave the worktree untouched until step 7. run reviewers and the validator in parallel (reports go to `handoffs/r<n>-*`):
   - independent review agents with clear chat history: default 1; up to 4 for high-risk changes
     - go with the first different entries from the `/ai-code-review-catalog` skill under `<reviewers>`
     - full review in rounds 1, 2, 3, 6, then every multiple of 5 from 10, or after a contract/core-design or base change; diff-only review otherwise
     - append `<reviewer-prompt-suffix>` to every reviewer prompt, substituting `<review-mode-instructions>` with only the selected instruction:
       - full: `ROUND_SHA="$(cat playground/loops/<loop-name>/round-head)"; inspect git diff "$(git merge-base "$ROUND_SHA" origin/<base>)" "$ROUND_SHA"`
       - diff-only: `ROUND_SHA="$(cat playground/loops/<loop-name>/round-head)"; inspect git diff "$(cat playground/loops/<loop-name>/last-reviewed-head)" "$ROUND_SHA"; use surrounding code only as context and report only issues introduced by this diff`
     - read-only reviewers return their report as the final response. pass the handoff path to the claude launcher with `--output`, or use a fresh attempt path outside `handoffs/` with codex `--output-last-message`; accept only a non-empty report from a confirmed successful current attempt, then copy the accepted codex attempt to the handoff path. persist native sub-agent final responses to the handoff path yourself. failed or partial output is diagnostic evidence, never a completed review
   - run 1 codex native review agent with the matching mode through `bin/codex-native-review`; local reviewers still carry contract and skip coverage
     - record available verification in `evidence/r<n>-verification.md`: exact commit, commands or CI links, scope and pass/fail/pending status. pending checks may stay pending while review runs
     - when the parent harness is sandboxed, launch the helper outside that parent sandbox with an escalated shell command; its reviewer remains read-only and uses the evidence rather than running tests/static checks
     - full:
       ```bash
       bin/codex-native-review origin/<base> \
         playground/loops/<loop-name>/handoffs/r<n>-codex-native \
         playground/loops/<loop-name>/evidence/r<n>-verification.md
       ```
     - diff-only:
       ```bash
       bin/codex-native-review "$(cat playground/loops/<loop-name>/last-reviewed-head)" \
         playground/loops/<loop-name>/handoffs/r<n>-codex-native \
         playground/loops/<loop-name>/evidence/r<n>-verification.md
       ```
     - retain the helper's report path for triage and its log for launcher/provider failures
   - run 1 worker sub-agent as validator, tasked per `<validator-task>`
   - substitute `<loop-name>`, `<n>` and `<base>` (the PR's current base branch) in the templates before sending
5. collect every step 4 report before triage; until every reviewer and validator has finished, only wait and record feedback every 30s
   - then run `cp playground/loops/<loop-name>/{round-head,last-reviewed-head}`
6. run `bin/ai-review-status --wait <pr-number>`, then `gh pr checks <pr-number> --watch > /dev/null; gh pr checks <pr-number>` so the check table prints once
   - proceed to triage when `bin/ai-review-status` exits 0 and the checks have finished; check failures go to triage
   - if you see signs of AI review quota exhaustion, auth, config, or infra failure, save it under `evidence/`, skip only the github AI review gate and proceed to triage, retain all existing review feedback
   - use the `/triaging-feedback` skill to triage from 2 sources: the `handoffs/` files and unresolved PR comments (run `bin/unresolved-pr-comments <pr-number>`). skip comments that go beyond the `contract.md` scope. factor in the price of a new loop round; sometimes good enough beats perfect
   - deduplicate skips by proposed change, append new sources to existing entries, and remove entries made obsolete by design changes
   - use the command from the `/fix-ci-failures` skill to fetch CI failures
   - update `validation-state.json` from the validator report
   - apply useful `validation_updates` from the validator report to `validation.md`
   - record skipped comments in `skipped-review-comments.md`
   - write `handoffs/r<n>-triage.md` per `<triage-report>`
   - done when every handoff finding, validator failure, PR comment and CI failure is in `r<n>-triage.md` as queued, skipped or a waiver
7. adress feedback that passed triaging and failed validations. address CI failures. commit, push
   - turn `## queued` in `handoffs/r<n>-triage.md` into `## fixed <sha>`, 1 heading per commit
   - mark addressed github comments as resolved: `bin/resolve-pr-comments --confirm <pr-number>`
   - done when every queued item from step 6 is addressed; then go to step 4 (next round)
   - if step 6 hasn't identified anything to address, go to step 8
8. mark all github comments as resolved, update the PR description/title if needed. the loop is finished

- if merge conflicts appear, resolve
- stacked PR: before steps 3, 4 and 8, check whether the parent PR has merged. if so, this PR must target `develop` with only its own changes. once a round was reviewed, compare those changes with the last reviewed ones (e.g. `git range-diff`): equivalent goes to step 8 once CI passes on the new head, a real difference such as a conflict resolution runs another round. the repo squash-merges and deletes merged branches, so the parent's commits stay in the child until you drop them (`pull/<parent-number>/head` keeps the parent's final head). github may already have rebased or retargeted the child, so start from the freshly fetched PR branch and force-push only with a lease from that fetch
- CI failures evidenced as unrelated to the PR are waivers: record them, continue the loop, and exclude them from the 3-round stop condition
- if 3 rounds expose symptoms of the same in-scope problem or a fix expands the contract, stop and propose 2-3 ways forward
- if the user supplied a max round count (i.e. '/loop --max-rounds 8', '/loop r8'), add it to `contract.md` stop conditions as a cap, not a target. if you've reached it, only execute the next round (in this example, it will be round 9) until step 6 and report the status (feedback that passed triaging, failed validations, CI failures, etc.) so that the user can decide what to address and how to resume
- if the user invoked this skill when the work is already completed or mentioned something like '/loop on this code', skip step 2
- if a github ai code review provider has timed out or failed for this PR, remember the waiver and don't wait for that provider again in later rounds unless it recovers
- if the PR is already opened, skip step 3
- don't add PR comments
- don't routinely describe what each round did

</what-to-do>

<loop-dir>

everything lives in `playground/loops/<loop-name>/`:

- `contract.md` - the contract (step 1)
- `validation.md` - manual validation assertions with stable ids (step 1)
- `validation-state.json` - assertion state, rules in `<validation-state>`
- `round-head` - exact commit under review in the current round
- `last-reviewed-head` - exact commit reviewed in the previous round
- `skipped-review-comments.md` - only deduplicated skipped findings:
  - `## <plain title>`
  - `comment`: proposed change and why
  - `reason`: reason
  - `source`: handoff or PR comment link(s)
- `handoffs/` - 1 report per spawned agent per round: `r<n>-<slug>.md` for reviewers, `r<n>-validator.json` for the validator, `r<n>-codex-native/review-*/review.md` for codex native review, and `r<n>-triage.md` for your dispositions per `<triage-report>`
- `evidence/` - screenshots, response dumps, output snippets referenced from reports

update verified environment facts, validation details and evidence at any time; only the user may change goals, non-goals, accepted tradeoffs or hard boundaries

`playground/` is gitignored

</loop-dir>

<triage-report>

- `handoffs/r<n>-triage.md` records your disposition of every finding in the round: handoff findings, validator failures, PR comments and CI failures; reasons for skips stay in `skipped-review-comments.md`
- step 6 writes it with queued items under `## queued`; step 7 turns that into 1 `## fixed <sha>` heading per commit
- a round with nothing to queue still gets the file, stating `no findings queued`

sample:

```md
# r2 — <round sha> — orchestrator: claude|codex

## fixed <sha>
- r2-thermo stale cache key after the rename
- r2-validator VAL-03 empty name accepted
- PR comment <id> missing nil guard

## skipped
- r2-thermo, r2-ponytail extract a shared helper

## waivers
- CI chromium timeout in storybook, unrelated — evidence/ci-r2.txt
```

</triage-report>

<validation-state>

`validation-state.json` is a flat map:

```json
{
  "VAL-01": {
    "status": "passed|failed",
    "commit": "<latest SHA this evidence remains valid through, or null>",
    "evidence": "<1 sentence with optional evidence/ path>"
  }
}
```

- you (the orchestrator) are its only writer; the validator only reports
- init with every id failed
- map validator `pass` at unchanged committed `HEAD` to passed with that `commit`; map `fail` or `blocked` to failed
- before each validator run and completion, a passed id stays passed unless the diff since its `commit` touches the code its steps exercise or its assertion in `validation.md` was materially edited; re-fail on a real touch, not a possible one, otherwise advance `commit` to `HEAD`
- test, comment, formatting and other similar changes never invalidate a passed id

</validation-state>

<reviewer-prompt-suffix>

loop dir: `playground/loops/<loop-name>/`; read `contract.md` and `skipped-review-comments.md` if it exists. match skips by proposed change, not wording; report only novel findings

<review-mode-instructions>

review against the goals, non-goals, preserved behaviour and reuse decisions in `contract.md`. keep findings and remedies within that contract

trace each new state store, data/table layer, helper and abstraction to a goal and a concrete responsibility the existing implementation cannot carry. flag unrelated additions or loss of preserved behaviour with evidence and the smallest complete remedy. a smaller diff is useful only when it still satisfies the contract

return your report as the final response with sections (the coordinator or launcher persists it to `playground/loops/<loop-name>/handoffs/r<n>-<slug>.md`):

- findings (`file:line`, description, evidence, smallest remedy)
- contract gaps (optional: undocumented quirks you hit)

you may run read-only commands (grep, file reads, git, etc.), but:

- don't run tests and static code checks (it's covered separately)
- don't launch servers/browsers
- don't modify the repo or any DB

</reviewer-prompt-suffix>

<validator-task>

give the validator the loop dir path

the validator:

- reads `contract.md`, `validation.md`, `validation-state.json`
- starts and stops its own server
- tests only failed assertions through the real surface (agent-browser, rails console, curl, read-only reads)
- may create/edit files under `playground/`
- saves evidence to `evidence/`
- writes `handoffs/r<n>-validator.json`:

```json
{
  "assertions": [
    {
      "id": "VAL-01",
      "status": "pass|fail|blocked",
      "steps": [{ "action": "...", "expected": "...", "observed": "..." }],
      "evidence": "...",
      "issues": "..."
    }
  ],
  "validation_updates": [
    "text to add to `validation.md` so that later rounds can reuse discovered/created scripts/smokes under `playground/`, repeatable steps, test data, etc."
  ],
  "blockers": [],
  "summary": "..."
}
```

it's the only sub-agent allowed to edit local dev DB data; its hard boundary: side effects in local dev only - no prod/staging writes, no mutating third-party calls, no emails, etc.

</validator-task>

<result>

the result of your work must be a ready-to-merge, prod-ready PR with:

- no accepted review findings left unaddressed
- green CI except evidenced unrelated failures recorded as waivers
- every id in `validation-state.json` passed at the final commit
- a final evidence summary assembled from `validation-state.json` and `handoffs/` that proves the contract was satisfied

</result>
