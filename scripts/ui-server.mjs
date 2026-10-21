import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomBytes } from 'node:crypto';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import MarkdownIt from 'markdown-it';
import deflist from 'markdown-it-deflist';
import sanitizeHtml from 'sanitize-html';

const execute = promisify(execFile);
const builder = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const web = path.join(builder, 'ui');
const folderName = value => typeof value === 'string' && /^[^\\/\x00-\x1f]+$/.test(value) && value !== '.' && value !== '..';
const markdown = new MarkdownIt({ html: true, linkify: true, typographer: true }).use(deflist);

export function renderMarkdown(source) {
  // These layout commands occur in resumes exported from Markdown Resume.
  source = source.replace(/^\s*\\newpage\s*$/gm, '<div class="page-break"></div>')
    .replace(/\\\\\[(\d+(?:\.\d+)?)px\]/g, (_, n) => '<div style="height:' + Math.min(Number(n), 200) + 'px"></div>');
  const rendered = markdown.render(source)
    .replace(/<h2><\/h2>/g, '<div class="section-separator"></div>')
    .replace(/<h[13456]><\/h[13456]>/g, '');
  return sanitizeHtml(rendered, {
    allowedTags: sanitizeHtml.defaults.allowedTags.concat(['img', 'span', 'div']),
    allowedAttributes: {
      '*': ['class', 'style'],
      a: ['href', 'title'],
      span: ['class', 'data-icon'],
      img: ['src', 'alt', 'width', 'height'],
    },
    allowedSchemes: ['https', 'http', 'mailto', 'tel'],
    allowedSchemesByTag: { img: ['data'] },
    allowProtocolRelative: false,
    allowedStyles: {
      '*': {
        'text-align': [/^(left|right|center|justify)$/],
        'font-weight': [/^(normal|bold|[1-9]00)$/],
        'font-style': [/^(normal|italic)$/],
        'font-size': [/^\d+(\.\d+)?(px|em|pt|%)$/],
        height: [/^\d+(\.\d+)?px$/],
        color: [/^#[0-9a-fA-F]{3,8}$/],
      },
    },
  });
}

export function parseOptions(argv = process.argv.slice(2)) {
  const values = {};
  const allowed = ['profiles-root', 'applications-root', 'output-dir', 'css', 'port'];
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--open') { values.open = true; continue; }
    const [key, ...parts] = argv[i].replace(/^--/, '').split('=');
    if (!allowed.includes(key) || !argv[i].startsWith('--')) throw new Error('Unknown UI option: ' + argv[i]);
    const value = parts.length ? parts.join('=') : argv[++i];
    if (!value || value.startsWith('--')) throw new Error('Missing value for --' + key);
    values[key] = value;
  }
  if (Boolean(values['profiles-root']) !== Boolean(values['applications-root'])) {
    throw new Error('Supply --profiles-root and --applications-root together');
  }
  const port = Number(values.port ?? 4173);
  if (!Number.isInteger(port) || port < 0 || port > 65535) throw new Error('Invalid port');
  return {
    profilesRoot: path.resolve(values['profiles-root'] ?? path.join(builder, 'resume')),
    applicationsRoot: path.resolve(values['applications-root'] ?? path.join(builder, 'applications')),
    outputDir: path.resolve(values['output-dir'] ?? path.join(builder, 'dist')),
    cssPath: path.resolve(values.css ?? path.join(builder, 'sample/css.css')),
    port, openBrowser: Boolean(values.open),
  };
}

