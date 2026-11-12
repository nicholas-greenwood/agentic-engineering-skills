# quality assertions

a behavioural assertion asks "does it work?"; a quality assertion asks "is it good for the user?". add one when a working but poor result would hurt: something a person reads, sees or acts on. skip it when nothing user-facing changes

examples:

- AI generation or an agent: are the outputs grounded, useful and on-instruction across a few realistic inputs, and no worse than the base branch?
- UI: does it use shadcn and our components per `/ui-ux`, fit the pages around it and handle empty, loading and error states?
- copy, emails, notifications: does it make sense to the user, in our glossary terms (`GLOSSARY-MAP.md`)?
- numbers, rankings, imports, exports: do the results look right against their source?

write it in step 1 as a `## VAL-xx quality: <title>` heading, before any code, so it judges the request rather than whatever got built:

- what is judged
- inputs: real ones read from prod by default, e.g. for AI generations; say why when you invent them. the first validator run saves them under `evidence/` and later runs reuse them
- a few pass/fail criteria, each with a good and a bad example
- what counts as passing, as a share of judged cases, e.g. at least 4 of 5; only the user may lower that bar
- rough spend per run

only the validator passes it, judging sceptically and quoting the output or screenshot behind each verdict. judge LLM output with a model from a different family than the generator

## budget

LLM and API calls these assertions trigger (feature generations and judge calls) cost at most $1 per round and $3 per loop, unless the user sets otherwise. only the validator spends it: the orchestrator passes what's left as `<quality-budget>`; the validator reports `spend_usd`. when the budget runs out, it still gives a pass or fail from what it could afford: the same criteria and bar over the cases it judged, plus outputs saved in earlier rounds while the code, inputs and rubric that produced them are unchanged. it states in `evidence` that the budget ran out and how confident it is (high, medium or low) and why. the loop carries on, and the final report says the budget ran out and gives that confidence
