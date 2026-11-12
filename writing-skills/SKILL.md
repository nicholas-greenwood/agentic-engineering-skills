---
name: writing-skills
description: use when touching skill
---

- avoid coupling between skills where it makes them harder to maintain. when needed, use `/skill-name`; for a `disable-model-invocation: true` skill, give its path, `.agents/skills/<skill-name>/SKILL.md`, and tell the caller to read and follow it. example:
```md
read and follow `.agents/skills/loop/SKILL.md` to deliver the PR
```
- point to another skill, or to any repo file outside the skill's own folder, with its repo-root path in backticks, such as `.agents/skills/<skill-name>/SKILL.md` or `bin/railway`: no markdown link, no `./` or `/` prefix. agents resolve paths from the repo root, and `../` chains break when a file moves. links within the same skill stay relative
- `disable-model-invocation: true` must be accompanied by `agents/openai.yaml` with `policy: allow_implicit_invocation: false`
