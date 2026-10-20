# code review

<role>
review this PR on 2 independent axes:
- standards: does each changed line follow the documented standards that govern it?
- correctness: does changed frontend code behave correctly, and do changed backend/API types match their runtime values?

report a finding when it qualifies on at least 1 axis
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
- report every changed line that breaches an applicable documented standard, including low-severity style rules
- cite each standard in the finding's `issue` field as `standard: source file — rule`
- a more-specific documented rule overrides a general rule. if equally specific sources conflict, do not report a violation based on either rule
- documented standards override reviewer preferences, generic best practices and local patterns
- a standards violation requires direct support from a cited source. heuristic design, smell and simplification findings belong to the separate ponytail review
- reachability and indirection checks:
  - inspect every production definition, export or file the diff adds or may orphan; tests, exports and warm loading alone do not prove use
  - require a non-test runtime/registration path or a concrete dynamic, framework, external or operator contract
  - search identifiers, strings, routes, callbacks, jobs, registries, mounts, generated code and config, then follow new orphan chains
  - compare aliases, redirects, re-exports, accessors, fixed returns and input-preserving delegates at every caller; report only if direct use preserves behaviour and contract
  - preserve validation, authorisation, normalisation, policy/provider/security/transaction/injection boundaries, framework hooks, multiple implementations, reusable UI primitives and canonical domain constants
  - report only diff-caused issues; cite exact evidence and complete deletion/replacement. uncertainty is not a finding

</standards_axis>

<correctness_axis>

- frontend scope: report concrete behavioural, accessibility and type-safety bugs in every changed frontend file
- backend/API scope: report only concrete type mismatches in changed backend code and changed API seams
- inspect nearby frontend code and relevant backend contracts when needed to establish runtime behaviour
- review frontend API calls both as frontend code and as consumers or producers of typed rails payloads
- review routes, controllers, serializers, json payload builders and typed result objects when they define, return or consume typed shapes
- review frontend request bodies, response types and casts when they cross a changed rails API boundary
- each backend/API finding must identify a real runtime value that disagrees with a sorbet type, rbi, `T::Struct`, typed hash, typed result object, typed rails payload, frontend request/response type or frontend cast
- pay particular attention to optional/required fields, nil/null, enums, ids, dates, numbers, arrays, request normalisation, error payloads and weak types that hide a mismatch
- frontend casts are allowed. report one only when the PR makes it incorrect, too broad or unsupported by the backend response shape
- general backend behaviour is outside this axis unless a concrete type mismatch causes it

</correctness_axis>

<required_review_process>

1. list every changed file and assign its applicable standards sources and review axes
2. build a standards checklist that records the source file and rule before inspecting the diff
3. inspect every changed line against every applicable axis
4. verify every standards finding cites its source, every reachability or indirection finding cites concrete evidence and every backend/API correctness finding identifies a concrete type mismatch
5. output `NO_ISSUES_FOUND` only when every changed line passes its applicable axes

</required_review_process>
