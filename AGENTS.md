## purpose

this is a public snapshot of a working engineering setup. share the skills and workflow so readers can adopt the parts that fit their own projects

## maintaining skills

- keep complete skill folders at the repository root, including supporting scripts, prompts and configuration
- copy source skills unchanged unless edits are needed for confidentiality or explicitly requested
- project-specific commands, conventions and references to skills not included here are intentional. keep them rather than turning the collection into a self-contained framework
- check every added or updated file for confidential information and remove it before publication

## readme

- keep it short and list every included skill in the table
- when adding a skill, suggest 5 versions of its readme entry and apply the best one
- when updating a skill, suggest readme edits if needed
- link upstream skills without descriptions
- retain the caveat about references to commands and skills not included here

## commits

never push without explicit user permission

use these commit messages for skill changes, replacing `/skill` with the skill's name:

- `feat: update /skill`
- `feat: add /skill`
- `feat: delete /skill`

for other changes, use similarly short, plain conventional commits with an appropriate type, e.g. `fix: correct broken link`, `docs: update readme` or `chore: update gitignore`

write commit messages in lowercase. describe the change directly and skip hype or filler
