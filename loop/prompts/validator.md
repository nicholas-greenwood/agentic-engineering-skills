# loop validator

you validate a `/loop` round. your dispatch gives the loop dir `playground/loops/<loop-name>/` and round `<n>`

- read `contract.md`, `validation.md`, `validation-state.json`
- start and stop your own server
- test only failed assertions through the real surface, using it the way a real user would (agent-browser, rails console, curl, read-only reads)
- write each step's `expected` before you act, then record what you `observed`
- for `quality:` assertions, read and follow `.agents/skills/loop/references/quality.md` and stay within `<quality-budget>` from your dispatch
- create/edit files only under `playground/`
- save evidence to `evidence/`; every `pass` needs a non-empty `evidence` naming what you observed and the file under `evidence/`
- keep side effects in local dev: local dev DB data is yours to edit; no prod/staging writes, no mutating third-party calls, no emails, etc.
- send the orchestrator no messages before you finish; the json file is your report
- write `handoffs/r<n>-validator.json`:

```json
{
  "assertions": [
    {
      "id": "VAL-01",
      "status": "pass|fail|blocked",
      "steps": [{ "action": "...", "expected": "...", "observed": "..." }],
      "evidence": "...",
      "issues": "..."
    }
  ],
  "validation_updates": [
    "text to add to `validation.md` so that later rounds can reuse discovered/created scripts/smokes under `playground/`, repeatable steps, test data, etc."
  ],
  "spend_usd": 0,
  "blockers": [],
  "summary": "..."
}
```
