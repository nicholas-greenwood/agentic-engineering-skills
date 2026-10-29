# mise branch

## inventory

- inspect project `.mise.toml` tools, excluding node (`npm`) and ruby (`gem`)
- for each tool, query `mise latest <backend:tool>@<current-major>` for the default target and `mise latest <backend:tool>` for the newest stable release; compare both with the exact pin before applying the selected mode

## groups

1 `tools` group for non-major updates; major grouping follows the main skill

## checks

- install targets with mise, verify binary versions, and compare the repo's actual commands/configuration against the old versions
- gitleaks: staged synthetic secrets fail with redacted output; clean staged content passes
- typos: misspelled fixtures fail and clean fixtures pass using `typos.toml`

## worker

- manifest policy: retain backend identifiers and exact version pins
