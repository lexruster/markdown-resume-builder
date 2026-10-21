import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { chromium } from 'playwright';
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';
import { createResumeServer } from '../../scripts/ui-server.mjs';

test('printed top-level documents preserve every page and bullet across paper, theme and font changes', {timeout:120000}, async () => {
  const prefix=path.join(os.tmpdir(),'resume-print-test-');
  const root=await fs.mkdtemp(prefix);
  let server, browser;
  const write=async (file,text)=>{
    const target=path.join(root,file);
    await fs.mkdir(path.dirname(target),{recursive:true});
    await fs.writeFile(target,text);
  };
  try {
    await write('profiles/example/personal.json','{"fullName":"Example Person"}');
    await write('profiles/example/header.md','# {{fullName}}\n\nperson@example.com\n  : Example City');
    const bullets=Array.from({length:65},(_,i)=>'- ENTRY-'+String(i).padStart(2,'0')+' Delivered a meaningful customer outcome by simplifying a complicated workflow and building a reusable service integration.');
    await write('profiles/example/experience.md','## Experience\n\n**Senior Software Engineer / Team Lead**\n  : **Example Platform Company**, Woodland Hills, CA\n  : 2020 - Present\n##\n\n'+bullets.join('\n'));
    await write('applications/example/application.json','{"profile":"example"}');
    await write('applications/example/resume.md.hbs','{{> header}}\n\n{{> experience}}');
    await write('style.css','#vue-smart-pages-preview h2 {color:#285575} #vue-smart-pages-preview p {margin:0 0 7px}');
    await write('out/example.md', '# Saved Export'+String.fromCharCode(10,10)+'This is the existing exported resume.');
    await write('applications/fresh/application.json','{"profile":"example"}');
    await write('applications/fresh/resume.md.hbs','{{> header}}');
    const savedTime=(await fs.stat(path.join(root,'out/example.md'))).mtimeMs;
    server=await createResumeServer({profilesRoot:path.join(root,'profiles'),applicationsRoot:path.join(root,'applications'),outputDir:path.join(root,'out'),cssPath:path.join(root,'style.css')});
    await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
    browser=await chromium.launch({channel:process.env.RESUME_BROWSER_CHANNEL || 'chrome',headless:true});
    const context=await browser.newContext({viewport:{width:1400,height:1000}});
    // Suppress the native modal; page.pdf below exercises actual Chromium print rendering.
    await context.addInitScript(()=>{window.print=()=>{document.documentElement.dataset.printInvoked='true';};});
    const page=await context.newPage();
    await page.goto('http://127.0.0.1:'+server.address().port);
    let generationRequests=0;
    page.on('request',request=>{if(request.url().endsWith('/api/generate'))generationRequests++;});
    await page.selectOption('#application','example');
    await page.waitForFunction(()=>!document.getElementById('print').disabled);
    assert.equal(await page.locator('#generate-label').innerText(),'Regenerate resume');
    assert.equal(generationRequests,0,'Selecting an existing export must not run generation');
    assert.equal((await fs.stat(path.join(root,'out/example.md'))).mtimeMs,savedTime);
    assert.match(await page.frames().find(frame=>frame.url().endsWith('/preview.html')).locator('body').first().innerText(),/Saved Export/);
    await page.selectOption('#application','fresh');
    await page.waitForFunction(()=>!document.getElementById('generate').disabled);
    assert.equal(await page.locator('#generate-label').innerText(),'Generate resume');
    assert.equal(await page.locator('#print').isEnabled(),false,'Missing export must clear the previous preview');
    await page.selectOption('#application','example');
    await page.waitForFunction(()=>!document.getElementById('print').disabled);
    await page.click('#generate');
    await page.waitForFunction(()=>!document.getElementById('print').disabled);
    assert.equal(generationRequests,1,'Regenerate must explicitly rebuild the selected application');
    assert.match(await fs.readFile(path.join(root,'out/example.md'),'utf8'),/Example Person/);
    for(const [paper,theme,font] of [['A4','clean','Source Serif 4'],['Letter','clean','Arial'],['A4','repository','Source Serif 4'],['Letter','repository','Minion Pro']]){
      await page.selectOption('#paper',paper);
      await page.selectOption('#theme',theme);
      await page.selectOption('#font',font);
      await page.waitForFunction(()=>!document.getElementById('print').disabled);
      const count=Number((await page.locator('#page-count').innerText()).match(/\d+/)[0]);
      assert.ok(count>=2,'Fixture must span multiple pages');
      const popupEvent=page.waitForEvent('popup');
      await page.click('#print');
      const popup=await popupEvent;
      await popup.waitForFunction(()=>document.documentElement.dataset.printInvoked==='true');
      assert.equal(popup.url().endsWith('/print.html'),true,'Print in its own top-level page');
      assert.ok(await popup.locator('[data-id="vue-smart-pages-preview"]').evaluateAll(nodes=>nodes.length>0 && nodes.every(n=>n.hasAttribute('data-ref'))),'Every split outer wrapper must retain its Paged.js reference');
      const heading = await popup.locator('.position-heading').evaluate(row => {
        const boxes = [...row.children].map(cell => {
          const range = document.createRange(); range.selectNodeContents(cell);
          return {height:cell.getBoundingClientRect().height, lines:range.getClientRects().length, width:cell.getBoundingClientRect().width};
        });
        return {boxes,lineHeight:parseFloat(getComputedStyle(row).lineHeight),width:row.getBoundingClientRect().width};
      });
      for (const box of heading.boxes) assert.ok(box.height <= heading.lineHeight + 2,'Position title, company/address and dates must stay on one line');
      assert.ok(heading.boxes.reduce((sum,b)=>sum+b.width,0)+20 <= heading.width+2,'Heading columns must fit without overlaps');
      assert.ok(await popup.locator('.section-separator').count()>0,'Intentional Markdown divider must be preserved');
      const border=await popup.locator('.section-separator').first().evaluate(node=>getComputedStyle(node).borderBottomWidth);
      assert.equal(border,'1px','The divider must be visible in print');
      const pdf=await getDocument({data:new Uint8Array(await popup.pdf({preferCSSPageSize:true,printBackground:true}))}).promise;
      assert.equal(pdf.numPages,count,paper+' '+theme+' page count');
      let all='';
      for(let index=1;index<=pdf.numPages;index++){
        const pdfPage=await pdf.getPage(index);
        const text=(await pdfPage.getTextContent()).items.map(item=>item.str??'').join('');
        assert.ok(text.length>150,'Printed page '+index+' must contain body text, not only the heading');
        all+=text;
        const [,,width,height]=pdfPage.view;
        assert.ok(Math.abs(width-(paper==='A4'?595:612))<2);
        assert.ok(Math.abs(height-(paper==='A4'?842:792))<2);
      }
      for(let i=0;i<65;i++)assert.equal(all.split('ENTRY-'+String(i).padStart(2,'0')).length-1,1,'Missing or duplicated printed entry '+i);
      assert.doesNotMatch(all,/Resume Studio|Print \/ Save PDF/);
      await pdf.cleanup();
      await popup.close();
    }
    await browser.close(); browser=undefined;
  } finally {
    if(browser)await browser.close();
    if(server)await new Promise(resolve=>server.close(resolve));
    if(!path.resolve(root).startsWith(path.resolve(prefix)))throw new Error('Unexpected temporary directory');
    await fs.rm(root,{recursive:true,force:true});
  }
});
