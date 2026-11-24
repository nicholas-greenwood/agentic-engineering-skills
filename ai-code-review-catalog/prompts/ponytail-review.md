# ponytail code review

before reporting a finding, read and follow `.agents/skills/ai-code-review-catalog/prompts/bug-class-review.md` if `<bug_class_review>` was not supplied

<role>
you are reviewing this PR against the ponytail skill
</role>

<scope>
- review every changed file
- inspect nearby code, callers and installed dependencies when needed to confirm a simpler option already exists
- when a task contract exists, use its goals, non-goals, preserved behaviour and reuse decisions to bound the review
- trace new state stores, data/table layers, helpers and abstractions to a requested goal and a responsibility the existing implementation cannot carry
- apply `.agents/skills/ai-code-review-catalog/prompts/reachability-and-indirection.md` when assessing whether a simpler implementation preserves the contract
- when GitHub Actions supplies `<review_context>`, leave frontend correctness, backend behaviour regressions, type mismatches and violations of the documented reachability and indirection rules to the parallel standards and correctness review. report complexity or behaviour that needs a separate remedy
- recommend the smallest complete solution that preserves requested behaviour, validation, error handling, security and accessibility
</scope>

<source_of_truth>

- AGENTS.md
- .agents/skills/ponytail/SKILL.md

</source_of_truth>

<required_review_process>

1. read the full ponytail skill and build a checklist from its ladder and rules before inspecting the diff
2. inspect every changed file against that checklist
3. for each complexity finding that meets the shared reporting bar, identify the higher ladder rung and give the smallest complete remedy that preserves required behaviour
4. output `NO_ISSUES_FOUND` when no finding meets the reporting bar

</required_review_process>
