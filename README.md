some of the more reusable agent skills from my engineering setup that are not tightly coupled with the repository

<table>
  <thead>
    <tr><th width="260">skill</th><th>what it is</th></tr>
  </thead>
  <tbody>
    <tr>
      <td><a href="loop/SKILL.md"><code>loop</code></a></td>
      <td>the core. hand an agent a task and get back a merge-ready pr. workers implement, independent agents review and validate through the real ui or api, and the orchestrator handles feedback, ci and evidence</td>
    </tr>
    <tr>
      <td><a href="orchestrate-multi-pr-work/SKILL.md"><code>orchestrate-multi-pr-work</code></a></td>
      <td>1 loop per pr across a multi-pr plan. handles stacked and parallel prs, with progress, blockers and decisions in 1 status file</td>
    </tr>
    <tr>
      <td><a href="cross-harness-sub-agent/SKILL.md"><code>cross-harness-sub-agent</code></a></td>
      <td>hand tasks between codex and claude code</td>
    </tr>
    <tr>
      <td><a href="plan/SKILL.md"><code>plan</code></a></td>
      <td>turn a task into a plan with vertical prs and dependency graph</td>
    </tr>
    <tr>
      <td><a href="pr/SKILL.md"><code>pr</code></a></td>
      <td>short pr descriptions that explain the change, merge risks and verification evidence</td>
    </tr>
    <tr>
      <td><a href="agent-browser-diff/SKILL.md"><code>agent-browser-diff</code></a></td>
      <td>highlight ui differences against a baseline after code changes</td>
    </tr>
    <tr>
      <td><a href="record-video/SKILL.md"><code>record-video</code></a></td>
      <td>record browser videos for pr descriptions, bug repros and walkthroughs. with captions and highlights</td>
    </tr>
    <tr>
      <td><a href="upgrade-dependencies/SKILL.md"><code>upgrade-dependencies</code></a></td>
      <td>upgrade dependencies, 1 pr per group</td>
    </tr>
    <tr>
      <td><a href="propose-refactor/SKILL.md"><code>propose-refactor</code></a></td>
      <td>review an area from 4 angles and rank the refactors worth doing</td>
    </tr>
    <tr>
      <td><a href="llm-evaluation/SKILL.md"><code>llm-evaluation</code></a></td>
      <td>evaluate models, prompts and workflows with frozen inputs and saved evidence</td>
    </tr>
    <tr>
      <td><a href="ai-code-review-catalog/SKILL.md"><code>ai-code-review-catalog</code></a></td>
      <td>pretty self-explanatory</td>
    </tr>
    <tr>
      <td><a href="triaging-feedback/SKILL.md"><code>triaging-feedback</code></a></td>
      <td>which code review comments are worth adressing</td>
    </tr>
    <tr>
      <td><a href="helper-sub-agents/SKILL.md"><code>helper-sub-agents</code></a></td>
      <td>shared rules for helpers used by <code>loop</code> and <code>orchestrate-multi-pr-work</code></td>
    </tr>
    <tr>
      <td><a href="claude-sub-agents/SKILL.md"><code>claude-sub-agents</code></a></td>
      <td>parallel claude code workers, 1 worktree each</td>
    </tr>
  </tbody>
</table>

some referenced commands and skills belong to the original repository and aren't included here

skills i install with [skills.sh](https://www.skills.sh) and use without much editing:

- [Matt Pocock's skills](https://github.com/mattpocock/skills):
  - workflows: [grill-me](https://www.skills.sh/mattpocock/skills/grill-me), [prototype](https://www.skills.sh/mattpocock/skills/prototype), [improve-codebase-architecture](https://www.skills.sh/mattpocock/skills/improve-codebase-architecture), [retro](https://www.skills.sh/mattpocock/skills/retro), [wizard](https://www.skills.sh/mattpocock/skills/wizard)
  - communication: [wait-what](https://www.skills.sh/mattpocock/skills/wait-what)
  - supporting skills: [grilling](https://www.skills.sh/mattpocock/skills/grilling), [codebase-design](https://www.skills.sh/mattpocock/skills/codebase-design), [domain-modeling](https://www.skills.sh/mattpocock/skills/domain-modeling), [tdd](https://www.skills.sh/mattpocock/skills/tdd), [writing-for-agents](https://www.skills.sh/mattpocock/skills/writing-for-agents), [diagnosing-bugs](https://www.skills.sh/mattpocock/skills/diagnosing-bugs)
- other skills: [agent-browser](https://www.skills.sh/vercel-labs/agent-browser/agent-browser), [github-image-upload](https://www.skills.sh/drogers0/gh-image/github-image-upload), [thermo-nuclear-code-quality-review](https://www.skills.sh/cursor/plugins/thermo-nuclear-code-quality-review), [ponytail](https://www.skills.sh/dietrichgebert/ponytail/ponytail)

---

more in my beginner-friendly [ai-driven engineering guide](https://app.notion.com/p/nicholas8/ai-assisted-engineering-guide-3bf10d5dbf7c80bf9006e4549a71d747)
