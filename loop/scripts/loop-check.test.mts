/* oxlint-disable typescript/no-floating-promises -- node:test registers describe/test synchronously */
import assert from 'node:assert/strict'
import { execFileSync, spawnSync } from 'node:child_process'
import { chmodSync, mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, test } from 'node:test'

import {
  type CheckName,
  type Context,
  contractSections,
  countChangedLines,
  editingMode,
  isProdPath,
  checkNames,
  prodLinesChanged,
  runCheck,
} from './loop-check.mts'

let root: string
let repo: string
let ctx: Context
let threads = '0'
let prComments: { output: string } | { reason: string } | undefined
let prHead: { oid: string } | { reason: string } | undefined
const script = path.join(import.meta.dirname, 'loop-check.mts')

function git(...args: string[]) {
  return execFileSync('git', args, { cwd: repo, encoding: 'utf8' }).trim()
}

function write(file: string, content: string) {
  const target = path.join(repo, file)
  mkdirSync(path.dirname(target), { recursive: true })
  writeFileSync(target, content)
}

function loop(file: string, content: string) {
  write(path.join('playground/loops/demo', file), content)
}

function request(content = 'ship it\n', mode = 0o444) {
  const file = path.join(repo, 'playground/loops/demo/request.md')
  rmSync(file, { force: true })
  write('playground/loops/demo/request.md', content)
  chmodSync(file, mode)
}

function cli(...args: string[]) {
  const fakeBin = path.join(root, 'fake-bin')
  mkdirSync(fakeBin, { recursive: true })
  writeFileSync(path.join(fakeBin, 'gh'), '#!/usr/bin/env bash\ngit rev-parse HEAD\n', { mode: 0o755 })
  const env = { ...process.env, PATH: `${fakeBin}${path.delimiter}${process.env.PATH ?? ''}` }
  const result = spawnSync(process.execPath, [script, ...args], { cwd: repo, encoding: 'utf8', env })
  return { status: result.status, output: `${result.stdout}${result.stderr}` }
}

function comments(output: string) {
  prComments = { output }
}

function commit(file: string, content: string, message = file) {
  write(file, content)
  git('add', file)
  git('commit', '-q', '-m', message)
  return git('rev-parse', 'HEAD')
}

function contract(editing = 'worker') {
  return contractSections
    .map((section) => (section === 'editing' ? `## editing\n${editing}` : `## ${section}\nn/a`))
    .join('\n\n')
}

function failures(name: CheckName) {
  return runCheck(ctx, name).failures
}

beforeEach(() => {
  root = mkdtempSync(path.join(tmpdir(), 'loop-check-'))
  repo = path.join(root, 'repo')
  execFileSync('git', ['init', '-q', '--bare', path.join(root, 'remote.git')])
  execFileSync('git', ['init', '-q', '-b', 'develop', repo])
  git('config', 'user.email', 'test@example.com')
  git('config', 'user.name', 'test')
  git('remote', 'add', 'origin', path.join(root, 'remote.git'))
  commit('.gitignore', 'playground/\n')
  git('push', '-q', '-u', 'origin', 'develop')
  git('checkout', '-q', '-b', 'feature')
  threads = '0'
  prComments = undefined
  prHead = undefined
  ctx = {
    repo,
    loopDir: path.join(repo, 'playground/loops/demo'),
    round: 1,
    base: 'origin/develop',
    unresolvedPrComments: () =>
      prComments ?? {
        output:
          threads === '0'
            ? 'No unresolved code review threads or AI review comments found for PR #1\n'
            : `PR #1: demo\nUnresolved code review threads: ${threads}\nAI review comments: 0\n`,
      },
    prHead: () => prHead ?? { oid: git('rev-parse', 'HEAD') },
  }
  request()
  loop('contract.md', contract())
  loop('validation.md', '# validation\n\n## VAL-01: thing\n- steps: n/a\n\n## VAL-02: other\n- steps: n/a\n')
  loop('validation-state.json', JSON.stringify({ 'VAL-01': { status: 'failed', commit: null }, 'VAL-02': { status: 'failed', commit: null } }))
})

afterEach(() => rmSync(root, { recursive: true, force: true }))

function pushAndPin() {
  git('push', '-q', '-u', 'origin', 'feature')
  const head = git('rev-parse', 'HEAD')
  loop('round-head', `${head}\n`)
  return head
}

function pass(round: number, id: string) {
  return { id, status: 'pass', evidence: `evidence/r${round}-${id}.txt` }
}

function reviewedRound() {
  const reviewed = pushAndPin()
  loop('last-reviewed-head', `${reviewed}\n`)
  loop('handoffs/r1-thermo.md', 'findings: none\n')
  loop('handoffs/r1-codex-native/review-abc/review.md', 'NO_ISSUES_FOUND\n')
  loop('handoffs/r1-validator.json', JSON.stringify({ assertions: [pass(1, 'VAL-01'), pass(1, 'VAL-02')] }))
  loop('handoffs/r1-triage.md', `# r1 — ${reviewed} — orchestrator: claude\n\nno findings queued\n`)
  return reviewed
}

function passAll(head: string) {
  loop('validation-state.json', JSON.stringify({ 'VAL-01': { status: 'passed', commit: head }, 'VAL-02': { status: 'passed', commit: head } }))
}

function roundReports(round: number) {
  loop(`handoffs/r${round}-thermo.md`, 'findings: none\n')
  loop(`handoffs/r${round}-codex-native/review-abc/review.md`, 'NO_ISSUES_FOUND\n')
  loop(`handoffs/r${round}-validator.json`, JSON.stringify({ assertions: [pass(round, 'VAL-01'), pass(round, 'VAL-02')] }))
}

