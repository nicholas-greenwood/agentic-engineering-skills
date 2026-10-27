#!/usr/bin/env node
import { execFileSync, spawnSync } from 'node:child_process'
import { existsSync, lstatSync, readdirSync, readFileSync, statSync } from 'node:fs'
import path from 'node:path'

export const checkNames = ['docs', 'editing', 'round-start', 'reports', 'triage', 'fixed', 'done'] as const
export type CheckName = (typeof checkNames)[number]

export type Context = {
  repo: string
  loopDir: string
  round: number
  base: string
  unresolvedPrComments: () => { output: string } | { reason: string }
  prHead: () => { oid: string } | { reason: string }
}

type Failures = string[]

export const contractSections = [
  'goals',
  'non-goals',
  'behaviour to preserve',
  'things to reuse for sure',
  'non-functional requirements',
  'accepted tradeoffs',
  'risky paths',
  'hard boundaries',
  'environment notes',
  'stop conditions',
  'editing',
]

export const inlineProdLineLimit = 10

const sha = /\b[0-9a-f]{7,40}\b/u
const readOnlyGit = { ...process.env, GIT_OPTIONAL_LOCKS: '0' }

export function isProdPath(file: string) {
  if (file === 'config.ru') return true
  if (!/^(app|lib|config|db\/migrate|db\/seeds)\//u.test(file)) return false
  if (/^(config\/client|lib\/smoke_tests|app\/javascript\/generated)\//u.test(file)) return false
  if (/(^|\/)(test|tests|spec|__tests__|__mocks__|__fixtures__|fixtures)\//u.test(file)) return false
  if (/^app\/prompts\/.*\.md$/u.test(file)) return true
  return !/\.(test|spec|stories|fixtures)\.[cm]?[jt]sx?$|\.md$/u.test(file)
}

function isEditingLabel(label: string) {
  return label === 'editing' || label.startsWith('editing:')
}

function labelOf(line: string) {
  return line
    .replace(/^[\s#*>-]+/u, '')
    .replaceAll('*', '')
    .trim()
    .toLowerCase()
}

export function editingMode(contract: string) {
  const lines = contract.split('\n')
  const heading = lines.findIndex((line) => /^#{1,6}\s/u.test(line) && isEditingLabel(labelOf(line)))
  const index = heading === -1 ? lines.findIndex((line) => isEditingLabel(labelOf(line))) : heading
  if (index === -1) return
  const sameLine = labelOf(lines[index] ?? '').slice('editing'.length)
  const nextLine = lines.slice(index + 1).find((line) => line.trim() !== '') ?? ''
  const mode = (/\b(inline|worker)\b/u.exec(sameLine) ?? /\b(inline|worker)\b/u.exec(nextLine.toLowerCase()))?.[1]
  return mode === 'inline' || mode === 'worker' ? mode : undefined
}

export function countChangedLines(numstat: string) {
  const fields = numstat.split('\0')
  let total = 0
  for (let index = 0; index < fields.length; index += 1) {
    const [added = '', deleted = '0', file = ''] = (fields[index] ?? '').split('\t')
    if (added === '') continue
    const files = file === '' ? [fields[index + 1] ?? '', fields[index + 2] ?? ''] : [file]
    if (file === '') index += 2
    if (!files.some(isProdPath)) continue
    total += added === '-' ? 1 : Math.max(Number(added), Number(deleted))
  }
  return total
}

function git(ctx: Context, ...args: string[]) {
  return execFileSync('git', args, { cwd: ctx.repo, env: readOnlyGit, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim()
}

function tryGit(ctx: Context, ...args: string[]) {
  const result = spawnSync('git', args, { cwd: ctx.repo, env: readOnlyGit, encoding: 'utf8' })
  return result.status === 0 ? result.stdout.trim() : undefined
}

function commitOf(ctx: Context, ref: string) {
  return tryGit(ctx, 'rev-parse', '--verify', '--quiet', `${ref}^{commit}`)
}

function isAncestor(ctx: Context, ancestor: string, descendant: string) {
  return spawnSync('git', ['merge-base', '--is-ancestor', ancestor, descendant], { cwd: ctx.repo, env: readOnlyGit }).status === 0
}

function loopFile(ctx: Context, ...parts: string[]) {
  return path.join(ctx.loopDir, ...parts)
}

function pinnedHead(loopDir: string, name: 'round-head' | 'last-reviewed-head') {
  const file = path.join(loopDir, name)
  const head = existsSync(file) ? readFileSync(file, 'utf8').trim() : ''
  return head === '' ? undefined : head
}

function readLoopFile(ctx: Context, failures: Failures, ...parts: string[]) {
  const file = loopFile(ctx, ...parts)
  if (!existsSync(file)) {
    failures.push(`missing ${path.relative(ctx.loopDir, file)}`)
    return
  }
  const text = readFileSync(file, 'utf8')
  if (text.trim() === '') failures.push(`empty ${path.relative(ctx.loopDir, file)}`)
  return text
}

function readJson(ctx: Context, failures: Failures, ...parts: string[]): unknown {
  const text = readLoopFile(ctx, failures, ...parts)
  if (text === undefined || text.trim() === '') return
  let parsed: unknown
  try {
    parsed = JSON.parse(text)
  } catch {
    failures.push(`invalid JSON in ${parts.join('/')}`)
  }
  return parsed
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function validationState(ctx: Context, failures: Failures) {
  const state = readJson(ctx, failures, 'validation-state.json')
  if (state === undefined) return
  if (!isRecord(state)) {
    failures.push('validation-state.json must be a flat map of assertion ids')
    return
  }
  const entries = Object.entries(state)
  const valid = entries.filter((entry): entry is [string, Record<string, unknown>] => isRecord(entry[1]))
  if (valid.length < entries.length) {
    const invalid = entries.filter(([, entry]) => !isRecord(entry)).map(([id]) => id)
    failures.push(`validation-state.json ${invalid.join(', ')} must be an object`)
    return
  }
  return Object.fromEntries(valid)
}

function assertionIds(ctx: Context, failures: Failures) {
  const validation = readLoopFile(ctx, failures, 'validation.md')
  const ids = [...(validation ?? '').matchAll(/^##\s+(VAL-\d+)\b/gmu)].map((match) => match[1] ?? '')
  if (validation !== undefined && ids.length === 0) failures.push('validation.md defines no `## VAL-xx` headings')
  return ids
}

function assertionState(ctx: Context, failures: Failures) {
  const ids = assertionIds(ctx, failures)
  const state = validationState(ctx, failures)
  if (state !== undefined) {
    const stateIds = Object.keys(state)
    const missing = ids.filter((id) => !stateIds.includes(id))
    const extra = stateIds.filter((id) => !ids.includes(id))
    if (missing.length > 0) failures.push(`validation-state.json is missing ${missing.join(', ')}`)
    if (extra.length > 0) failures.push(`validation-state.json has ids not in validation.md: ${extra.join(', ')}`)
  }
  return { ids, state }
}

function validatorAssertions(ctx: Context, failures: Failures) {
  const name = `r${ctx.round}-validator.json`
  const report = readJson(ctx, failures, 'handoffs', name)
  if (report === undefined) return
  if (!isRecord(report) || !Array.isArray(report.assertions)) {
    failures.push(`${name} has no assertions array`)
    return
  }
  if (!report.assertions.every(isRecord)) {
    failures.push(`${name} assertions must be objects`)
    return
  }
  return report.assertions
}

function statesNoneQueued(triage: string) {
  return triage.split('\n').some((line) => /^(?:[>*-]\s*)?[*_`]*no findings queued\b/iu.test(line.trim()))
}

function requireRound(ctx: Context, failures: Failures, name: CheckName) {
  if (ctx.round > 0) return true
  failures.push(`${name} runs from round 1; pass --round <n>`)
  return false
}

function requireCleanAndPushed(ctx: Context, failures: Failures, notes: string[] = []) {
  const dirty = git(ctx, 'status', '--porcelain').split('\n').filter(Boolean)
  if (dirty.length > 0) failures.push(`worktree not clean: ${dirty.slice(0, 5).join(', ')}`)
  if (tryGit(ctx, 'symbolic-ref', '-q', 'HEAD') === undefined) {
    failures.push('HEAD is detached; check out the PR branch')
    return
  }
  const baseRef = tryGit(ctx, 'rev-parse', '--symbolic-full-name', ctx.base)
  const pushedTo = git(ctx, 'for-each-ref', '--points-at', 'HEAD', '--format=%(refname)', 'refs/remotes')
    .split('\n')
    .filter((ref) => ref !== '' && ref !== baseRef && !ref.endsWith('/HEAD'))
  if (pushedTo.length > 0) {
    notes.push(`HEAD is on ${pushedTo.map((ref) => ref.replace(/^refs\/remotes\//u, '')).join(', ')}`)
    return
  }
  const fetchHint = (tryGit(ctx, 'config', '--get-all', 'remote.origin.fetch') ?? '').includes('refs/heads/*')
    ? ''
    : ". this clone fetches no branches: first run `git config --add remote.origin.fetch '+refs/heads/*:refs/remotes/origin/*'`"
  failures.push(
    `HEAD is not on any remote branch other than ${ctx.base}; push it to the PR head branch (\`gh pr view --json headRefName\`): \`git push origin HEAD:<branch>\`, with \`--force-with-lease\` after your own rebase; if github moved that branch, fetch it and start from it instead${fetchHint}`,
  )
}

function checkDocs(ctx: Context, failures: Failures) {
  const requestFile = loopFile(ctx, 'request.md')
  const request = existsSync(requestFile) ? readLoopFile(ctx, failures, 'request.md') : undefined
  if (request === undefined) failures.push("missing request.md; copy the user's request into it and run `chmod a-w` on it")
  const mode = request === undefined ? 0 : statSync(requestFile).mode
  if ([0o200, 0o020, 0o002].some((bit) => Math.floor(mode / bit) % 2 === 1)) {
    failures.push('request.md is writable; run `chmod a-w` on it')
  }
  const contract = readLoopFile(ctx, failures, 'contract.md')
  if (contract !== undefined) {
    const labels = contract.split('\n').map(labelOf)
    for (const section of contractSections) {
      if (!labels.some((label) => label === section || label.startsWith(`${section}:`))) {
        failures.push(
          section === 'editing'
            ? 'contract.md is missing section "editing" (`inline` or `worker`)'
            : `contract.md is missing section "${section}" (mark it n/a if unused)`,
        )
      }
    }
    if (labels.some(isEditingLabel) && editingMode(contract) === undefined) {
      failures.push('contract.md editing must be `inline` or `worker`')
    }
  }

  const { ids, state } = assertionState(ctx, failures)
  if (ids.length > 20) failures.push(`validation.md has ${ids.length} assertions; keep 1-20`)
  const duplicates = ids.filter((id, index) => ids.indexOf(id) !== index)
  if (duplicates.length > 0) failures.push(`duplicate assertion ids: ${[...new Set(duplicates)].join(', ')}`)

  for (const [id, entry] of Object.entries(state ?? {})) {
    if (entry.status !== 'passed' && entry.status !== 'failed') failures.push(`${id} status must be passed or failed`)
    if (entry.status === 'passed' && !(typeof entry.commit === 'string' && sha.test(entry.commit))) {
      failures.push(`${id} is passed without a commit`)
    }
  }
}

function untrackedLines(file: string) {
  if (!lstatSync(file).isFile()) return 1
  const bytes = readFileSync(file)
  if (bytes.includes(0)) return 1
  const newlines = bytes.reduce((count, byte) => (byte === 0x0a ? count + 1 : count), 0)
  return newlines + (bytes.length > 0 && bytes.at(-1) !== 0x0a ? 1 : 0)
}

export function prodLinesChanged(ctx: Context) {
  const mergeBase = tryGit(ctx, 'merge-base', ctx.base, 'HEAD')
  if (mergeBase === undefined) return
  const tracked = countChangedLines(git(ctx, 'diff', '--numstat', '-z', mergeBase))
  const untracked = git(ctx, 'ls-files', '-z', '--others', '--exclude-standard')
    .split('\0')
    .filter((file) => file !== '' && isProdPath(file))
    .reduce((total, file) => total + untrackedLines(path.join(ctx.repo, file)), 0)
  return tracked + untracked
}

function checkEditing(ctx: Context, failures: Failures, notes: string[]) {
  const contract = readLoopFile(ctx, failures, 'contract.md')
  if (contract === undefined) return
  const mode = editingMode(contract)
  if (mode === undefined) {
    failures.push('contract.md editing must be `inline` or `worker`')
    return
  }
  if (commitOf(ctx, ctx.base) === undefined) {
    failures.push(`base ${ctx.base} not found; pass --base origin/<base>`)
    return
  }
  const lines = prodLinesChanged(ctx)
  if (lines === undefined) {
    failures.push(`no merge base between HEAD and ${ctx.base}; run \`git fetch --unshallow\` or fetch the base`)
    return
  }
  notes.push(`editing ${mode}; ${lines} prod lines changed vs ${ctx.base}`)
  if (mode === 'inline' && lines >= inlineProdLineLimit) {
    failures.push(`inline loop changed ${lines} prod lines (limit < ${inlineProdLineLimit}); switch editing to worker`)
  }
  if (ctx.round > 0) return
  const firstReport = readLoopFile(ctx, failures, 'handoffs', 'r0-worker.md')
  if (firstReport !== undefined) checkWorkerReport(ctx, failures, 0, firstReport)
}

function checkRoundStart(ctx: Context, failures: Failures, notes: string[]) {
  requireCleanAndPushed(ctx, failures, notes)
  const roundHead = pinnedHead(ctx.loopDir, 'round-head')
  if (roundHead === undefined) failures.push('missing round-head; pin the round')
  else if (commitOf(ctx, roundHead) !== commitOf(ctx, 'HEAD')) failures.push('round-head is not HEAD; re-pin the round')
}

function checkReports(ctx: Context, failures: Failures) {
  if (!requireRound(ctx, failures, 'reports')) return
  const handoffs = loopFile(ctx, 'handoffs')
  const entries = existsSync(handoffs) ? readdirSync(handoffs) : []
  const reviewers = entries.filter(
    (name) => name.startsWith(`r${ctx.round}-`) && name.endsWith('.md') && !/-(worker|worker-progress|triage)\.md$/u.test(name),
  )
  if (reviewers.length === 0) failures.push(`no reviewer report r${ctx.round}-<slug>.md`)
  for (const name of reviewers) readLoopFile(ctx, failures, 'handoffs', name)

  const native = `r${ctx.round}-codex-native`
  const nativeDir = path.join(handoffs, native)
  const nativeReports = existsSync(nativeDir)
    ? [
        ...readdirSync(nativeDir)
          .filter((name) => name.startsWith('review-'))
          .map((name) => path.join(nativeDir, name, 'review.md')),
        path.join(nativeDir, 'waiver.md'),
      ].filter((file) => existsSync(file) && readFileSync(file, 'utf8').trim() !== '')
    : []
  if (nativeReports.length === 0) failures.push(`no non-empty ${native}/review-*/review.md or ${native}/waiver.md`)

  const assertions = validatorAssertions(ctx, failures)
  if (assertions === undefined) return
  for (const assertion of assertions) {
    if (!['pass', 'fail', 'blocked'].includes(String(assertion.status))) {
      failures.push(`validator assertion ${String(assertion.id)} status must be pass, fail or blocked`)
    }
    if (assertion.status === 'pass' && !(typeof assertion.evidence === 'string' && assertion.evidence.trim() !== '')) {
      failures.push(`validator assertion ${String(assertion.id)} is pass without evidence`)
    }
  }
  const { ids, state } = assertionState(ctx, failures)
  const reported = new Set(assertions.map((assertion) => String(assertion.id)))
  const untested = Object.entries(state ?? {})
    .filter(([id, entry]) => entry.status === 'failed' && !reported.has(id))
    .map(([id]) => id)
  if (untested.length > 0) failures.push(`validator skipped failed assertions: ${untested.join(', ')}`)
  const unknown = [...reported].filter((id) => !ids.includes(id))
  if (unknown.length > 0) failures.push(`validator reported ids not in validation.md: ${unknown.join(', ')}; use the \`## VAL-xx\` ids`)
}

function checkTriage(ctx: Context, failures: Failures) {
  if (!requireRound(ctx, failures, 'triage')) return
  const triage = readLoopFile(ctx, failures, 'handoffs', `r${ctx.round}-triage.md`)
  if (triage === undefined) return
  const header = triage.split('\n')[0] ?? ''
  const roundHead = pinnedHead(ctx.loopDir, 'round-head') ?? ''
  const headerSha = sha.exec(header)?.[0]
  if (!header.includes(`r${ctx.round}`) || headerSha === undefined || !roundHead.startsWith(headerSha)) {
    failures.push(`r${ctx.round}-triage.md header must name r${ctx.round} and the round-head SHA`)
  }
  if (!/^## (queued|fixed)\b/mu.test(triage) && !statesNoneQueued(triage)) {
    failures.push(`r${ctx.round}-triage.md has no \`## queued\`, \`## fixed <sha>\` or \`no findings queued\``)
  }
  if (/^## queued\b/mu.test(triage) && statesNoneQueued(triage)) {
    failures.push(
      `r${ctx.round}-triage.md has \`## queued\` and a \`no findings queued\` line; if nothing is queued, drop the \`## queued\` heading; otherwise reword that line`,
    )
  }
  const failed = (validatorAssertions(ctx, []) ?? [])
    .filter((assertion) => assertion.status !== 'pass')
    .map((assertion) => String(assertion.id))
    .filter((id) => !triage.includes(id))
  if (failed.length > 0) failures.push(`r${ctx.round}-triage.md does not dispose of ${failed.join(', ')}`)
}

function checkWorkerReport(ctx: Context, failures: Failures, round: number, report: string, required: string[] = []) {
  const name = `r${round}-worker.md`
  const header = report.split('\n').slice(0, 5).join('\n')
  if (!/^agent:\s*\S+/mu.test(header)) failures.push(`${name} must start with an \`agent: <id>\` line`)
  const contract = loopFile(ctx, 'contract.md')
  const latestAgent = [...report.matchAll(/^agent:\s*`?([^\s`]+)/gmu)].at(-1)?.[1]
  if (latestAgent === 'inline' && existsSync(contract) && editingMode(readFileSync(contract, 'utf8')) === 'worker') {
    failures.push(`${name} latest \`agent:\` is inline but editing is worker; dispatch a worker per <worker-task>`)
  }
  const firstBase = /^base:\s*`?([0-9a-f]{7,40})\b/mu.exec(header)?.[1]
  if (firstBase === undefined) {
    failures.push(`${name} must start with a \`base: <sha>\` line naming a commit`)
    return
  }
  const bases = [...report.matchAll(/^base:\s*`?([0-9a-f]{7,40})\b/gmu)].map((match) => match[1] ?? '')
  const base = bases.find((candidate) => commitOf(ctx, candidate) !== undefined && isAncestor(ctx, candidate, 'HEAD'))
  if (base === undefined) {
    failures.push(
      `${name} base ${firstBase} is not in HEAD's history; after a rebase, append a block with \`agent:\`, \`base: <new base>\` and the rebased commits`,
    )
    return
  }
  const notBase = commitOf(ctx, ctx.base) === undefined ? [] : ['--not', ctx.base]
  const commits = new Set([...git(ctx, 'rev-list', '--first-parent', `${base}..HEAD`, ...notBase).split('\n'), ...required])
  const body = report.replaceAll(/^base:.*$/gmu, '')
  const reported = new Set([...body.matchAll(/\b[0-9a-f]{7,40}\b/gu)].map((match) => commitOf(ctx, match[0])))
  const unreported = [...commits].filter((commit) => commit !== '' && !reported.has(commit))
  if (unreported.length > 0) {
    const short = unreported.map((commit) => tryGit(ctx, 'rev-parse', '--short', commit) ?? commit)
    failures.push(`${name} does not report commits ${short.join(', ')}`)
  }
}

function checkFixed(ctx: Context, failures: Failures, notes: string[]) {
  if (!requireRound(ctx, failures, 'fixed')) return
  requireCleanAndPushed(ctx, failures, notes)
  const roundHead = pinnedHead(ctx.loopDir, 'round-head')
  const roundSha = roundHead === undefined ? undefined : commitOf(ctx, roundHead)
  if (roundHead === undefined) failures.push('missing round-head')
  else if (roundSha === undefined) failures.push('round-head is not a commit')
  if (roundSha !== undefined && !isAncestor(ctx, roundSha, 'HEAD')) {
    failures.push(
      "round-head is not in HEAD's history (rebased): in step 7, skip `fixed` and pin a new round (step 4); at step 8 after an equivalent stacked rebase, run `done` instead of `all`",
    )
    return
  }

  const triage = readLoopFile(ctx, failures, 'handoffs', `r${ctx.round}-triage.md`)
  if (triage === undefined) return
  if (/^## queued\b/mu.test(triage)) failures.push(`r${ctx.round}-triage.md still has \`## queued\``)
  const fixed = [...triage.matchAll(/^## fixed\s+`?([^\s`]+)/gmu)].map((match) => match[1] ?? '')
  if (fixed.length === 0 && !statesNoneQueued(triage)) {
    failures.push(`r${ctx.round}-triage.md has no \`## fixed <sha>\` heading or \`no findings queued\``)
  }
  const fixedCommits = new Set<string>()
  for (const ref of fixed) {
    const commit = commitOf(ctx, ref)
    if (commit === undefined) failures.push(`## fixed ${ref} is not a commit`)
    else if (!isAncestor(ctx, commit, 'HEAD')) failures.push(`## fixed ${ref} is not in HEAD's history`)
    else if (roundSha !== undefined && (roundSha === commit || !isAncestor(ctx, roundSha, commit))) {
      failures.push(`## fixed ${ref} is not after round-head`)
    } else fixedCommits.add(commit)
  }
  if (roundSha !== undefined) {
    const unfixed = git(ctx, 'rev-list', '--first-parent', `${roundSha}..HEAD`)
      .split('\n')
      .filter((commit) => commit !== '' && !fixedCommits.has(commit))
    if (unfixed.length > 0) {
      failures.push(
        `commits after round-head without a \`## fixed <sha>\` heading: ${unfixed.map((commit) => commit.slice(0, 7)).join(', ')}`,
      )
    }
  }

  const reportFile = loopFile(ctx, 'handoffs', `r${ctx.round}-worker.md`)
  if (existsSync(reportFile)) checkWorkerReport(ctx, failures, ctx.round, readFileSync(reportFile, 'utf8'), [...fixedCommits])
  else if (fixed.length > 0) failures.push(`missing handoffs/r${ctx.round}-worker.md for the fixed commits`)
}

function checkDone(ctx: Context, failures: Failures, notes: string[]) {
  requireCleanAndPushed(ctx, failures)
  const head = commitOf(ctx, 'HEAD')
  const { state } = assertionState(ctx, failures)
  for (const [id, entry] of Object.entries(state ?? {})) {
    if (entry.status !== 'passed') failures.push(`${id} is not passed`)
    else if (typeof entry.commit !== 'string' || commitOf(ctx, entry.commit) !== head) {
      failures.push(`${id} passed at ${String(entry.commit)}, not at HEAD; advance its commit per <validation-state> or revalidate`)
    }
  }
  const triageFile = loopFile(ctx, 'handoffs', `r${ctx.round}-triage.md`)
  if (existsSync(triageFile) && /^## queued\b/mu.test(readFileSync(triageFile, 'utf8'))) {
    failures.push(`r${ctx.round}-triage.md still has \`## queued\`; address it (step 7) before finishing`)
  }
  const prHead = ctx.prHead()
  if ('reason' in prHead) {
    failures.push(
      `could not read the PR head (${prHead.reason}); check \`gh auth status\`, or rerun outside the sandbox, or pass --pr <number>`,
    )
  } else if (prHead.oid !== head) {
    failures.push(
      `PR head is ${prHead.oid.slice(0, 10)}, not HEAD; push HEAD to the PR head branch (\`gh pr view --json headRefName\`), or fetch it if someone else pushed`,
    )
  }
  const comments = ctx.unresolvedPrComments()
  const output = ('output' in comments ? comments.output : '').split(/^--- (?:thread|ai comment) divider$/mu)[0] ?? ''
  const threads = /^\s*No unresolved code review threads/u.test(output)
    ? '0'
    : /Unresolved code review threads:\s*(\d+)/u.exec(output)?.[1]
  if (threads === undefined) {
    const reason = 'reason' in comments ? ` (${comments.reason})` : ''
    failures.push(
      `could not read unresolved PR threads from bin/unresolved-pr-comments${reason}; check \`gh auth status\`, or rerun outside the sandbox, or pass --pr <number>`,
    )
  } else if (threads !== '0') failures.push(`${threads} unresolved PR review threads`)
  const aiComments = /AI review comments:\s*(\d+)/u.exec(output)?.[1]
  if (aiComments !== undefined) notes.push(`${aiComments} AI review comments on the PR`)
}

export function runCheck(ctx: Context, name: CheckName) {
  const failures: Failures = []
  const notes: string[] = []
  if (name === 'docs') checkDocs(ctx, failures)
  if (name === 'editing') checkEditing(ctx, failures, notes)
  if (name === 'round-start') checkRoundStart(ctx, failures, notes)
  if (name === 'reports') checkReports(ctx, failures)
  if (name === 'triage') checkTriage(ctx, failures)
  if (name === 'fixed') checkFixed(ctx, failures, notes)
  if (name === 'done') checkDone(ctx, failures, notes)
  return { name, failures, notes }
}

const usage = `usage: loop-check.mts <loop-name> <${checkNames.join('|')}|all> --round <n> [--base origin/<base>] [--pr <number>]`

function main(argv: string[]) {
  const positional = argv.filter((arg, index) => !arg.startsWith('--') && !argv[index - 1]?.startsWith('--'))
  const option = (flag: string) => {
    const index = argv.indexOf(flag)
    return index === -1 ? undefined : argv[index + 1]
  }
  const [loopName, check] = positional
  const names = check === 'all' ? [...checkNames] : checkNames.filter((name) => name === check)
  const round = option('--round') ?? ''
  if (loopName === undefined || names.length === 0 || !/^\d+$/u.test(round)) {
    console.error(usage)
    return 2
  }

  const repo = execFileSync('git', ['rev-parse', '--show-toplevel'], { encoding: 'utf8' }).trim()
  const loopDir = path.join(repo, 'playground', 'loops', loopName)
  if (!existsSync(loopDir)) {
    console.error(`no loop dir at ${path.relative(repo, loopDir)}`)
    return 2
  }
  const pr = option('--pr')
  const ctx: Context = {
    repo,
    loopDir,
    round: Number(round),
    base: option('--base') ?? 'origin/develop',
    prHead: () => {
      const result = spawnSync('gh', ['pr', 'view', ...(pr === undefined ? [] : [pr]), '--json', 'headRefOid', '--jq', '.headRefOid'], {
        cwd: repo,
        encoding: 'utf8',
      })
      if (result.error !== undefined) return { reason: result.error.message }
      const oid = result.stdout.trim()
      if (result.status === 0 && /^[0-9a-f]{40}$/u.test(oid)) return { oid }
      const stderr = result.stderr.trim().split('\n')[0] ?? ''
      return { reason: stderr === '' ? `exit ${String(result.status)}` : stderr }
    },
    unresolvedPrComments: () => {
      const result = spawnSync(path.join(repo, 'bin', 'unresolved-pr-comments'), pr === undefined ? [] : [pr], {
        cwd: repo,
        encoding: 'utf8',
        maxBuffer: 64 * 1024 * 1024,
      })
      if (result.error !== undefined) return { reason: result.error.message }
      if (result.status === 0) return { output: result.stdout }
      const stderr = result.stderr.trim().split('\n')[0] ?? ''
      return { reason: stderr === '' ? `exit ${String(result.status)}` : stderr }
    },
  }

  let failed = false
  for (const name of names) {
    const result = runCheck(ctx, name)
    failed ||= result.failures.length > 0
    console.log(`${result.failures.length === 0 ? 'PASS' : 'FAIL'} ${name} (r${ctx.round})`)
    for (const failure of result.failures) console.log(`  - ${failure}`)
    for (const note of result.notes) console.log(`  note: ${note}`)
  }
  return failed ? 1 : 0
}

if (import.meta.main) process.exitCode = main(process.argv.slice(2))
