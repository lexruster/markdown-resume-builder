// Print a top-level document. Chromium can clip fragmented columns when printing an iframe.
const sender = window.opener;
let received = false;
window.addEventListener('message', async event => {
  if (event.origin !== location.origin || event.source !== sender || event.data.type !== 'print-document' || received) return;
  received = true;
  const {title, html, styles} = event.data;
  document.title = title;
  for (const item of styles) {
    if (item.href) {
      const url = new URL(item.href, location.origin);
      if (url.origin !== location.origin) continue;
      const link = document.createElement('link');
      link.rel = 'stylesheet'; link.href = url.href;
      document.head.append(link);
      await new Promise((resolve,reject) => { link.onload=resolve; link.onerror=reject; });
    } else {
      const style = document.createElement('style');
      style.textContent = item.text;
      document.head.append(style);
    }
  }
  document.documentElement.style.setProperty('--preview-zoom','1');
  document.body.innerHTML = html;
  const bar = document.createElement('div');
  bar.className = 'print-actions';
  const button = document.createElement('button');
  button.textContent = 'Print / Save PDF';
  button.addEventListener('click', () => window.print());
  bar.append(button); document.body.prepend(bar);
  const screen = document.createElement('style');
  screen.textContent = '.print-actions{position:fixed;top:12px;right:20px;z-index:9999}.print-actions button{padding:10px 16px;background:#244f51;color:white;border:0;border-radius:6px;cursor:pointer}@media print{.print-actions{display:none!important}}';
  document.head.append(screen);
  await document.fonts.ready;
  await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
  document.documentElement.dataset.printReady = 'true';
  window.print();
});
if (sender) sender.postMessage({type:'print-ready'},location.origin);
else document.getElementById('loading').textContent = 'Use Print / Save PDF from the resume studio to open this page.';
