some of the more reusable agent skills from my engineering setup that are not tightly coupled with the repository

| skill | what it is |
| --- | --- |
| `loop` | the core. hand an agent a task and get back a merge-ready pr. it writes down what done means, implements, then runs rounds of independent review and validation in the real ui or api, fixing or skipping every finding until it's clean and ci passes |
| `orchestrate-multi-pr-work` | 1 `loop` per pr across a multi-pr plan. handles stacked and parallel prs |
| `cross-harness-sub-agent` | hand tasks between codex and claude code |
| `plan` | nice plans |
| `pr` | nice pr descriptions |
| `ai-code-review-catalog` | pretty self-explanatory |
| `triaging-feedback` | which ai code review comments are worth adressing |
| `claude-sub-agents` | parallel claude code workers, 1 worktree each |

some referenced commands and skills belong to the original repository and aren't included here

skills i install with [skills.sh](https://www.skills.sh) and use without much editing:

- [Matt Pocock's skills](https://github.com/mattpocock/skills):
  - workflows: [grill-me](https://www.skills.sh/mattpocock/skills/grill-me), [prototype](https://www.skills.sh/mattpocock/skills/prototype), [improve-codebase-architecture](https://www.skills.sh/mattpocock/skills/improve-codebase-architecture), [retro](https://www.skills.sh/mattpocock/skills/retro), [wizard](https://www.skills.sh/mattpocock/skills/wizard)
  - communication: [wait-what](https://www.skills.sh/mattpocock/skills/wait-what)
  - supporting skills: [grilling](https://www.skills.sh/mattpocock/skills/grilling), [codebase-design](https://www.skills.sh/mattpocock/skills/codebase-design), [domain-modeling](https://www.skills.sh/mattpocock/skills/domain-modeling), [tdd](https://www.skills.sh/mattpocock/skills/tdd), [writing-for-agents](https://www.skills.sh/mattpocock/skills/writing-for-agents), [diagnosing-bugs](https://www.skills.sh/mattpocock/skills/diagnosing-bugs)
- other skills: [agent-browser](https://www.skills.sh/vercel-labs/agent-browser/agent-browser), [github-image-upload](https://www.skills.sh/drogers0/gh-image/github-image-upload), [thermo-nuclear-code-quality-review](https://www.skills.sh/cursor/plugins/thermo-nuclear-code-quality-review), [ponytail](https://www.skills.sh/dietrichgebert/ponytail/ponytail)

---

more in my beginner-friendly [ai-driven engineering guide](https://app.notion.com/p/nicholas8/ai-assisted-engineering-guide-3bf10d5dbf7c80bf9006e4549a71d747)
