/**
 * B5b rules (`hq-writeback.core.js`): git error classes, editors from the
 * Co-authored-by trailers, the German PR body. Synthetic names only.
 */
const core = require('../../src/services/hq-writeback.core')

describe('classifyGitError', () => {
  const cases = [
    [
      ['push'],
      ' ! [rejected]        HEAD -> main (fetch first)',
      'push_rejected',
    ],
    [
      ['push'],
      'error: failed to push some refs\nhint: Updates were rejected because the tip of your current branch is behind',
      'push_rejected',
    ],
    [['push'], ' ! [rejected] HEAD -> app/edits (stale info)', 'push_rejected'],
    [
      ['push'],
      "fatal: unable to access 'https://github.com/x/y.git/': Could not resolve host: github.com",
      'network',
    ],
    [
      ['fetch'],
      "fatal: '/tmp/nix' does not appear to be a git repository\nfatal: Could not read from remote repository.",
      'network',
    ],
    [
      ['pull'],
      "fatal: unable to access 'https://github.com/x/y.git/': Failed to connect",
      'network',
    ],
    [
      ['rebase'],
      'CONFLICT (content): Merge conflict in products/1-a.md\nerror: could not apply 1234abc',
      'rebase_conflict',
    ],
    [
      ['pull'],
      'CONFLICT (add/add): Merge conflict in data/production/x.json',
      'rebase_conflict',
    ],
    [
      ['status'],
      'fatal: not a git repository (or any of the parent directories): .git',
      'not_a_repo',
    ],
    [['commit'], 'error: some hook said no', 'git_failed'],
    // network words only count for network commands
    [['commit'], 'Could not resolve host', 'git_failed'],
  ]
  test.each(cases)('%j %#', (args, stderr, code) => {
    expect(core.classifyGitError(args, stderr)).toBe(code)
  })
})

describe('editorsFromLog', () => {
  test('names from trailers, once each, in first-seen order, no mail', () => {
    const log = [
      'products: Testbrot (testbrot) geändert',
      '',
      'Co-authored-by: Erika Test <erika.test@bakery.local>',
      '',
      'products: Testweck (testweck) angelegt',
      '',
      'Co-authored-by: Max Probe <max@bakery.local>',
      'products: Testbrot (testbrot) geändert',
      '',
      'co-authored-by: erika test <erika.test@bakery.local>',
    ].join('\n')
    expect(core.editorsFromLog(log)).toEqual(['Erika Test', 'Max Probe'])
    expect(core.editorsFromLog('')).toEqual([])
  })
})

describe('pullRequestBody', () => {
  test('German, lists files and editors, says it updates itself', () => {
    const body = core.pullRequestBody({
      files: ['products/1-testbrot.md', 'products/2-test`weck.md'],
      editors: ['Erika Test'],
      commitCount: 2,
    })
    expect(body).toContain('`products/1-testbrot.md`')
    expect(body).toContain("`products/2-test'weck.md`")
    expect(body).toContain('**Bearbeitet von:** Erika Test')
    expect(body).toContain('Commits beim Öffnen: 2')
    expect(body).toContain('wartet auf Freigabe')
    expect(body).not.toMatch(/@bakery\.local/)
  })

  test('copes with nothing', () => {
    const body = core.pullRequestBody({})
    expect(body).toContain('(keine)')
    expect(body).toContain('unbekannt')
  })
})

describe('helpers', () => {
  test('fileList trims, dedupes and sorts', () => {
    expect(core.fileList('b\n a \n\nb\n')).toEqual(['a', 'b'])
  })
  test('parseRepo', () => {
    expect(core.parseRepo('H-Bakery/hq')).toEqual({
      owner: 'H-Bakery',
      repo: 'hq',
    })
    expect(core.parseRepo('nope')).toBeNull()
    expect(core.parseRepo('a/b/c')).toBeNull()
  })
  test('every error code has a German message; unknown falls back', () => {
    for (const code of [
      'network',
      'push_rejected',
      'rebase_conflict',
      'github_failed',
      'disabled',
    ]) {
      expect(core.syncErrorMessage(code)).toMatch(/[a-zäöü]/)
    }
    expect(core.syncErrorMessage('???')).toBe(
      core.syncErrorMessage('git_failed')
    )
  })
})