export async function createResumeServer(options) {
  const token = randomBytes(32).toString('hex');
  let building = false;
  async function catalog() {
    const profiles = [];
    const applications = [];
    const errors = [];
    for (const entry of (await fs.readdir(options.profilesRoot, { withFileTypes: true })).sort((a,b) => a.name.localeCompare(b.name))) {
      if (!entry.isDirectory()) continue;
      try {
        const personal = JSON.parse(await fs.readFile(path.join(options.profilesRoot, entry.name, 'personal.json'), 'utf8'));
        profiles.push({ id: entry.name, name: personal.fullName || personal.name || entry.name });
      } catch (error) { errors.push('Profile ' + entry.name + ': ' + error.message); }
    }
    for (const entry of (await fs.readdir(options.applicationsRoot, { withFileTypes: true })).sort((a,b) => a.name.localeCompare(b.name))) {
      if (!entry.isDirectory()) continue;
      const configPath = path.join(options.applicationsRoot, entry.name, 'application.json');
      try {
        const config = JSON.parse(await fs.readFile(configPath, 'utf8'));
        if (!folderName(config?.profile)) throw new Error('Invalid profile');
        if (!profiles.some(p => p.id === config.profile)) throw new Error('Profile not found: ' + config.profile);
        await fs.access(path.join(options.applicationsRoot, entry.name, 'resume.md.hbs'));
        applications.push({ id: entry.name, profile: config.profile, flags: config.flags ?? {} });
      } catch (error) {
        if (error.code !== 'ENOENT' || await fs.stat(configPath).catch(() => null)) errors.push('Application ' + entry.name + ': ' + error.message);
      }
    }
    return { profiles, applications, errors };
  }

  async function readExport(application, profile) {
    const output = path.join(options.outputDir, application + '.md');
    const source = await fs.readFile(output, 'utf8');
    let css;
    try { css = await fs.readFile(path.join(options.outputDir, 'css.css'), 'utf8'); }
    catch (error) {
      if (error.code !== 'ENOENT') throw error;
      try { css = await fs.readFile(options.cssPath, 'utf8'); }
      catch (fallback) { if (fallback.code !== 'ENOENT') throw fallback; css = ''; }
    }
    return {exists:true, markdown:source, html:renderMarkdown(source), css, application, profile, output};
  }

  const assets = {
    '/': ['index.html', 'text/html'],
    '/app.js': ['app.js', 'text/javascript'],
    '/app.css': ['app.css', 'text/css'],
    '/print.html': ['print.html', 'text/html'],
    '/print.js': ['print.js', 'text/javascript'],
    '/preview.html': ['preview.html', 'text/html'],
    '/preview.js': ['preview.js', 'text/javascript'],
    '/resume.css': ['resume.css', 'text/css'],
    '/preview-shell.css': ['preview-shell.css', 'text/css'],
    '/vendor/paged.js': ['../node_modules/pagedjs/dist/paged.js', 'text/javascript'],
    '/fonts/regular.woff2': ['../node_modules/@fontsource/source-serif-4/files/source-serif-4-latin-400-normal.woff2', 'font/woff2'],
    '/fonts/italic.woff2': ['../node_modules/@fontsource/source-serif-4/files/source-serif-4-latin-400-italic.woff2', 'font/woff2'],
    '/fonts/bold.woff2': ['../node_modules/@fontsource/source-serif-4/files/source-serif-4-latin-700-normal.woff2', 'font/woff2'],
  };
  const server = http.createServer(async (req, res) => {
    const authority = '127.0.0.1:' + server.address().port;
    const origin = 'http://' + authority;
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'no-referrer');
    res.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; font-src 'self'; img-src 'self' data:; connect-src 'self'; frame-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'self'");
    function json(status, value) {
      res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify(value));
    }
    try {
      if (req.headers.host !== authority || (req.headers.origin && req.headers.origin !== origin)) {
        return json(403, { error: 'Only this local application can access the server' });
      }
      const url = new URL(req.url, origin);
      if (req.method === 'GET' && url.pathname === '/api/health') {
        return json(200, {app:'markdown-resume-builder',profilesRoot:options.profilesRoot});
      }
      if (req.method === 'GET' && url.pathname === '/api/catalog') {
        return json(200, { ...await catalog(), token });
      }
      if (req.method === 'GET' && url.pathname === '/api/export') {
        const application = url.searchParams.get('application'), profile = url.searchParams.get('profile');
        if (!folderName(application) || !folderName(profile)) return json(400, {error:'Invalid selection'});
        const available = await catalog();
        if (!available.applications.some(a => a.id === application && a.profile === profile)) {
          return json(400, {error:'Application does not belong to the selected profile. Refresh the list.'});
        }
        try { return json(200, await readExport(application,profile)); }
        catch (error) {
          if (error.code === 'ENOENT') return json(200, {exists:false});
          throw error;
        }
      }
      if (req.method === 'POST' && url.pathname === '/api/generate') {
        if (req.headers['x-resume-token'] !== token) return json(403, { error: 'Refresh this page before generating' });
        let body = '';
        for await (const chunk of req) {
          body += chunk;
          if (body.length > 8192) return json(413, { error: 'Request too large' });
        }
        let input;
        try { input = JSON.parse(body); } catch { return json(400, { error: 'Invalid JSON' }); }
        if (!input || typeof input !== 'object' || Array.isArray(input)) return json(400, { error: 'Expected a selection object' });
        const { application, profile } = input;
        if (!folderName(application) || !folderName(profile)) return json(400, { error: 'Invalid selection' });
        const available = await catalog();
        if (!available.applications.some(a => a.id === application && a.profile === profile)) {
          return json(400, { error: 'Application does not belong to the selected profile. Refresh the list.' });
        }
        if (building) return json(409, { error: 'A generation is already running. Please try again shortly.' });
        building = true;
        try {
          await execute(process.execPath, [
            path.join(builder, 'node_modules/ts-node/dist/bin.js'), path.join(builder, 'scripts/build.ts'),
            '--profiles-root', options.profilesRoot, '--applications-root', options.applicationsRoot,
            '--output-dir', options.outputDir, '--css', options.cssPath, '--application', application,
          ], { cwd: builder, timeout: 60000, maxBuffer: 1024 * 1024 });
          return json(200, await readExport(application,profile));
        } finally { building = false; }
      }
      if (req.method === 'GET' && assets[url.pathname]) {
        const [file, type] = assets[url.pathname];
        const content = await fs.readFile(path.join(web, file));
        res.writeHead(200, { 'Content-Type': type + (type.startsWith('text/') ? '; charset=utf-8' : '') });
        return res.end(content);
      }
      json(404, { error: 'Not found' });
    } catch (error) {
      json(500, { error: error.stderr?.trim() || error.message });
    }
  });
  return server;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const options = parseOptions();
    const server = await createResumeServer(options);
    server.on('error', error => { console.error(error.message); process.exitCode = 1; });
    server.listen(options.port, '127.0.0.1', () => {
      console.log('Resume Builder: http://127.0.0.1:' + server.address().port);
      console.log('Press Ctrl+C to stop.');
      if (options.openBrowser) {
        const url = 'http://127.0.0.1:' + server.address().port;
        const command = process.platform === 'win32' ? 'rundll32.exe' : process.platform === 'darwin' ? 'open' : 'xdg-open';
        const args = process.platform === 'win32' ? ['url.dll,FileProtocolHandler',url] : [url];
        execFile(command,args,error => { if (error) console.error('Open this URL in your browser: ' + url); });
      }
    });
  } catch (error) { console.error(error.message); process.exitCode = 1; }
}
