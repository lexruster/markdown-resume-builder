const $ = id => document.getElementById(id);
const defaults = { paper:'A4', theme:'clean', font:'Source Serif 4', fontSize:15, lineHeight:1.3, marginV:50, marginH:45, accent:'#377bb5' };
let loading = false, selectionRequest = 0, selectionController;
let catalog, generated, ready = false, rendering = false, generating = false, revision = 0, zoom = .85;
const controls = Object.keys(defaults);
const settings = () => Object.fromEntries(controls.map(key => [key, ['fontSize','lineHeight','marginV','marginH'].includes(key) ? Number($(key).value) : $(key).value]));
const key = () => 'resume-builder:layout:' + $('application').value;
function message(text, error = false) {
  $('status').hidden = !text || error;
  $('errors').hidden = !text || !error;
  $(error ? 'errors' : 'status').textContent = text;
}
function actions() {
  $('print').disabled = !generated || rendering || generating;
  $('zoom-in').disabled = rendering || generating;
  $('zoom-out').disabled = rendering || generating;
  $('download').disabled = !generated || generating;
  $('generate').disabled = generating || loading || !$('application').value;
  $('generate-label').textContent = generated ? 'Regenerate resume' : 'Generate resume';
  $('profile').disabled = generating || !catalog?.profiles.length;
  $('application').disabled = generating || !$('application').options.length;
  $('refresh').disabled = generating;
}
function clearPreview() {
  generated = undefined;
  revision++;
  rendering = false;
  $('preview').hidden = true;
  $('empty').hidden = false;
  $('failure').hidden = true;
  $('preview-title').textContent = 'Your next opportunity starts here.';
  $('page-count').textContent = 'PREVIEW';
  $('preview-state').textContent = 'Choose an application, then generate.';
  $('output-path').textContent = 'Generated Markdown is saved to your configured export folder.';
  message('');
  actions();
}
function loadSettings() {
  let saved;
  try { saved = JSON.parse(localStorage.getItem(key())); } catch {}
  for (const field of controls) $(field).value = saved?.[field] ?? defaults[field];
  // Discard stale/invalid persisted values using the native controls' validity constraints.
  for (const field of controls) if (!$(field).value || !$(field).checkValidity()) $(field).value = defaults[field];
  updateLabels();
}
function updateLabels() {
  $('fontSize-value').value = $('fontSize').value + ' px';
  $('lineHeight-value').value = Number($('lineHeight').value).toFixed(2);
}
function applications(preferred) {
  $('application').replaceChildren();
  for (const app of catalog.applications.filter(a => a.profile === $('profile').value)) {
    $('application').add(new Option(app.id, app.id));
  }
  preferred ??= 'default';
  if ([...$('application').options].some(o => o.value === preferred)) $('application').value = preferred;
  $('selection-description').textContent = $('application').options.length
    ? 'Shared profile. Tailored application.' : 'No applications found for this profile.';
  return selectApplication();
}
async function refresh() {
  const oldProfile = $('profile').value, oldApplication = $('application').value;
  try {
    const response = await fetch('/api/catalog');
    const data = await response.json();
    if (!response.ok) throw new Error(data.error);
    catalog = data;
    $('profile').replaceChildren(...data.profiles.map(p => new Option(p.name + ' · ' + p.id, p.id)));
    if (data.profiles.some(p => p.id === oldProfile)) $('profile').value = oldProfile;
    await applications(oldApplication);
    if (data.errors.length) message(data.errors.join('\n'), true);
    else if (!data.profiles.length) message('No profiles found. Add a profile with personal.json and Markdown sections, then refresh.', true);
  } catch (error) { message(error.message, true); }
}
function render() {
  if (!generated || !ready) return;
  rendering = true;
  zoom = Math.min(zoom, Math.max(.35, ($('canvas').clientWidth - 40) / (settings().paper === 'Letter' ? 816 : 794)));
  $('zoom-value').value = Math.round(zoom * 100) + '%';
  const id = ++revision;
  $('preview').hidden = false;
  $('empty').hidden = true;
  $('failure').hidden = true;
  $('preview-state').textContent = 'Laying out pages…';
  $('preview').contentWindow.postMessage({ type:'render', id, html:generated.html, css:generated.css, settings:settings(), zoom }, location.origin);
  actions();
}
window.addEventListener('message', event => {
  if (event.origin !== location.origin || event.source !== $('preview').contentWindow) return;
  if (event.data.type === 'ready') { ready = true; render(); }
  if (event.data.id !== revision) return;
  if (event.data.type === 'rendered') {
    rendering = false;
    $('page-count').textContent = event.data.pages + (event.data.pages === 1 ? ' PAGE' : ' PAGES');
    $('preview-state').textContent = settings().paper + ' · Ready to print';
    if (event.data.fontFallback) message('Minion Pro is not installed. The preview and PDF use Source Serif 4 instead.');
    actions();
  }
  if (event.data.type === 'render-error') {
    rendering = false;
    $('preview-state').textContent = 'Preview failed';
    $('preview').hidden = true;
    message('Preview failed: ' + event.data.message, true);
    $('failure').textContent = event.data.message;
    $('failure').hidden = false;
    actions();
    $('print').disabled = true;
  }
});
function showResume(result) {
  generated = result;
  $('preview-title').textContent = result.application;
  $('output-path').textContent = result.output;
  $('output-path').title = result.output;
  document.title = result.application + ' · Resume Builder';
  render();
}
async function selectApplication() {
  const request = ++selectionRequest;
  selectionController?.abort();
  selectionController = new AbortController();
  clearPreview();
  loadSettings();
  if (!$('application').value) { loading = false; actions(); return; }
  loading = true;
  message('Loading saved Markdown…'); actions();
  const params = new URLSearchParams({profile:$('profile').value,application:$('application').value});
  try {
    const response = await fetch('/api/export?' + params, {signal:selectionController.signal});
    const result = await response.json();
    if (request !== selectionRequest) return;
    if (!response.ok) throw new Error(result.error);
    if (result.exists) {
      message('Showing saved Markdown. Regenerate to rebuild from source files.');
      showResume(result);
    } else {
      message('No saved Markdown yet. Generate this resume to create it.');
    }
  } catch (error) {
    if (request === selectionRequest && error.name !== 'AbortError') message(error.message, true);
  } finally {
    if (request === selectionRequest) { loading = false; actions(); }
  }
}
$('generate').addEventListener('click', async () => {
  generated = undefined; generating = true;
  $('preview').hidden = true; $('empty').hidden = false;
  message('Generating from the latest files on disk…'); actions();
  try {
    const response = await fetch('/api/generate', {
      method:'POST', headers:{'Content-Type':'application/json','X-Resume-Token':catalog.token},
      body:JSON.stringify({ profile:$('profile').value, application:$('application').value }),
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error);
    showResume(result);
    message('Markdown saved. The preview uses the same generated content.');
  } catch (error) { message(error.message, true); }
  finally { generating = false; actions(); }
});
$('profile').addEventListener('change', () => applications());
$('application').addEventListener('change', selectApplication);
$('refresh').addEventListener('click', refresh);
let timer;
for (const field of controls) $(field).addEventListener('input', () => {
  updateLabels();
  if (!controls.every(c => $(c).checkValidity())) return;
  try { localStorage.setItem(key(), JSON.stringify(settings())); } catch {}
  // Immediately disable print; otherwise it could print the old layout during debounce.
  if (generated) { rendering = true; actions(); }
  clearTimeout(timer); timer = setTimeout(render, 250);
});
$('reset').addEventListener('click', () => {
  try { localStorage.removeItem(key()); } catch {}
  loadSettings(); render();
});
function setZoom(value) {
  zoom = Math.max(.35, Math.min(1.5, value));
  $('zoom-value').value = Math.round(zoom * 100) + '%';
  $('preview').contentWindow.postMessage({ type:'zoom', zoom }, location.origin);
}
$('zoom-in').addEventListener('click', () => setZoom(zoom + .1));
$('zoom-out').addEventListener('click', () => setZoom(zoom - .1));
let printWindow, printPayload;
window.addEventListener('message', event => {
  if (event.origin !== location.origin || event.source !== printWindow || event.data.type !== 'print-ready') return;
  printWindow.postMessage(printPayload, location.origin);
});
$('print').addEventListener('click', () => {
  if (!generated || rendering) return;
  const doc = $('preview').contentDocument;
  printPayload = {
    type:'print-document', title:generated.application,
    html:doc.body.innerHTML,
    styles:[...doc.head.querySelectorAll('style,link[rel="stylesheet"]')].map(node =>
      node.tagName === 'LINK' ? {href:node.href} : {text:node.textContent}),
  };
  printWindow = window.open('/print.html','_blank');
  if (!printWindow) message('Allow pop-ups for this local site to open the print document.', true);
});
$('download').addEventListener('click', () => {
  if (!generated) return;
  const url = URL.createObjectURL(new Blob([generated.markdown], {type:'text/markdown;charset=utf-8'}));
  const link = Object.assign(document.createElement('a'), {href:url, download:generated.application+'.md'});
  link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
});
updateLabels();
refresh();
