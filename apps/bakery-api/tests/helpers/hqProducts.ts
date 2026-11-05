/**
 * Temporary hq product dirs for tests (B5). Only the synthetic E2E catalogue
 * (`tools/e2e/hq-products`) is copied - never real hq data.
 *
 *   const readDir = makeProductsDir(['1-kornbrot-500g.md'])
 *   const writeRoot = makeWriteRepo(readDir)    // git repo on app/edits
 */
import { execFileSync } from 'child_process'
import * as fs from 'fs'
import * as os from 'os'
import * as path from 'path'

export const FIXTURE_DIR = path.resolve(
  __dirname,
  '../../../../tools/e2e/hq-products'
)

/** A few fixture files of different shapes (allergens, quotes, categories). */
export const SAMPLE_FILES = [
  '1-kornbrot-500g.md',
  '2-kornbrot-1000g.md',
  '13-musterweck.md',
  '15-mustersemmel.md',
  '21-musterbaguette-klein.md',
]

const created: string[] = []

export function tempDir(prefix: string): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), prefix))
  created.push(dir)
  return dir
}

/** A products dir with copies of the given fixture files. */
export function makeProductsDir(files: string[] = SAMPLE_FILES): string {
  const dir = path.join(tempDir('hq-read-'), 'products')
  fs.mkdirSync(dir)
  for (const file of files) {
    fs.copyFileSync(path.join(FIXTURE_DIR, file), path.join(dir, file))
  }
  return dir
}

export function git(cwd: string, ...args: string[]): string {
  return execFileSync('git', args, {
    cwd,
    encoding: 'utf-8',
    env: {
      ...process.env,
      GIT_AUTHOR_NAME: 'Test Setup',
      GIT_AUTHOR_EMAIL: 'setup@example.invalid',
      GIT_COMMITTER_NAME: 'Test Setup',
      GIT_COMMITTER_EMAIL: 'setup@example.invalid',
    },
  }).trim()
}

/**
 * A git repo on branch `app/edits` whose `products/` equals `readDir`, with
 * one initial commit - stands in for `HQ_WRITE_DIR`. Returns the repo root.
 */
export function makeWriteRepo(readDir: string): string {
  const root = tempDir('hq-write-')
  git(root, 'init', '-q', '-b', 'app/edits')
  git(root, 'config', 'commit.gpgsign', 'false')
  fs.mkdirSync(path.join(root, 'products'))
  for (const file of fs.readdirSync(readDir)) {
    fs.copyFileSync(path.join(readDir, file), path.join(root, 'products', file))
  }
  git(root, 'add', '-A')
  git(root, 'commit', '-q', '-m', 'initial')
  return root
}

export function removeTempDirs(): void {
  for (const dir of created.splice(0)) {
    fs.rmSync(dir, { recursive: true, force: true })
  }
}
