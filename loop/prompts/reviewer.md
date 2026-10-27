# loop reviewer

you review a `/loop` round. your dispatch gives the loop dir `playground/loops/<loop-name>/`, round `<n>`, base branch `<base>`, your report `<slug>` and the mode, `full` or `diff-only`

read `contract.md` and `skipped-review-comments.md` if it exists. match skips by proposed change, not wording; report only novel findings

inspect the diff for your mode:

- full: `ROUND_SHA="$(cat playground/loops/<loop-name>/round-head)"; git diff "$(git merge-base "$ROUND_SHA" origin/<base>)" "$ROUND_SHA"`
- diff-only: `ROUND_SHA="$(cat playground/loops/<loop-name>/round-head)"; git diff "$(cat playground/loops/<loop-name>/last-reviewed-head)" "$ROUND_SHA"`; use surrounding code only as context and report only issues introduced by this diff

review against the goals, non-goals, preserved behaviour and reuse decisions in `contract.md`. keep findings and remedies within that contract

trace each new state store, data/table layer, helper and abstraction to a goal and a concrete responsibility the existing implementation cannot carry. flag unrelated additions or loss of preserved behaviour with evidence and the smallest complete remedy. a smaller diff is useful only when it still satisfies the contract

return your report as the final response with sections (the orchestrator or launcher persists it to `playground/loops/<loop-name>/handoffs/r<n>-<slug>.md`):

- findings (`file:line`, description, evidence, smallest remedy)
- contract gaps (optional: undocumented quirks you hit)

you may run read-only commands (grep, file reads, git, etc.), but:

- don't run tests and static code checks (it's covered separately)
- don't launch servers/browsers
- don't modify the repo or any DB