describe('prod line counting', () => {
  test('counts only prod code, taking the larger side of each file', () => {
    assert.equal(isProdPath('app/javascript/pages/Home.tsx'), true)
    assert.equal(isProdPath('db/migrate/20261024_add.rb'), true)
    assert.equal(isProdPath('app/javascript/pages/Home.test.tsx'), false)
    assert.equal(isProdPath('app/javascript/pages/Home.stories.tsx'), false)
    assert.equal(isProdPath('test/models/user_test.rb'), false)
    assert.equal(isProdPath('db/structure.sql'), false)
    assert.equal(isProdPath('.agents/skills/loop/SKILL.md'), false)
    assert.equal(isProdPath('config.ru'), true)
    assert.equal(isProdPath('db/seeds/production.rb'), true)
    assert.equal(isProdPath('config/client/componentWorkshopVite.config.mts'), false)
    assert.equal(isProdPath('lib/smoke_tests/agent_browser_session.rb'), false)
    assert.equal(isProdPath('app/javascript/components/AddOnGrowth.fixtures.ts'), false)
    assert.equal(isProdPath('app/javascript/lib/pipeline/__fixtures__/deals.ts'), false)
    assert.equal(isProdPath('app/javascript/generated/subviewRegistry.json'), false)
    assert.equal(isProdPath('app/prompts/leto/sql/SKILL.md'), true)
    assert.equal(isProdPath('app/javascript/README.md'), false)
    assert.equal(countChangedLines('3\t3\tapp/a.rb\u000040\t0\ttest/a_test.rb\u00002\t5\tlib/b.rb\u0000-\t-\tapp/logo.png\u0000'), 9)
    assert.equal(countChangedLines('4\t1\t\u0000app/a.rb\u0000test/a_test.rb\u00001\t1\t\u0000test/b.rb\u0000test/c.rb\u0000'), 4)
  })

  test('reads editing as a heading or a label', () => {
    assert.equal(editingMode('## editing\ninline\n'), 'inline')
    assert.equal(editingMode('- editing: `worker`\n'), 'worker')
    assert.equal(editingMode('## goals\nship\n'), undefined)
    assert.equal(editingMode('## non-goals\n- editing inline styles\n\n## editing\nworker\n'), 'worker')
  })

  test('the editing heading wins over an editing label elsewhere', () => {
    assert.equal(editingMode('## accepted tradeoffs\n- editing: a worker is overkill here\n\n## editing\ninline\n'), 'inline')
  })

  test('counts an untracked file by its lines, not its trailing newline', () => {
    write('app/models/new.rb', Array.from({ length: 9 }, (_, index) => `line ${index}\n`).join(''))
    assert.equal(prodLinesChanged(ctx), 9)
  })

  test('renames, deletions, binaries, CRLF and missing newlines count right', () => {
    const moved = Array.from({ length: 30 }, (_, index) => `line ${index}\n`).join('')
    commit('test/models/move_test.rb', moved)
    commit('app/models/gone.rb', 'a\nb\nc\n')
    git('push', '-q', 'origin', 'feature:develop', '-f')
    git('fetch', '-q', 'origin')
    git('mv', 'test/models/move_test.rb', 'app/models/move.rb')
    write('app/models/move.rb', `${moved}added 1\nadded 2\n`)
    git('add', '-A')
    git('rm', '-q', 'app/models/gone.rb')
    git('commit', '-q', '-m', 'move')
    commit('app/models/crlf.rb', 'crlf 1\r\ncrlf 2\r\n')
    commit('app/models/no_newline.rb', 'last 1\nlast 2')
    write('app/assets/logo.png', Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x00, 0x0a, 0x0a]).toString('latin1'))
    git('add', 'app/assets/logo.png')
    git('commit', '-q', '-m', 'logo')
    assert.equal(prodLinesChanged(ctx), 2 + 3 + 2 + 2 + 1)
  })

  test('a rename out of prod and a quoted unicode path both count', () => {
    commit('app/models/gone_soon.rb', Array.from({ length: 30 }, (_, index) => `line ${index}\n`).join(''))
    git('push', '-q', 'origin', 'feature:develop', '-f')
    git('fetch', '-q', 'origin')
    mkdirSync(path.join(repo, 'test/models'), { recursive: true })
    git('mv', 'app/models/gone_soon.rb', 'test/models/gone_soon_test.rb')
    write('test/models/gone_soon_test.rb', `${Array.from({ length: 25 }, (_, index) => `line ${index}\n`).join('')}x\ny\n`)
    git('add', '-A')
    git('commit', '-q', '-m', 'move out')
    assert.equal(prodLinesChanged(ctx), 5)
    commit('app/models/ü.rb', 'a\nb\n')
    write('app/models/ö.rb', 'c\n')
    assert.equal(prodLinesChanged(ctx), 5 + 2 + 1)
  })

  test('untracked binaries, symlinks and large files count without reading them as text', () => {
    mkdirSync(path.join(repo, 'app/models'), { recursive: true })
    writeFileSync(path.join(repo, 'app/models/huge.rb'), 'x\n'.repeat(200_000))
    writeFileSync(path.join(repo, 'app/models/blob.bin'), Buffer.from([0, 1, 2, 10, 10]))
    symlinkSync(path.join(repo, 'app'), path.join(repo, 'app/models/loop'))
    assert.equal(prodLinesChanged(ctx), 200_000 + 1 + 1)
  })

  test('a stacked child retargeted to develop counts only its own lines', () => {
    git('checkout', '-q', '-b', 'parent', 'develop')
    commit('app/parent.rb', Array.from({ length: 20 }, (_, index) => `parent ${index}`).join('\n'))
    git('push', '-q', '-u', 'origin', 'parent')
    git('checkout', '-q', '-b', 'child')
    commit('app/child.rb', 'child\n')
    git('checkout', '-q', 'develop')
    git('merge', '-q', '--squash', 'parent')
    git('commit', '-q', '-m', 'parent (#1)')
    git('push', '-q')
    git('checkout', '-q', 'child')
    git('rebase', '-q', '--onto', 'origin/develop', 'parent')
    loop('contract.md', contract('inline'))
    assert.deepEqual(failures('editing'), [])
    assert.equal(prodLinesChanged(ctx), 1)
  })

  test('a merge of the base moves the merge base', () => {
    commit('app/a.rb', 'a\n')
    git('checkout', '-q', 'develop')
    commit('app/upstream.rb', Array.from({ length: 30 }, (_, index) => `u ${index}`).join('\n'))
    git('push', '-q')
    git('checkout', '-q', 'feature')
    git('merge', '-q', '--no-ff', '--no-edit', 'develop')
    assert.equal(prodLinesChanged(ctx), 1)
  })
})

