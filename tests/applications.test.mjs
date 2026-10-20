import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const builder = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const temporaryPrefix = path.join(os.tmpdir(), 'resume-builder-test-');

async function fixture(run) {
  const root = await fs.mkdtemp(temporaryPrefix);
  async function write(relative, content) {
    const file = path.join(root, relative);
    await fs.mkdir(path.dirname(file), { recursive: true });
    await fs.writeFile(file, content);
  }
  try {
    await write('profiles/one/personal.json', JSON.stringify({ name: 'First person' }));
    await write('profiles/one/summary.md', 'Shared first summary for {{name}}');
    await write('profiles/one/only-first.md', 'First profile only');
    await write('profiles/two/personal.json', JSON.stringify({ name: 'Second person' }));
    await write('profiles/two/summary.md', 'Shared second summary for {{name}}');
    await write('applications/a/application.json', JSON.stringify({ profile: 'one', flags: { highlight: true } }));
    await write('applications/a/job.md', 'JOB NOTES MUST NOT RENDER');
    await write('applications/a/resume.md.hbs', '{{> summary}}\n{{#if highlight}}Highlighted{{/if}}');
    await write('applications/a/summary.md', '{{> base_summary}}\nTailored for {{application}}');
    await write('applications/b/application.json', JSON.stringify({ profile: 'two' }));
    await write('applications/b/resume.md.hbs', '{{> summary}}\n{{#if highlight}}LEAKED FLAG{{/if}}');
    const build = (...args) => spawnSync(process.execPath, [
      path.join(builder, 'node_modules/ts-node/dist/bin.js'),
      path.join(builder, 'scripts/build.ts'),
      ...args,
    ], { cwd: root, encoding: 'utf8' });
    const applicationArgs = ['--applications-root', 'applications', '--profiles-root=profiles', '--output-dir', 'out'];
    await run({ root, write, build, applicationArgs });
  } finally {
    if (!path.resolve(root).startsWith(path.resolve(temporaryPrefix))) throw new Error('Unexpected temporary directory');
    await fs.rm(root, { recursive: true, force: true });
  }
}

test('applications select profiles, inline base sections, and isolate flags and partials', async () => fixture(async ({ root, write, build, applicationArgs }) => {
  const result = build(...applicationArgs);
  assert.equal(result.status, 0, result.stderr);
  const a = await fs.readFile(path.join(root, 'out/a.md'), 'utf8');
  const b = await fs.readFile(path.join(root, 'out/b.md'), 'utf8');
  assert.match(a, /Shared first summary for First person/);
  assert.match(a, /Tailored for a/);
  assert.match(a, /Highlighted/);
  assert.doesNotMatch(a, /JOB NOTES MUST NOT RENDER/);
  assert.match(b, /Shared second summary for Second person/);
  assert.doesNotMatch(b, /First person|Tailored|LEAKED FLAG/);
  // A partial from a different person's profile must never be available.
  await write('applications/b/resume.md.hbs', '{{> only-first}}');
  const isolation = build(...applicationArgs);
  assert.notEqual(isolation.status, 0);
  assert.match(isolation.stderr, /only-first/);
}));

test('a selected application builds alone and a missing selection fails', async () => fixture(async ({ root, build, applicationArgs }) => {
  assert.equal(build(...applicationArgs, '--application=b').status, 0);
  assert.deepEqual((await fs.readdir(path.join(root, 'out'))).sort(), ['b.md', 'css.css']);
  assert.notEqual(build(...applicationArgs, '--application', 'missing').status, 0);
}));

test('application profile paths and malformed flags are rejected', async () => fixture(async ({ write, build, applicationArgs }) => {
  await write('applications/a/application.json', JSON.stringify({ profile: '../one' }));
  assert.match(build(...applicationArgs).stderr, /Invalid or missing profile/);
  await write('applications/a/application.json', JSON.stringify({ profile: 'one', flags: [] }));
  assert.match(build(...applicationArgs).stderr, /Expected a flags object/);
  assert.match(build('--applications-root', 'applications').stderr, /require both/);
}));

test('standalone build uses the bundled applications and sample profile', async () => fixture(async ({ root, build }) => {
  const result = build('--output-dir', 'standalone');
  assert.equal(result.status, 0, result.stderr);
  const files = await fs.readdir(path.join(root, 'standalone'));
  assert.ok(files.includes('sample.md'));
  assert.ok(files.includes('sample-engineering-manager.md'));
  assert.ok(files.includes('sample-short.md'));
}));

test('explicit legacy source roots remain supported', async () => fixture(async ({ root, write, build }) => {
  await write('legacy/cvs/person/personal.json', JSON.stringify({ name: 'Legacy person' }));
  await write('legacy/cvs/person/base/summary.md', 'Legacy content for {{name}}');
  await write('legacy/variants/person/general.md.hbs', '{{> summary}}');
  const result = build('--source-root', 'legacy', '--profile', 'person', '--output-dir', 'legacy-output');
  assert.equal(result.status, 0, result.stderr);
  assert.match(await fs.readFile(path.join(root, 'legacy-output/general.md'), 'utf8'), /Legacy content for Legacy person/);
}));