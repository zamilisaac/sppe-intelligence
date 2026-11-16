// End-to-end and calculation tests for Kecerdasan Ekonomi Bersepadu 2.0.
// Run: python3 -m http.server 8811 -d website   then: node tests/k2-e2e.js  (needs Playwright + Chromium)
const { chromium } = require('playwright');const B='http://127.0.0.1:8811';
(async()=>{const br=await chromium.launch();const ctx=await br.newContext({viewport:{width:1440,height:1000},acceptDownloads:true});const p=await ctx.newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));p.on('console',m=>{if(m.type()==='error')errs.push(m.text())});
await p.goto(B+'/#home');await p.waitForTimeout(2000);
// --- unit tests with known answers
const ut=await p.evaluate(()=>{const T=K2.ST,r=[];const eq=(n,a,b,t=1e-6)=>r.push([n,Math.abs(a-b)<t,a,b]);
 eq('growth 100->110',T.growth(100,110),10);eq('cagr 100->121 over 2',T.cagr(100,121,2),10);eq('index 150/120',T.index(150,120),125);eq('gap 90/100',T.gap(90,100),-10);
 const d=T.decompose(T.cagr(100,121,2),T.cagr(50,55,2),T.cagr(2,2.2,2));eq('decompose interaction = gLP*gE/100',d.inter,d.gLP*d.gE/100,1e-9);
 eq('pearson perfect',T.pearson([1,2,3,4],[2,4,6,8]).r,1);eq('pearson neg',T.pearson([1,2,3],[3,2,1]).r,-1);r.push(['pearson n<3 null',T.pearson([1,2],[1,2]).r===null]);
 const pr=T.project(100,10,2);eq('project y2',pr[1],121);r.push(['cagr zero start null',T.cagr(0,5,2)===null]);r.push(['gap null bench',T.gap(5,0)===null]);
 // identity check on real data: real GDP = lpc x emp
 const C=K2.CAT().I,gdp=C.find(i=>i.id==='gdp'),lpc=C.find(i=>i.id==='lpc'),emp=SITE.MET('emp');eq('identity Selangor 2025',lpc.get('selangor',2025)*emp.get('selangor',2025)*1e3/1e6,gdp.get('selangor',2025),1e-6);
 return r;});
ut.forEach(x=>console.log(x[1]?'PASS':'FAIL',x[0],x[2]!==undefined?`(${x[2]} vs ${x[3]})`:''));
// --- vertical slice: Selangor, GDP + wages, 2020-2025, integrated
await p.goto(B+'/#bina-laporan');await p.waitForTimeout(1500);
console.log('tabs:',await p.$$eval('#pg-build .seg-a',l=>l.map(a=>a.textContent).join(' | ')));
await p.selectOption('#pg-build select[data-k2="addgeo"]','selangor').catch(()=>{});
for(const id of ['prod']) await p.uncheck(`#pg-build input[data-k2ind="${id}"]`);
await p.selectOption('#pg-build select[data-k2="y0"]','2020');await p.selectOption('#pg-build select[data-k2="y1"]','2025');await p.selectOption('#pg-build select[data-k2="mode"]','intg');
await p.waitForTimeout(300);console.log('geos:',await p.$$eval('#pg-build .k2-chip',l=>l.map(x=>x.textContent.replace('×','')).join(',')),'| status:',await p.textContent('#pg-build h2 .k2-st'));
console.log('warnings:',await p.$$eval('#pg-build p.k2-warn',l=>l.length));
await p.click('#pg-build [data-k2act="gen"]');await p.waitForTimeout(2500);
console.log('preview headings:',await p.$$eval('#pg-build .pv-body h2',l=>l.map(h=>h.textContent).join(' | ')));
console.log('cross para:',(await p.$$eval('#pg-build .pv-body p',l=>l.map(x=>x.textContent).find(t=>/KDNK benar .* tumbuh/.test(t))||'NONE')).slice(0,220));
console.log('charts drawn:',await p.$$eval('#pg-build .k2-chart img',l=>l.length));
await p.screenshot({path:'shot-build.png',fullPage:false});
await p.evaluate(()=>document.querySelector('#pg-build .k2-prev').scrollIntoView());await p.waitForTimeout(500);await p.screenshot({path:'shot-build-prev.png'});
for(const k of ['docx','pdf','xlsx','zip']){const [d]=await Promise.all([p.waitForEvent('download',{timeout:120000}),p.click(`#pg-build [data-k2dl="${k}"]`)]);await d.saveAs('b.'+k);console.log('download',k,d.suggestedFilename());await p.waitForTimeout(800);}
// --- simulation
await p.goto(B+'/#simulasi');await p.waitForTimeout(1500);await p.selectOption('#pg-sim select[data-k2sim="g"]','johor');await p.waitForTimeout(1200);
console.log('sim baseline:',(await p.textContent('#pg-sim .mean')).slice(0,160));await p.screenshot({path:'shot-sim.png'});
const [ds]=await Promise.all([p.waitForEvent('download',{timeout:60000}),p.click('#pg-sim [data-k2dl="xlsx"]')]);await ds.saveAs('s.xlsx');console.log('sim xlsx',ds.suggestedFilename());
// --- workshop kit
await p.goto(B+'/#laporan-negeri');await p.waitForTimeout(1500);await p.selectOption('#pg-kit select[data-k2kit="state"]','perak');await p.waitForTimeout(600);await p.click('#pg-kit [data-k2act="kitprev"]');await p.waitForTimeout(2500);
console.log('kit sections:',await p.$$eval('#pg-kit .pv-body h2',l=>l.map(h=>h.textContent).join(' | ')));await p.screenshot({path:'shot-kit.png'});
for(const k of ['docx','pdf']){const [d]=await Promise.all([p.waitForEvent('download',{timeout:120000}),p.click(`#pg-kit [data-k2dl="${k}"]`)]);await d.saveAs('k.'+k);console.log('kit',k,d.suggestedFilename());await p.waitForTimeout(800);}
// --- explore + saved
await p.goto(B+'/#teroka');await p.waitForTimeout(1200);console.log('catalogue rows',await p.$$eval('#pg-explore .k2-cat tbody tr',l=>l.length),'unavailable',await p.$$eval('#pg-explore tr.k2-na',l=>l.length));await p.screenshot({path:'shot-explore.png'});
await p.goto(B+'/#bina-laporan');await p.waitForTimeout(800);p.on('dialog',d=>d.accept('Ujian Selangor'));await p.click('#pg-build [data-k2act="save"]');await p.goto(B+'/#tersimpan');await p.waitForTimeout(1000);console.log('saved rows',await p.$$eval('#pg-saved tbody tr',l=>l.map(r=>r.cells[0].textContent).join(',')));
// regression: other pages
for(const h of ['home','negeri','productivity','gdp','wages','labour','integrated','banding','metodologi','reports']){await p.goto(B+'/#'+h);await p.waitForTimeout(900);}
console.log('errors',errs);await br.close()})();