describe('docs', () => {
  test('passes on a complete contract and matching state', () => {
    assert.deepEqual(failures('docs'), [])
  })

  test('flags missing sections and state drift', () => {
    loop('contract.md', '## goals\nship\n')
    loop('validation-state.json', JSON.stringify({ 'VAL-01': { status: 'passed', commit: null } }))
    const result = failures('docs')
    assert.ok(result.some((failure) => failure.includes('"non-goals"')))
    assert.ok(result.some((failure) => failure.includes('"editing"')))
    assert.ok(result.some((failure) => failure.includes('missing VAL-02')))
    assert.ok(result.some((failure) => failure.includes('VAL-01 is passed without a commit')))
  })

  test('reports a null state entry instead of throwing', () => {
    loop('validation-state.json', JSON.stringify({ 'VAL-01': null, 'VAL-02': { status: 'failed', commit: null } }))
    assert.match(failures('docs').join('\n'), /VAL-01 must be an object/u)
  })

  test('docs requires a non-empty, read-only request.md', () => {
    rmSync(path.join(ctx.loopDir, 'request.md'))
    assert.match(failures('docs').join('\n'), /missing request.md/u)
    request('')
    assert.match(failures('docs').join('\n'), /empty request.md/u)
    request('ship it\n', 0o644)
    assert.match(failures('docs').join('\n'), /request.md is writable; run `chmod a-w` on it/u)
    request('ship it\n', 0o444)
    assert.deepEqual(failures('docs'), [])
  })

  test('missing request.md says what to do', () => {
    rmSync(path.join(ctx.loopDir, 'request.md'))
    assert.match(failures('docs').join('\n'), /missing request.md; copy the user's request into it and run `chmod a-w` on it/u)
  })

  test('assertion ids come only from `## VAL-xx` headings', () => {
    loop('validation.md', '# validation\n\n## VAL-01: thing\n```bash\n# VAL-01 rerun\n```\n\n## VAL-02: other\n')
    assert.deepEqual(failures('docs'), [])
  })
})

describe('editing', () => {
  test('lets an inline loop stay under the prod line limit', () => {
    loop('contract.md', contract('inline'))
    commit('app/javascript/Button.tsx', 'a\nb\nc\n')
    commit('app/javascript/Button.test.tsx', Array.from({ length: 50 }, () => 'x').join('\n'))
    assert.deepEqual(failures('editing'), [])
  })

  test('tells an inline loop to switch once it outgrows the limit', () => {
    loop('contract.md', contract('inline'))
    commit('app/models/user.rb', Array.from({ length: 12 }, (_, index) => `line ${index}`).join('\n'))
    assert.match(failures('editing').join('\n'), /switch editing to worker/u)
    loop('contract.md', contract('worker'))
    assert.deepEqual(failures('editing'), [])
  })

  test('editing requires r0-worker.md before the first round', () => {
    ctx.round = 0
    commit('app/a.rb', 'a\n')
    assert.match(failures('editing').join('\n'), /missing handoffs\/r0-worker.md/u)
    ctx.round = 1
    assert.deepEqual(failures('editing'), [])
  })

  test('editing checks r0-worker.md covers every commit before the first round', () => {
    ctx.round = 0
    const base = git('rev-parse', 'HEAD')
    const first = commit('app/a.rb', 'a\n')
    commit('app/b.rb', 'b\n')
    loop('handoffs/r0-worker.md', `agent: abc\nbase: ${base}\n\ncommits: ${first.slice(0, 7)} goal 1\n`)
    assert.match(failures('editing').join('\n'), /does not report commits/u)
  })

  test('worker mode rejects a report whose latest block is inline', () => {
    ctx.round = 0
    const base = git('rev-parse', 'HEAD')
    const first = commit('app/a.rb', 'a\n')
    const inline = `agent: inline\nbase: ${base}\n\ncommits: ${first.slice(0, 7)}\n`
    loop('handoffs/r0-worker.md', inline)
    assert.match(failures('editing').join('\n'), /latest `agent:` is inline but editing is worker/u)

    loop('handoffs/r0-worker.md', `${inline}\nagent: abc123\nbase: ${first}\n\ncommits: none\n`)
    assert.deepEqual(failures('editing'), [])

    loop('contract.md', contract('inline'))
    loop('handoffs/r0-worker.md', inline)
    assert.deepEqual(failures('editing'), [])
  })

  test('a backticked base line is accepted', () => {
    ctx.round = 0
    const base = git('rev-parse', 'HEAD')
    const first = commit('app/a.rb', 'a\n')
    loop('handoffs/r0-worker.md', `agent: \`abc\`\nbase: \`${base}\`\n\ncommits: ${first} goal 1\n`)
    assert.deepEqual(failures('editing'), [])
  })

  test('a shared 7-character prefix does not count as reporting a commit', () => {
    const env = { ...process.env, GIT_AUTHOR_DATE: '@0 +0000', GIT_COMMITTER_DATE: '@0 +0000', GIT_AUTHOR_NAME: 't', GIT_COMMITTER_NAME: 't', GIT_AUTHOR_EMAIL: 't@example.com', GIT_COMMITTER_EMAIL: 't@example.com' }
    const commitTree = (...args: string[]) => execFileSync('git', ['commit-tree', ...args], { cwd: repo, env, encoding: 'utf8' }).trim()
    const tree = execFileSync('git', ['mktree'], { cwd: repo, input: '', encoding: 'utf8' }).trim()
    const base = commitTree(tree, '-m', 'base')
    const reported = commitTree(tree, '-p', base, '-m', '2482')
    const unreported = commitTree(tree, '-p', base, '-m', '7645')
    assert.equal(reported.slice(0, 7), unreported.slice(0, 7))
    git('reset', '-q', '--hard', unreported)
    ctx.base = base
    ctx.round = 0
    loop('handoffs/r0-worker.md', `agent: abc\nbase: ${base}\n\ncommits: ${reported.slice(0, 7)} goal 1\n`)
    const unique = git('rev-parse', '--short', unreported)
    assert.ok(unique.length > 7)
    assert.match(failures('editing').join('\n'), new RegExp(`does not report commits ${unique}\\b`, 'u'))
    loop('handoffs/r0-worker.md', `agent: abc\nbase: ${base}\n\ncommits: ${unreported.slice(0, 9)} goal 1\n`)
    assert.deepEqual(failures('editing'), [])
  })

  test('a rebase during step 2 passes once the report appends a block for the rebased commits', () => {
    ctx.round = 0
    git('checkout', '-q', '-b', 'parent', 'develop')
    const parentTip = commit('app/parent.rb', 'p\n')
    git('push', '-q', '-u', 'origin', 'parent')
    git('checkout', '-q', '-B', 'feature', 'parent')
    const first = commit('app/a.rb', 'a\n')
    const block1 = `agent: abc\nbase: ${parentTip}\n\ncommits: ${first} goal 1\n`
    loop('handoffs/r0-worker.md', block1)
    ctx.base = 'origin/parent'
    assert.deepEqual(failures('editing'), [])

    git('checkout', '-q', 'develop')
    git('merge', '-q', '--squash', 'parent')
    git('commit', '-q', '-m', 'parent (#1)')
    git('push', '-q')
    git('checkout', '-q', 'feature')
    git('rebase', '-q', '--onto', 'origin/develop', 'parent')
    git('branch', '-q', '-D', 'parent')
    git('push', '-q', 'origin', '--delete', 'parent')
    git('fetch', '-q', '--prune', 'origin')
    git('reflog', 'expire', '--expire=now', '--all')
    git('gc', '-q', '--prune=now')
    ctx.base = 'origin/develop'
    const rebased = git('rev-parse', 'HEAD')
    assert.match(failures('editing').join('\n'), /is not in HEAD's history; after a rebase, append a block/u)
    loop('handoffs/r0-worker.md', `${block1}\nagent: orchestrator\nbase: ${git('rev-parse', 'origin/develop')}\n\ncommits: ${rebased} rebased goal 1\n`)
    assert.deepEqual(failures('editing'), [])
  })

  test('a step 2 rebase onto a newer develop passes with the appended block', () => {
    ctx.round = 0
    const base = git('rev-parse', 'HEAD')
    const first = commit('app/a.rb', 'a\n')
    git('checkout', '-q', 'develop')
    commit('app/d1.rb', 'd1\n')
    commit('app/d2.rb', 'd2\n')
    git('push', '-q')
    git('checkout', '-q', 'feature')
    git('rebase', '-q', 'origin/develop')
    const rebased = git('rev-parse', 'HEAD')
    loop(
      'handoffs/r0-worker.md',
      `agent: abc\nbase: ${base}\n\ncommits: ${first} goal 1\n\nagent: orchestrator\nbase: ${git('rev-parse', 'origin/develop')}\n\ncommits: ${rebased} rebased\n`,
    )
    assert.deepEqual(failures('editing'), [])
  })

  test('checks read without taking git locks while a worker commits', () => {
    commit('app/a.rb', 'a\n')
    pushAndPin()
    writeFileSync(path.join(repo, '.git/index.lock'), '')
    assert.deepEqual(failures('round-start'), [])
    assert.doesNotThrow(() => failures('editing'))
    rmSync(path.join(repo, '.git/index.lock'))
  })
})

describe('round-start', () => {
  test('passes when HEAD is clean, pushed and pinned', () => {
    commit('app/a.rb', 'a\n')
    pushAndPin()
    assert.deepEqual(failures('round-start'), [])
  })

  test('flags unpushed and unpinned HEADs', () => {
    commit('app/a.rb', 'a\n')
    assert.match(failures('round-start').join('\n'), /HEAD is not on any remote branch other than origin\/develop; push it to the PR head branch/u)
    pushAndPin()
    commit('app/b.rb', 'b\n')
    write('app/c.rb', 'dirty\n')
    const result = failures('round-start').join('\n')
    assert.match(result, /not clean/u)
    assert.match(result, /push it/u)
    assert.match(result, /re-pin/u)
  })

  test('an amended commit after round-head is pinned asks for a re-pin', () => {
    commit('app/a.rb', 'a\n')
    pushAndPin()
    write('app/a.rb', 'amended\n')
    git('commit', '-q', '-a', '--amend', '--no-edit')
    git('push', '-q', '-f')
    assert.deepEqual(failures('round-start'), ['round-head is not HEAD; re-pin the round'])
  })

  test('behind or diverged HEADs name both next steps', () => {
    commit('app/a.rb', 'a\n')
    git('push', '-q', '-u', 'origin', 'feature')
    git('reset', '-q', '--hard', 'HEAD~1')
    const notPushed = /HEAD is not on any remote branch .*`--force-with-lease` after your own rebase; if github moved that branch, fetch it and start from it instead/u
    assert.match(failures('round-start').join('\n'), notPushed)
    commit('app/b.rb', 'b\n')
    assert.match(failures('round-start').join('\n'), notPushed)
  })

  test('pushed means a remote branch other than the base is at HEAD, whatever the upstream says', () => {
    commit('app/a.rb', 'a\n')
    git('push', '-q', 'origin', 'feature:fix/pr-branch')
    for (const upstream of ['origin/develop', 'origin/fix/pr-branch']) {
      git('branch', '-q', '--set-upstream-to', upstream)
      loop('round-head', `${git('rev-parse', 'HEAD')}\n`)
      assert.deepEqual(failures('round-start'), [], upstream)
    }
    ctx.base = 'origin/fix/pr-branch'
    assert.match(failures('round-start').join('\n'), /HEAD is not on any remote branch other than origin\/fix\/pr-branch/u)
  })

  test('an upstream on the local repo or a merged parent does not count as pushed', () => {
    git('checkout', '-q', '-b', 'parent')
    commit('app/parent.rb', 'p\n')
    git('push', '-q', '-u', 'origin', 'parent')
    git('checkout', '-q', '-b', 'child', '--track', 'parent')
    commit('app/child.rb', 'c\n')
    assert.match(failures('round-start').join('\n'), /HEAD is not on any remote branch/u)
    git('branch', '-q', '--set-upstream-to', 'origin/parent')
    git('push', '-q', 'origin', '--delete', 'parent')
    git('fetch', '-q', '--prune', 'origin')
    assert.match(failures('round-start').join('\n'), /HEAD is not on any remote branch/u)
    git('push', '-q', 'origin', 'HEAD:child')
    loop('round-head', `${git('rev-parse', 'HEAD')}\n`)
    assert.deepEqual(failures('round-start'), [])
  })

  test('round-start names the remote branch HEAD is on', () => {
    commit('app/a.rb', 'a\n')
    git('push', '-q', 'origin', 'feature:loop-x-99cff8')
    loop('round-head', `${git('rev-parse', 'HEAD')}\n`)
    const result = runCheck(ctx, 'round-start')
    assert.deepEqual(result.failures, [])
    assert.deepEqual(result.notes, ['HEAD is on origin/loop-x-99cff8'])
  })

  test('the fetch hint reads only origin', () => {
    commit('app/a.rb', 'a\n')
    git('config', 'remote.origin.fetch', '+refs/heads/develop:refs/remotes/origin/develop')
    git('remote', 'add', 'other', path.join(root, 'remote.git'))
    git('push', '-q', 'origin', 'feature')
    assert.match(failures('round-start').join('\n'), /this clone fetches no branches/u)
  })

  test('a clone that fetches no branches says how to fetch them', () => {
    commit('app/a.rb', 'a\n')
    git('config', 'remote.origin.fetch', '+refs/heads/develop:refs/remotes/origin/develop')
    git('push', '-q', 'origin', 'feature')
    assert.match(failures('round-start').join('\n'), /this clone fetches no branches: first run `git config --add remote.origin.fetch/u)
  })
})

describe('reports', () => {
  test('requires reviewer, codex native and validator reports covering failed ids', () => {
    loop('handoffs/r1-thermo.md', 'findings: none\n')
    loop('handoffs/r1-validator.json', JSON.stringify({ assertions: [{ id: 'VAL-01', status: 'pass' }] }))
    const result = failures('reports').join('\n')
    assert.match(result, /codex-native/u)
    assert.match(result, /validator skipped failed assertions: VAL-02/u)
    assert.match(result, /VAL-01 is pass without evidence/u)

    loop('handoffs/r1-codex-native/review-abc/review.md', 'NO_ISSUES_FOUND\n')
    loop(
      'handoffs/r1-validator.json',
      JSON.stringify({
        assertions: [
          { id: 'VAL-01', status: 'pass', evidence: 'evidence/r1-val01.txt' },
          { id: 'VAL-02', status: 'fail' },
        ],
      }),
    )
    assert.deepEqual(failures('reports'), [])
  })

  test('reports a null validator report or assertion instead of throwing', () => {
    loop('handoffs/r1-validator.json', 'null')
    assert.match(failures('reports').join('\n'), /r1-validator.json has no assertions array/u)
    loop('handoffs/r1-validator.json', JSON.stringify({ assertions: [null] }))
    assert.match(failures('reports').join('\n'), /r1-validator.json assertions must be objects/u)
    assert.doesNotThrow(() => failures('triage'))
  })

  test('a non-empty waiver stands in for the review; an empty one or a partial review does not', () => {
    commit('app/a.rb', 'a\n')
    reviewedRound()
    rmSync(path.join(ctx.loopDir, 'handoffs/r1-codex-native'), { recursive: true })
    const missing = /no non-empty r1-codex-native\/review-\*\/review.md or r1-codex-native\/waiver.md/u
    assert.match(failures('reports').join('\n'), missing)
    loop('handoffs/r1-codex-native/waiver.md', '')
    assert.match(failures('reports').join('\n'), missing)
    loop('handoffs/r1-codex-native/review-abc/review.md', '')
    assert.match(failures('reports').join('\n'), missing)
    loop('handoffs/r1-codex-native/waiver.md', 'quota exhausted twice; log: handoffs/r1-codex-native/launcher.log\n')
    assert.deepEqual(failures('reports'), [])
    loop('handoffs/r1-codex-native/review-abc/review.md', 'NO_ISSUES_FOUND\n')
    assert.deepEqual(failures('reports'), [])
  })

  test('no failed ids and an empty assertions list passes', () => {
    commit('app/a.rb', 'a\n')
    const head = reviewedRound()
    passAll(head)
    loop('handoffs/r1-validator.json', JSON.stringify({ assertions: [] }))
    assert.deepEqual(failures('reports'), [])
  })

  test('validator ids not in validation.md are named', () => {
    pushAndPin()
    loop('handoffs/r1-thermo.md', 'findings: none\n')
    loop('handoffs/r1-codex-native/review-abc/review.md', 'NO_ISSUES_FOUND\n')
    loop('handoffs/r1-validator.json', JSON.stringify({ assertions: [pass(1, 'VAL-1'), pass(1, 'VAL-02')] }))
    assert.match(failures('reports').join('\n'), /validator reported ids not in validation.md: VAL-1/u)
  })

  test('validator ids are checked against validation.md', () => {
    pushAndPin()
    loop('handoffs/r1-thermo.md', 'findings: none\n')
    loop('handoffs/r1-codex-native/review-abc/review.md', 'NO_ISSUES_FOUND\n')
    rmSync(path.join(ctx.loopDir, 'validation-state.json'))
    loop('handoffs/r1-validator.json', JSON.stringify({ assertions: [pass(1, 'VAL-01'), pass(1, 'VAL-02')] }))
    assert.doesNotMatch(failures('reports').join('\n'), /not in validation.md/u)
  })

  test('a no-fix round re-pinned at the same SHA needs its own reports', () => {
    reviewedRound()
    assert.deepEqual(failures('reports'), [])
    ctx.round = 2
    assert.match(failures('reports').join('\n'), /no reviewer report r2-<slug>.md/u)
  })
})

describe('triage', () => {
  test('requires the round SHA and a disposition for every failed assertion', () => {
    const head = pushAndPin()
    loop('handoffs/r1-validator.json', JSON.stringify({ assertions: [{ id: 'VAL-02', status: 'fail' }] }))
    loop('handoffs/r1-triage.md', `# r1 — ${head} — orchestrator: claude\n\nno findings queued\n`)
    assert.match(failures('triage').join('\n'), /does not dispose of VAL-02/u)

    loop('handoffs/r1-triage.md', `# r1 — ${head} — orchestrator: claude\n\n## queued\n- r1-validator VAL-02 empty name\n`)
    assert.deepEqual(failures('triage'), [])
  })

  test('blocked needs a triage disposition; malformed JSON fails clearly', () => {
    const head = pushAndPin()
    loop('handoffs/r1-thermo.md', 'findings: none\n')
    loop('handoffs/r1-codex-native/review-abc/review.md', 'NO_ISSUES_FOUND\n')
    loop(
      'handoffs/r1-validator.json',
      JSON.stringify({ assertions: [{ id: 'VAL-01', status: 'blocked' }, { id: 'VAL-02', status: 'fail' }] }),
    )
    assert.deepEqual(failures('reports'), [])
    loop('handoffs/r1-triage.md', `# r1 — ${head} — orchestrator: claude\n\n## queued\n- VAL-02\n`)
    assert.match(failures('triage').join('\n'), /does not dispose of VAL-01/u)
    loop('handoffs/r1-validator.json', '{"assertions": [')
    assert.deepEqual(failures('reports'), ['invalid JSON in handoffs/r1-validator.json'])
    assert.doesNotThrow(() => failures('triage'))
  })

  test('triage rejects `## queued` next to `no findings queued`', () => {
    const head = pushAndPin()
    loop('handoffs/r1-triage.md', `# r1 — ${head} — orchestrator: claude\n\n## queued\nno findings queued\n`)
    assert.match(failures('triage').join('\n'), /if nothing is queued, drop the `## queued` heading; otherwise reword that line/u)
  })

  test('`no findings queued` quoted inside a queued item is not the status line', () => {
    const head = pushAndPin()
    loop('handoffs/r1-triage.md', `# r1 — ${head} — orchestrator: claude\n\n## queued\n- add a test for \`no findings queued\`\n`)
    assert.deepEqual(failures('triage'), [])
    passAll(head)
    loop('handoffs/r1-triage.md', `# r1 — ${head} — orchestrator: claude\n\n## skipped\n- x mentions no findings queued in prose\n`)
    assert.match(failures('fixed').join('\n'), /no `## fixed <sha>` heading or `no findings queued`/u)
    for (const line of ['no findings queued; 3 skipped as out of scope', '- no findings queued (all skipped)', '**no findings queued**', 'No findings queued.']) {
      loop('handoffs/r1-triage.md', `# r1 — ${head} — orchestrator: claude\n\n${line}\n`)
      assert.deepEqual(failures('triage'), [], line)
      assert.deepEqual(failures('fixed'), [], line)
    }
  })
})

describe('fixed', () => {
  test('passes when every fix is a reported commit after the round', () => {
    const round = pushAndPin()
    const fix = commit('app/a.rb', 'fixed\n', 'fix VAL-02')
    git('push', '-q')
    loop('handoffs/r1-triage.md', `# r1 — ${round} — orchestrator: claude\n\n## fixed ${fix.slice(0, 7)}\n- VAL-02\n`)
    loop('handoffs/r1-worker.md', `agent: abc123\nbase: ${round}\n\ncommits: ${fix.slice(0, 7)} VAL-02\n`)
    assert.deepEqual(failures('fixed'), [])
  })

  test('requires the worker report to name every `## fixed` commit, even with a post-commit base', () => {
    const round = pushAndPin()
    const fix = commit('app/a.rb', 'fixed\n')
    git('push', '-q')
    loop('handoffs/r1-triage.md', `# r1 — ${round} — orchestrator: claude\n\n## fixed ${fix.slice(0, 7)}\n- VAL-02\n`)
    loop('handoffs/r1-worker.md', `agent: abc\nbase: ${fix}\n`)
    assert.match(failures('fixed').join('\n'), new RegExp(`r1-worker.md does not report commits ${fix.slice(0, 7)}`, 'u'))
  })

  test('fails once when a rebase dropped round-head from history', () => {
    commit('app/a.rb', 'a\n')
    const round = pushAndPin()
    git('reset', '-q', '--hard', 'origin/develop')
    const rebased = commit('app/a.rb', 'a\n', 'rebased')
    const fix = commit('app/b.rb', 'fixed\n')
    git('push', '-q', '-f')
    loop('handoffs/r1-triage.md', `# r1 — ${round} — orchestrator: claude\n\n## fixed ${fix.slice(0, 7)}\n- VAL-02\n`)
    loop('handoffs/r1-worker.md', `agent: abc\nbase: ${round}\n\ncommits: ${rebased.slice(0, 7)} ${fix.slice(0, 7)}\n`)
    const result = failures('fixed')
    assert.equal(result.length, 1)
    assert.match(result[0] ?? '', /in step 7, skip `fixed` and pin a new round \(step 4\)/u)
    assert.match(result[0] ?? '', /at step 8 after an equivalent stacked rebase, run `done` instead of `all`/u)
  })

  test('requires a `## fixed` heading for every commit after round-head', () => {
    const round = pushAndPin()
    const first = commit('app/a.rb', 'fixed\n')
    const second = commit('app/b.rb', 'fixed\n')
    git('push', '-q')
    loop('handoffs/r1-triage.md', `# r1 — ${round} — orchestrator: claude\n\n## fixed ${first.slice(0, 7)}\n- VAL-02\n`)
    loop('handoffs/r1-worker.md', `agent: abc\nbase: ${round}\n\ncommits: ${first.slice(0, 7)} ${second.slice(0, 7)}\n`)
    assert.match(failures('fixed').join('\n'), new RegExp(`without a \`## fixed <sha>\` heading: ${second.slice(0, 7)}`, 'u'))
  })

  test('requires `no findings queued` when nothing is fixed', () => {
    const round = pushAndPin()
    loop('handoffs/r1-triage.md', `# r1 — ${round} — orchestrator: claude\n\n## skipped\n- VAL-02\n`)
    assert.match(failures('fixed').join('\n'), /no `## fixed <sha>` heading or `no findings queued`/u)

    loop('handoffs/r1-triage.md', `# r1 — ${round} — orchestrator: claude\n\nno findings queued\n`)
    assert.deepEqual(failures('fixed'), [])
  })

  test('flags leftover queues, unreported commits and missing headers', () => {
    const round = pushAndPin()
    commit('app/a.rb', 'fixed\n')
    git('push', '-q')
    loop('handoffs/r1-triage.md', `# r1 — ${round} — orchestrator: claude\n\n## queued\n- VAL-02\n`)
    loop('handoffs/r1-worker.md', `agent: abc123\nbase: ${round}\n\nall done\n`)
    const result = failures('fixed').join('\n')
    assert.match(result, /still has `## queued`/u)
    assert.match(result, /does not report commits/u)

    loop('handoffs/r1-worker.md', 'all done\n')
    assert.match(failures('fixed').join('\n'), /`agent: <id>`/u)
  })

  test('a reported merge commit covers the commits it brought in', () => {
    const round = pushAndPin()
    git('checkout', '-q', 'develop')
    commit('app/upstream.rb', 'u\n')
    git('push', '-q')
    git('checkout', '-q', 'feature')
    git('merge', '-q', '--no-ff', '--no-edit', 'develop')
    const merge = git('rev-parse', 'HEAD')
    git('push', '-q')
    loop('handoffs/r1-triage.md', `# r1 — ${round} — orchestrator: claude\n\n## fixed ${merge.slice(0, 7)}\n- conflict\n`)
    loop('handoffs/r1-worker.md', `agent: abc\nbase: ${round}\n\ncommits: ${merge.slice(0, 7)} merge develop\n`)
    assert.deepEqual(failures('fixed'), [])
  })

  test('a backticked `## fixed` SHA is accepted', () => {
    const round = pushAndPin()
    const fix = commit('app/a.rb', 'fixed\n')
    git('push', '-q')
    loop('handoffs/r1-triage.md', `# r1 — ${round} — orchestrator: claude\n\n## fixed \`${fix.slice(0, 7)}\`\n- VAL-02\n`)
    loop('handoffs/r1-worker.md', `agent: abc\nbase: ${round}\n\ncommits: ${fix.slice(0, 7)} VAL-02\n`)
    assert.deepEqual(failures('fixed'), [])
  })
})

describe('done', () => {
  test('requires every assertion passed at HEAD and no open threads', () => {
    const head = pushAndPin()
    loop('validation-state.json', JSON.stringify({ 'VAL-01': { status: 'passed', commit: head }, 'VAL-02': { status: 'failed', commit: null } }))
    threads = '2'
    const result = failures('done').join('\n')
    assert.match(result, /VAL-02 is not passed/u)
    assert.match(result, /2 unresolved PR review threads/u)

    loop('validation-state.json', JSON.stringify({ 'VAL-01': { status: 'passed', commit: head }, 'VAL-02': { status: 'passed', commit: head } }))
    threads = '0'
    assert.deepEqual(failures('done'), [])
  })

  test('reads thread counts from the summary, not comment bodies', () => {
    pushAndPin()
    loop('validation-state.json', JSON.stringify({}))
    comments([
      'PR #1: demo',
      'Unresolved code review threads: 1',
      'AI review comments: 0',
      '--- thread divider',
      'body:',
      'No unresolved code review threads or AI review comments found for PR #1',
      '--- thread divider',
    ].join('\n'))
    assert.match(failures('done').join('\n'), /1 unresolved PR review threads/u)
  })

  test('requires a clean, pushed checkout', () => {
    pushAndPin()
    loop('validation-state.json', JSON.stringify({}))
    commit('app/a.rb', 'a\n')
    assert.match(failures('done').join('\n'), /push it/u)
  })

  test('an empty or partial state fails', () => {
    const head = pushAndPin()
    loop('validation-state.json', '{}')
    assert.match(failures('done').join('\n'), /validation-state.json is missing VAL-01, VAL-02/u)
    loop('validation-state.json', JSON.stringify({ 'VAL-01': { status: 'passed', commit: head } }))
    assert.match(failures('done').join('\n'), /validation-state.json is missing VAL-02/u)
  })

  test('done says what to do with assertions passed at an older commit', () => {
    const old = pushAndPin()
    commit('app/a.rb', 'a\n')
    git('push', '-q')
    passAll(old)
    assert.match(failures('done').join('\n'), /VAL-01 passed at .*, not at HEAD; advance its commit per <validation-state> or revalidate/u)
  })

  test('done fails while the round triage still has `## queued`', () => {
    const head = pushAndPin()
    passAll(head)
    loop('handoffs/r1-triage.md', `# r1 — ${head} — orchestrator: claude\n\n## queued\n- r1-thermo nit\n`)
    assert.match(failures('done').join('\n'), /r1-triage.md still has `## queued`/u)
  })

  test('a failing or silent gh says what to do', () => {
    const head = pushAndPin()
    passAll(head)
    const hint = /check `gh auth status`, or rerun outside the sandbox/u
    prComments = { reason: 'gh: To get started with GitHub CLI, please run:  gh auth login' }
    const unauthenticated = failures('done').join('\n')
    assert.match(unauthenticated, hint)
    assert.match(unauthenticated, /gh auth login/u)
    prComments = { reason: 'spawn bin/unresolved-pr-comments ENOENT' }
    assert.match(failures('done').join('\n'), /ENOENT/u)
    comments('')
    assert.match(failures('done').join('\n'), hint)
    comments('API rate limit exceeded\n')
    assert.match(failures('done').join('\n'), hint)
  })

  test('done fails when the PR head is not HEAD, or cannot be read', () => {
    const old = pushAndPin()
    commit('app/a.rb', 'a\n')
    git('push', '-q', 'origin', 'HEAD:loop-x-99cff8')
    passAll(git('rev-parse', 'HEAD'))
    prHead = { oid: old }
    assert.match(
      failures('done').join('\n'),
      new RegExp(`PR head is ${old.slice(0, 7)}\\w*, not HEAD; push HEAD to the PR head branch \\(\`gh pr view --json headRefName\`\\), or fetch it if someone else pushed`, 'u'),
    )
    prHead = { reason: 'gh: not logged in' }
    assert.match(failures('done').join('\n'), /could not read the PR head \(gh: not logged in\); check `gh auth status`, or rerun outside the sandbox, or pass --pr <number>/u)
    prHead = undefined
    assert.deepEqual(failures('done'), [])
  })

  test('a helper failure also suggests --pr', () => {
    const head = pushAndPin()
    passAll(head)
    prComments = { reason: 'No PR number found.' }
    assert.match(failures('done').join('\n'), /or pass --pr <number>/u)
  })

  test('a PR with 0 comments passes', () => {
    const head = pushAndPin()
    passAll(head)
    assert.deepEqual(failures('done'), [])
  })

  test('done reads a large helper output and names a helper that cannot start', () => {
    commit('app/a.rb', 'a\n')
    const stub = `#!/usr/bin/env bash\necho 'PR #1: demo'\necho 'Unresolved code review threads: 0'\necho 'AI review comments: 1'\nhead -c 2000000 /dev/zero | tr '\\\\0' x\n`
    write('bin/unresolved-pr-comments', stub)
    chmodSync(path.join(repo, 'bin/unresolved-pr-comments'), 0o755)
    git('add', 'bin')
    git('commit', '-q', '-m', 'stub')
    const head = pushAndPin()
    passAll(head)
    const result = cli('demo', 'done', '--round', '1')
    assert.doesNotMatch(result.output, /could not read/u)
    assert.match(result.output, /^PASS done \(r1\)$/mu)

    rmSync(path.join(repo, 'bin/unresolved-pr-comments'))
    git('commit', '-q', '-am', 'drop stub')
    git('push', '-q')
    passAll(git('rev-parse', 'HEAD'))
    const missing = cli('demo', 'done', '--round', '1')
    assert.doesNotMatch(missing.output, /TypeError|at checkDone/u)
    assert.match(missing.output, /ENOENT/u)
  })

  test('`done` passes after an equivalent stacked rebase', () => {
    commit('app/a.rb', 'a\n')
    reviewedRound()
    git('reset', '-q', '--hard', 'origin/develop')
    const rebased = commit('app/a.rb', 'a\n', 'rebased')
    git('push', '-q', '-f')
    loop('validation-state.json', JSON.stringify({ 'VAL-01': { status: 'passed', commit: rebased }, 'VAL-02': { status: 'passed', commit: rebased } }))
    assert.deepEqual(failures('done'), [])
  })
})

describe('cli', () => {
  test('--round is required and must be a non-negative integer', () => {
    for (const args of [[], ['--round', 'abc'], ['--round', '-1'], ['--round', '1.5'], ['--round']]) {
      const result = cli('demo', 'docs', '--base', 'origin/develop', ...args)
      assert.equal(result.status, 2, args.join(' '))
      assert.match(result.output, /usage: .*--round <n>/u)
    }
    const result = cli('demo', 'docs', '--base', 'origin/develop', '--round', '0')
    assert.equal(result.status, 0, result.output)
    assert.match(result.output, /^PASS docs \(r0\)$/mu)
  })

  test('review-round checks name the round they need', () => {
    ctx.round = 0
    for (const name of ['reports', 'triage', 'fixed'] as const) {
      assert.match(failures(name).join('\n'), new RegExp(`${name} runs from round 1; pass --round <n>`, 'u'))
    }
  })

  test('loop names with spaces or unicode, and runs from a subdirectory', () => {
    const name = 'my loop ü'
    mkdirSync(path.join(repo, 'playground/loops', name), { recursive: true })
    for (const file of ['contract.md', 'validation.md', 'validation-state.json', 'request.md']) {
      execFileSync('cp', ['-p', path.join(ctx.loopDir, file), path.join(repo, 'playground/loops', name, file)])
    }
    assert.equal(cli(name, 'docs', '--round', '0').status, 0)
    mkdirSync(path.join(repo, 'app'), { recursive: true })
    const nested = spawnSync(process.execPath, [script, name, 'docs', '--round', '0'], { cwd: path.join(repo, 'app'), encoding: 'utf8' })
    assert.equal(nested.status, 0, nested.stdout)
    assert.match(cli('missing', 'docs', '--round', '0').output, /no loop dir at playground\/loops\/missing/u)
  })

  test('detached HEAD and shallow clones fail with a next step, not a stack trace', () => {
    commit('app/a.rb', 'a\n')
    git('push', '-q', '-u', 'origin', 'feature')
    git('checkout', '-q', '--detach')
    assert.match(failures('round-start').join('\n'), /HEAD is detached; check out the PR branch/u)
    git('checkout', '-q', 'feature')

    const shallow = path.join(root, 'shallow')
    execFileSync('git', ['clone', '-q', '--depth', '1', '--branch', 'feature', `file://${path.join(root, 'remote.git')}`, shallow])
    execFileSync('git', ['fetch', '-q', '--depth', '1', 'origin', 'develop:refs/remotes/origin/develop'], { cwd: shallow })
    const shallowCtx = { ...ctx, repo: shallow }
    loop('contract.md', contract('inline'))
    const result = runCheck(shallowCtx, 'editing').failures.join('\n')
    assert.match(result, /no merge base between HEAD and origin\/develop; run `git fetch --unshallow`/u)
  })

  test('gates run through a symlinked script path', () => {
    const linked = path.join(root, 'linked')
    symlinkSync(import.meta.dirname, linked)
    rmSync(path.join(ctx.loopDir, 'request.md'))
    const result = spawnSync(process.execPath, [path.join(linked, 'loop-check.mts'), 'demo', 'docs', '--round', '0'], { cwd: repo, encoding: 'utf8' })
    assert.equal(result.status, 1)
    assert.match(result.stdout, /^FAIL docs \(r0\)$/mu)
  })
})

describe('whole loop', () => {
  test('every gate passes in order', () => {
    ctx.round = 0
    assert.deepEqual(failures('docs'), [])
    const base = git('rev-parse', 'HEAD')
    const first = commit('app/a.rb', 'a\n')
    loop('handoffs/r0-worker.md', `agent: abc\nbase: ${base}\n\ncommits: ${first} goal 1\n`)
    assert.deepEqual(failures('editing'), [])

    for (const round of [1, 2, 3]) {
      ctx.round = round
      const head = pushAndPin()
      assert.deepEqual(failures('round-start'), [])
      roundReports(round)
      assert.deepEqual(failures('reports'), [])
      loop('last-reviewed-head', `${head}\n`)
      if (round < 3) {
        loop(`handoffs/r${round}-triage.md`, `# r${round} — ${head} — orchestrator: claude\n\n## queued\n- r${round}-thermo nit\n`)
        assert.deepEqual(failures('triage'), [])
        const fix = commit(`app/r${round}.rb`, 'fix\n')
        git('push', '-q')
        loop(`handoffs/r${round}-triage.md`, `# r${round} — ${head} — orchestrator: claude\n\n## fixed ${fix}\n- r${round}-thermo nit\n`)
        loop(`handoffs/r${round}-worker.md`, `agent: abc\nbase: ${head}\n\ncommits: ${fix} nit\n`)
        assert.deepEqual(failures('fixed'), [])
        assert.deepEqual(failures('editing'), [])
      } else {
        loop(`handoffs/r${round}-triage.md`, `# r${round} — ${head} — orchestrator: claude\n\nno findings queued\n`)
        assert.deepEqual(failures('triage'), [])
        passAll(head)
        assert.deepEqual(
          checkNames.flatMap((name) => failures(name)),
          [],
        )
      }
    }
  })

  test('`all` passes at step 8', () => {
    commit('app/a.rb', 'a\n')
    const head = reviewedRound()
    loop('validation-state.json', JSON.stringify({ 'VAL-01': { status: 'passed', commit: head }, 'VAL-02': { status: 'passed', commit: head } }))
    assert.deepEqual(
      checkNames.flatMap((name) => failures(name)),
      [],
    )
  })
})
