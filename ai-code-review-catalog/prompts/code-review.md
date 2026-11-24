# code review

before reporting a finding, read and follow `.agents/skills/ai-code-review-catalog/prompts/bug-class-review.md` if `<bug_class_review>` was not supplied

<role>
review this PR on 2 independent axes:
- standards: does each changed line follow the documented standards that govern it?
- correctness: does changed frontend code behave correctly, do changed backend/API types match their runtime values, and does changed backend behaviour hold?

report a finding when it qualifies on at least 1 axis and meets the shared reporting bar
</role>

<source_of_truth>

- `AGENTS.md`
- `.agents/skills/frontend/SKILL.md`
- `.agents/skills/backend/SKILL.md`
- `docs/code-style.md`

</source_of_truth>

<standards_axis>

- apply this axis to every changed file
- treat the applicable `<source_of_truth>` as authoritative
- report documented standards violations that meet the shared reporting bar
- cite each standard in the finding's `issue` field as `standard: source file - rule`
- a more-specific documented rule overrides a general rule. if equally specific sources conflict, do not report a violation based on either rule
- documented standards override reviewer preferences, generic best practices and local patterns
- a standards violation requires direct support from a cited source. heuristic design, smell and simplification findings belong to the separate ponytail review
- apply the checks in `.agents/skills/ai-code-review-catalog/prompts/reachability-and-indirection.md`

</standards_axis>

<correctness_axis>

- frontend scope: report concrete behavioural, accessibility and type-safety bugs in every changed frontend file
- backend/API scope: report concrete type mismatches in changed backend code and changed API seams, and backend behaviour regressions, including API status codes, error handling and side effects even when payload types stay correct
- inspect nearby frontend code and relevant backend contracts when needed to establish runtime behaviour
- review frontend API calls both as frontend code and as consumers or producers of typed rails payloads
- review routes, controllers, serializers, json payload builders and typed result objects when they define, return or consume typed shapes
- review frontend request bodies, response types and casts when they cross a changed rails API boundary
- each backend/API type finding must identify a real runtime value that disagrees with a sorbet type, rbi, `T::Struct`, typed hash, typed result object, typed rails payload, frontend request/response type or frontend cast
- pay particular attention to optional/required fields, nil/null, enums, ids, dates, numbers, arrays, request normalisation, error payloads and weak types that hide a mismatch
- frontend casts are allowed. report one only when the PR makes it incorrect, too broad or unsupported by the backend response shape

</correctness_axis>

<required_review_process>

1. list every changed file and assign its applicable standards sources and review axes
2. build a standards checklist that records the source file and rule before inspecting the diff
3. inspect every changed line against every applicable axis
4. verify every finding meets the shared reporting bar, every standards finding cites its source and every backend/API type finding identifies a concrete type mismatch
5. output `NO_ISSUES_FOUND` when neither axis produces a finding that meets the reporting bar

</required_review_process>
