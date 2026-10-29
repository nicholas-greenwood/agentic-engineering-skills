# npm branch

## inventory

- inspect project-owned manifests, `pnpm-lock.yaml`, and `packageManager`
- include the node runtime from `.mise.toml`; resolve the newest stable node release within the skill's runtime ceiling through mise, even when the current runtime pin or engine constraint is exact
- `pnpm outdated` gives current and latest; a `wanted` field is never a target. for the desired non-major version take the newest stable release in the current major from `pnpm view <package> versions --json`
- `xlsx` is vendored from https://cdn.sheetjs.com, so its latest lives there, not on the registry
- manifest policy: pin every registry-managed direct dependency to its exact installed version, including targets already allowed by the previous range

## groups

up to 4:

- `runtime`: node, `@types/node`, and pnpm from `packageManager`
- `ai-sdk`: `ai`, `@ai-sdk/*`, and coupled provider or adapter packages
- `code-quality`: linting, formatting, typechecking, dead-code, duplicate-detection, and code-health packages
- `everything-else`: every remaining candidate

coupled family: a package and its plugins, adapters, or `@scope/*` siblings released in lockstep

## checks

frozen install and the standard checks

for `runtime`, run the frontend checks and build under the target node version; verify native package installation and the CI runtime selection

## worker

- skills: `/frontend`, `$ai-sdk` for `ai-sdk`, and `/tdd` when call sites change
- lockfile recipe: bump the manifest, then `pnpm install`; list every transitive package that moved
- verify peer dependencies, engines, and types on install
- `runtime`: synchronise the node pin in `.mise.toml`, `package.json` engines, and CI/deploy runtime references; update `@types/node` within the node ceiling and pnpm only when dispatched. preserve exact pins after upgrading and review runtime release notes before changing them
- major mode, which packages constrain the target: `pnpm why <package>` and the peer ranges of its dependants
- `ai-sdk`: manually validate the ruby compatibility layer and stream protocol
