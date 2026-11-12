---
name: propose-refactor
description: propose a refactor plan for an area
argument-hint: "<area>"
disable-model-invocation: true
---

propose how to make an area simpler, more straightforward and robust, and refactor away traces of growing pains. this skill ends at the plan; implementation is a separate request

if no area was given, ask "What area is in scope?" and wait for the answer

the area is the centre of the sweep, not a fence: follow a finding into callers, shared code or contracts when the fix needs it, and say where it crosses the line

when you are sure it is the right thing, contracts, API responses and behaviour are open to change; every point that changes behaviour states the before and after, and the entry points it affects

sub-agents leave this checkout untouched: the mapper writes only `map.md`, the tests lens mutates code only inside `bin/wt-run`, and the others return findings as their final response

every count below is a cap, not a target: a clean area earns a short report

## steps

1. map: spawn 1 sub-agent to write `playground/propose-refactor/<area-slug>/map.md`: the commit SHA, entry points (routes, jobs, pages, and non-web surfaces such as Slack or scheduled runs), contracts the area exposes (API shapes, types, events), callers outside the area, the tests covering each entry point, compatibility branches and feature flags, and hot spots from recent `git log`. done when every entry point and contract is listed with its file and its tests, or "untested"

2. lenses: spawn 5 sub-agents, 1 per lens, in parallel as far as free agent slots allow. each reads the map, then the code, and returns up to the given number of candidates in the [point format](#point-format), with `file:line` evidence for every claim:
   - simplification (6): apply `/ponytail` to the existing code: dead code, compatibility branches, duplication, abstractions, options or layers nobody needs, and cognitive complexity
   - type safety (6)
   - robustness (6): failure modes handled badly or not at all: swallowed errors, races, retries without idempotency, silent data loss, tenant scoping gaps
   - tests (6): judge the area's tests by `/tdd`'s good test and anti-patterns. propose deleting or rewriting tests that mock what they test, pin internals or can't fail, and the seam and fake that let a few behaviour tests pin today's behaviour before the risky points land. spend up to 3 mutation probes on the "can't catch it" claims that decide a deletion, all in 1 `bin/wt-run <map SHA>` worktree, then remove it with `git worktree remove --force <path>`, since `bin/wt-run` keeps it. every deleted test names the assertion that replaces it, or why none is needed
   - architecture (4): read and follow `.agents/skills/improve-codebase-architecture/SKILL.md` through its explore step, exploring directly in place of its nested sub-agent and applying the deletion test as `/codebase-design` words it, and return its candidates in the point format in place of the HTML report and grilling loop. it keeps interface testability and leaves the quality of existing tests to the tests lens

   done when all 5 have returned

3. merge: check each finding's claims against the code. a claim that code is dead or legacy also rules out dynamic, framework and operator reach, and checks prod data read-only when stored data could still reach it. consolidate overlapping findings into 1 point that lists every category it serves, and keep up to 3 points per lens (2 for architecture). then consider 1 bold change of your own drawn from the whole picture, and keep it only when it beats the smaller points it would replace. done when every kept point is verified and every dropped finding has a 1-line reason

4. second opinion: give a `/cross-harness-sub-agent` the map and the merged list, scoped to the area's current code rather than a branch diff, and ask what it would cut, add or rank differently, with `file:line` evidence. done when each piece of pushback is adopted or rejected with a reason checked against the code

5. report: write `report.md` beside the map and show it, with points numbered across both lists and ranked by ROI (payoff for effort), highest first; a point never ranks above a point it depends on:
   - 80/20 plan: the points with the best ROI
   - extended list: the remaining points, for going 1 step further

## point format

- title and the categories it serves
- the change, what it removes, and its payoff
- behaviour: before -> after, or "none"
- depends on: the points that must land first, or "none"
- effort: S, M or L
