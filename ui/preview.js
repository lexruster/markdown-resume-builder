// Paged.js is loaded locally. Resume data is never sent to a remote rendering service.
const iconPaths = {
  'tabler:mail':'<rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 6 9 7 9-7"/>',
  'tabler:phone':'<path d="M5 3h4l2 5-3 2a16 16 0 0 0 6 6l2-3 5 2v4a2 2 0 0 1-2 2C9 20 4 15 3 5a2 2 0 0 1 2-2"/>',
  'ic:outline-location-on':'<path d="M19 10c0 5-7 11-7 11S5 15 5 10a7 7 0 1 1 14 0Z"/><circle cx="12" cy="10" r="2"/>',
  'tabler:brand-linkedin':'<rect x="3" y="3" width="18" height="18" rx="2"/><path d="M7 10v7M7 7v.01M11 17v-7m0 3c0-4 6-4 6 0v4"/>',
  'tabler:brand-github':'<path d="M9 19c-4 1-4-2-6-2m12 4v-4c0-1 .3-2 1-2 3-.3 5-1.5 5-5a4 4 0 0 0-1-3c.3-1 .3-2 0-3-2 0-3 1-3 1a13 13 0 0 0-10 0S6 4 4 4c-.3 1-.3 2 0 3a4 4 0 0 0-1 3c0 3.5 2 4.7 5 5 1 0 1 1 1 2v4"/>',
};
let queued, running = false, previous;
const reply = data => parent.postMessage(data, location.origin);
const style = document.createElement('style');
document.head.append(style);
function setZoom(zoom) { document.documentElement.style.setProperty('--preview-zoom', String(zoom)); }
async function draw(request) {
  const {settings:s, id} = request;
  // Paged.js must measure unscaled pages; apply screen zoom only after layout.
  setZoom(1);
  // The parent owns these values; keep generated CSS restricted to known options.
  const fonts = ['Source Serif 4','Minion Pro','Georgia','Arial','Times New Roman'];
  const font = fonts.includes(s.font) ? s.font : 'Source Serif 4';
  const num = (n, min, max) => Math.max(min, Math.min(max, Number(n) || min));
  const paper = s.paper === 'Letter' ? 'letter' : 'A4';
  style.textContent = '@page { size:' + paper + '; margin:' + num(s.marginV,20,100) + 'px ' + num(s.marginH,20,100) + 'px; }'
    + ':root{--resume-font:"' + font + '";--resume-size:' + num(s.fontSize,11,19) + 'px;--resume-leading:' + num(s.lineHeight,1.05,1.8)
    + ';--resume-accent:' + (/^#[0-9a-f]{6}$/i.test(s.accent) ? s.accent : '#377bb5') + ';}';
  let custom = document.getElementById('repository-css');
  if (custom) custom.remove();
  // Loaded as text rather than HTML. The document CSP blocks remote assets.
  if (s.theme === 'repository') {
    custom = document.createElement('style');
    custom.id = 'repository-css';
    custom.textContent = request.css;
    document.head.append(custom);
  }
  if (previous) { previous.chunker.destroy(); previous.polisher.destroy(); }
  document.body.replaceChildren();
  const source = document.createElement('div');
  source.id = 'vue-smart-pages-preview';
  source.innerHTML = request.html;
  // Small local outline icons cover the contact fields without a remote Iconify request.
  for (const icon of source.querySelectorAll('span.iconify')) {
    const paths = iconPaths[icon.dataset.icon];
    if (paths) icon.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true">' + paths + '</svg>';
    else icon.remove();
  }
  for (const child of source.children) {
    if (child.tagName === 'H2') break;
    if (child.tagName === 'DL') child.classList.add('contact-details');
  }
  for (const row of source.querySelectorAll('dl:not(.contact-details)')) {
    row.classList.add('keep-with-next');
    if (row.children.length === 3) row.classList.add('position-heading');
  }
  for (const p of source.querySelectorAll('p')) {
    if (p.children.length === 1 && p.firstElementChild.tagName === 'EM') p.classList.add('keep-with-next');
  }
  for (const link of source.querySelectorAll('a[href]')) {
    link.target = '_blank'; link.rel = 'noopener noreferrer';
  }
  document.body.append(source);
  await document.fonts.ready;
  // Load the selected font before measuring the document (including bold and italic).
  await Promise.allSettled([document.fonts.load('15px "'+font+'"'), document.fonts.load('bold 15px "'+font+'"'), document.fonts.load('italic 15px "'+font+'"')]);
  // Measure role rows at the real paper content width, not the browser viewport.
  source.style.width = 'calc(' + (s.paper === 'Letter' ? '8.5in' : '210mm') + ' - ' + (2*num(s.marginH,20,100)) + 'px)';
  for (const row of source.querySelectorAll('.position-heading')) {
    const initial = parseFloat(getComputedStyle(row).fontSize);
    let size = initial;
    while (row.scrollWidth > row.clientWidth + 1 && size > initial * .75) {
      size -= .25;
      row.style.fontSize = size + 'px';
    }
    // Unusually long titles may wrap, but company/location and dates stay intact.
    if (row.scrollWidth > row.clientWidth + 1) {
      row.style.gridTemplateColumns = 'minmax(0,1fr) max-content max-content';
      row.firstElementChild.style.whiteSpace = 'normal';
    }
  }
  source.style.removeProperty('width');
  const previewer = new Paged.Previewer();
  previous = previewer;
  // Parse a detached fragment so Paged.js assigns a reference to the outer wrapper too.
  const markup = source.outerHTML;
  source.remove();
  const flow = await previewer.preview(markup, ['/resume.css', { [location.href]: style.textContent + (custom?.textContent ?? '') }], document.body);
  source.remove();
  window.scrollTo(0, 0);
  setZoom(request.zoom);
  reply({type:'rendered', id, pages:flow.total, fontFallback:font === 'Minion Pro' && !document.fonts.check('15px "Minion Pro"')});
}
window.addEventListener('message', async event => {
  if (event.origin !== location.origin || event.source !== parent) return;
  if (event.data.type === 'zoom') return setZoom(event.data.zoom);
  if (event.data.type !== 'render') return;
  queued = event.data;
  if (running) return;
  running = true;
  while (queued) {
    const request = queued; queued = null;
    try { await draw(request); }
    catch (error) { console.error(error); reply({type:'render-error',id:request.id,message:error.message}); }
  }
  running = false;
});
reply({type:'ready'});
