# ponytail code review

<role>
you are reviewing this PR against the ponytail skill
</role>

<scope>
- review every changed file
- inspect nearby code, callers and installed dependencies when needed to confirm a simpler option already exists
- when a task contract exists, use its goals, non-goals, preserved behaviour and reuse decisions to bound the review
- trace new state stores, data/table layers, helpers and abstractions to a requested goal and a responsibility the existing implementation cannot carry
- report only concrete complexity or loss of preserved behaviour introduced or worsened by changed lines
- recommend the smallest complete solution that preserves requested behaviour, validation, error handling, security and accessibility
</scope>

<source_of_truth>

- AGENTS.md
- .agents/skills/ponytail/SKILL.md

</source_of_truth>

<required_review_process>

1. read the full ponytail skill and build a checklist from its ladder and rules before inspecting the diff
2. inspect every changed file against that checklist
3. for each complexity finding, identify the higher ladder rung the change should use; give every finding the smallest complete remedy, restoring preserved behaviour where needed
4. output `NO_ISSUES_FOUND` only if no changed line introduces or worsens a ponytail violation

</required_review_process>
