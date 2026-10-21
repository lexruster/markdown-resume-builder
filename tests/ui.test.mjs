import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';
import { createResumeServer, parseOptions, renderMarkdown } from '../scripts/ui-server.mjs';

test('UI options support standalone and external roots without silently mixing layouts', () => {
  assert.match(parseOptions([]).profilesRoot, /resume$/);
  assert.equal(parseOptions(['--port=0']).port, 0);
  assert.equal(parseOptions(['--open']).openBrowser,true);
  assert.throws(() => parseOptions(['--profiles-root','one']), /together/);
  assert.throws(() => parseOptions(['--port','invalid']), /Invalid port/);
  assert.throws(() => parseOptions(['--css']), /Missing value/);
  assert.throws(() => parseOptions(['--unknown','x']), /Unknown/);
});

test('Markdown preview keeps contact/definition-list layout, removes executable HTML and handles page breaks', () => {
  const html = renderMarkdown('# Example\n\n**Engineer**\n  : Company\n  : 2026\n\n##\n\n\\newpage\n\n\\\\[10px]\n\n<span class="iconify" data-icon="tabler:mail"></span>\n<script>alert(1)</script><img src="https://tracker.example/x" onerror="alert(2)"><a href="javascript:alert(3)">bad</a>');
  assert.match(html, /<dl>/);
  assert.match(html, /class="section-separator"/);
  assert.match(html, /class="page-break"/);
  assert.match(html, /height:10px/);
  assert.match(html, /data-icon="tabler:mail"/);
  assert.doesNotMatch(html, /script|onerror|javascript:|https:\/\/tracker|<h2><\/h2>/);
});

test('local server discovers fresh disk data, builds selected application through the engine, and rejects cross-profile requests', async () => {
  const prefix = path.join(os.tmpdir(), 'resume-ui-test-');
  const root = await fs.mkdtemp(prefix);
  const write = async (relative, text) => {
    const file = path.join(root, relative);
    await fs.mkdir(path.dirname(file), { recursive:true });
    await fs.writeFile(file, text);
  };
  let server;
  try {
    await write('resume/one/personal.json', '{"fullName":"First Person"}');
    await write('resume/one/header.md', '# {{fullName}}');
    await write('resume/one/summary.md', 'Shared summary');
    await write('resume/two/personal.json', '{"name":"Second Person"}');
    await write('resume/two/summary.md', 'Other person');
    await write('applications/a/application.json', '{"profile":"one"}');
    await write('applications/a/resume.md.hbs', '{{> header}}\n\n{{> summary}}');
    await write('applications/a/summary.md', '{{> base_summary}}\n\nTailored text');
    await write('applications/b/application.json', '{"profile":"two"}');
    await write('applications/b/resume.md.hbs', '{{> summary}}');
    await write('style.css', 'h1 { color: navy; }');
    server = await createResumeServer({profilesRoot:path.join(root,'resume'), applicationsRoot:path.join(root,'applications'), outputDir:path.join(root,'out'), cssPath:path.join(root,'style.css')});
    await new Promise(resolve => server.listen(0,'127.0.0.1',resolve));
    const origin = 'http://127.0.0.1:' + server.address().port;
    const health = await (await fetch(origin+'/api/health')).json();
    assert.equal(health.app,'markdown-resume-builder');
    assert.equal(health.profilesRoot,path.join(root,'resume'));
    const catalog = await (await fetch(origin+'/api/catalog')).json();
    assert.equal(catalog.profiles.length, 2);
    assert.equal(catalog.profiles[0].name, 'First Person');
    assert.equal(catalog.applications.length, 2);
    const post = (data, token=catalog.token, extra={}) => fetch(origin+'/api/generate', {
      method:'POST', headers:{'Content-Type':'application/json','X-Resume-Token':token,...extra}, body:JSON.stringify(data),
    });
    assert.equal((await post({profile:'one',application:'a'},'wrong')).status,403);
    assert.equal((await post({profile:'two',application:'a'})).status,400);
    assert.equal((await post({profile:'one',application:'../a'})).status,400);
    assert.equal((await post({profile:'one',application:'a'},catalog.token,{Origin:'https://foreign.example'})).status,403);
    const foreignHost = await new Promise((resolve, reject) => {
      const request = http.get(origin+'/api/catalog', {headers:{Host:'foreign.example'}}, response => { response.resume(); resolve(response.statusCode); });
      request.on('error',reject);
    });
    assert.equal(foreignHost,403);
    const readSaved = (application='a',profile='one') => fetch(origin+'/api/export?'+new URLSearchParams({application,profile}));
    assert.deepEqual(await (await readSaved()).json(),{exists:false});
    assert.equal((await readSaved('a','two')).status,400);
    assert.equal((await readSaved('../a')).status,400);
    const result = await post({profile:'one',application:'a'});
    assert.equal(result.status,200);
    const generated = await result.json();
    assert.match(generated.markdown, /First Person/);
    assert.match(generated.html, /<h1>First Person<\/h1>/);
    assert.match(generated.markdown, /Shared summary[\s\S]*Tailored text/);
    assert.equal(await fs.readFile(path.join(root,'out/a.md'),'utf8'), generated.markdown);
    await assert.rejects(fs.access(path.join(root,'out/b.md')));
    assert.equal(generated.css, 'h1 { color: navy; }');
    const savedTime = (await fs.stat(path.join(root,'out/a.md'))).mtimeMs;
    await write('resume/one/summary.md', 'Fresh disk changes');
    const saved = await (await readSaved()).json();
    assert.equal(saved.exists,true);
    assert.equal(saved.markdown,generated.markdown,'Reading must show the saved export, not newly edited sources');
    assert.equal((await fs.stat(path.join(root,'out/a.md'))).mtimeMs,savedTime,'Reading must not rewrite the export');
    assert.ok(saved.html.includes('<h1>First Person</h1>'));
    const again = await (await post({profile:'one',application:'a'})).json();
    assert.match(again.markdown, /Fresh disk changes/);
    await write('applications/a/resume.md.hbs', '{{> missing-section}}');
    const failed = await post({profile:'one',application:'a'});
    assert.equal(failed.status,500);
    assert.match((await failed.json()).error,/missing-section/);
    await write('applications/c/application.json','{"profile":"one"}');
    await write('applications/c/resume.md.hbs','{{> header}}');
    assert.equal((await (await fetch(origin+'/api/catalog')).json()).applications.length,3);
    for (const asset of ['/','/app.js','/preview.html','/preview.js','/print.html','/print.js','/resume.css','/preview-shell.css','/vendor/paged.js','/fonts/regular.woff2','/fonts/bold.woff2','/fonts/italic.woff2']) {
      const response = await fetch(origin+asset);
      assert.equal(response.status,200,asset);
      assert.ok((await response.arrayBuffer()).byteLength > 0,asset);
    }
  } finally {
    if (server) await new Promise(resolve => server.close(resolve));
    if (!path.resolve(root).startsWith(path.resolve(prefix))) throw new Error('Unexpected temporary path');
    await fs.rm(root,{recursive:true,force:true});
  }
});
