# dependency upgrade worker

own only the list in the dispatch prompt and your own branch and PR. another task owns every other direct dependency; never rebase, force-push, restack, or change the base of another task's branch, and never open a stacked PR

the dispatch prompt names the mode and the branch file (`npm.md`, `gem.md`, or `mise.md`); read its `checks` and `worker` sections

## upgrade policy

- run `bash bin/ensure-environment` once before making changes
- read and follow [/loop](../loop/SKILL.md) and the skills the branch file names
- move to the dispatched version and not past it, even when the package manager offers more; try the group as a batch before isolating failures and keep coupled packages together
- when the target is blocked, step down to the newest release in the current major, then in the current minor, then the newest the existing constraint allows
- apply the branch file's manifest policy to every accepted target
- accept small package-local compatibility changes that preserve product behaviour
- scope ceiling beyond lockfile, generated files, package-local compat changes, and the runtime group's version declarations/configuration/fixtures: a system package the new version needs at boot, installed in the existing CI, deploy, and bootstrap seams; a 1-line compat setting that preserves current behaviour, named in the PR and the result. new scripts, new tests for bootstrap code, and docs are follow-up work, reported not done
- block upgrades needing a product choice, broad redesign, data or infrastructure migration, unsupported runtime or framework, unavailable upstream fix, or more than the scope ceiling
- lockfile conflict on rebase: take `develop`'s lockfile, rerun the branch file's lockfile recipe for your packages, never hand-merge lockfile hunks; then diff-only review, not a new full round

remove blocked versions and their exclusive lockfile and generated changes before opening the PR. return no PR when the group produces no accepted diff

## major mode

1 dependency with its coupled family, 1 task, 1 loop, 1 PR

research before touching the lockfile:

- read the changelog, upgrade guide, and release notes for every major between current and target
- list every breaking change and removed or renamed API, then run `git grep` for each across every tracked file, including `script/`, `bin/`, and `db/`; record hit counts
- check runtime and framework support, and which other dependencies constrain the target (command in the branch file). a pin owned by another dependency blocks the upgrade; report the pinning dependency and stop
- write the findings into the loop's `contract.md`: goals, risky paths, and each breaking change mapped to repository hits. a behaviour change that needs a product choice blocks the task; report it with its context before any code changes

then:

- step through intermediate majors only when the upstream upgrade guide requires it, and commit each intermediate step once green
- fix deprecations on the current major first when the new major turns them into errors, then bump
- apply the branch file's manifest policy to the new major; a comment that pins for a bug means the bug must be confirmed fixed before moving
- adapt call sites with the smallest change that preserves product behaviour; the scope ceiling grows by the call sites the breaking-change map explains and by named compat settings; redesigns are follow-up work
- exercise the runtime surfaces the dependency touches through the loop's `validation.md` assertions (headless browser, curl, `bin/rails runner`, local DB); a major upgrade never ships on unit tests alone
- the PR's risk section names every behaviour change the new major introduces, verified or not
- read and follow [/loop](../loop/SKILL.md) in full for review rounds since call sites change; a rebase after `develop` moves gets a diff-only review, never a new full round

## evidence

- use changelogs, release notes, upgrade guides, source, and registry metadata. use browser automation only as a last resort
- compare unclear failures, warnings, and deprecations with an unchanged baseline and exclude pre-existing issues
- run the branch file's checks and verify install warnings, runtime and framework version support, security advisories, and the runtime surfaces the dependency touches
- security advisories also present on `origin/develop`'s lockfile are baseline: report them once, do not fix them
- for the `code-quality` (npm) and `tooling` (gem) groups, report new useful rules and checks: for every new lint rule or cop, include its repository hit count, value, simple explanation, and separate bad and good examples. report all new warnings and errors these tools emit. probe opt-in rules under `playground/`; counting a rule does not enable it
- review budget outside major mode: 1 full [/loop](../loop/SKILL.md) round for a lockfile-only diff. a further round only when a reviewer finds a defect in the shipped diff; bookkeeping, evidence, or `playground/` feedback closes the round instead

## environment

- in a sandbox, package installs, tests, `rails runner`, tool caches, git, and gh need network, postgres, or paths outside the worktree; run them escalated instead of retrying inside

## result

return the PR, accepted upgrades, blocked upgrades with cause, evidence, workaround, required work, and retry condition, every non-lockfile change with its reason, every compat setting added, and verification evidence; a major PR adds the version path, transitive dependencies that moved, call sites changed, and every behaviour change the new major introduces

also list new super high value things that we can use in this codebase as a result of this upgrade. cream of the crop. it is okay if there are no such things
