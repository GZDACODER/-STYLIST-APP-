// Retakes the homepage's phone screenshots (public/home/*.webp) from the live demo
// accounts: node scripts/capture-homepage-shots.cjs [public|dash|money]. For
// the dashboard shots, give the demo a realistic month first and remove it after
// (see docs/BUILD_LOG.md, Nov 24).
// Captures real Clientele screens from the live demos for the homepage.
const { chromium, devices } = require('playwright'); const sharp=require('sharp'); const S='https://www.clientelesuite.com';
const OUT=require('path').join(__dirname,'..','public','home')+'/'; const which=process.argv[2]||'all';
const HIDE=`[aria-label^="Show tips"],.demo-banner,.gd-layer,.gd-help-title,[data-guide-layer],.bk-demo-note,.as-fab,[class*="assistant-fab"],nextjs-portal,.aw-launch,.aw-fab,[class^="aw-"]{display:none!important}`;
async function shot(p, name, {y=0, h=700}={}) {
  await p.addStyleTag({content:HIDE}); await p.waitForTimeout(600);
  const buf=await p.screenshot({clip:{x:0,y,width:390,height:h}});
  await sharp(buf).resize({width:620}).webp({quality:78}).toFile(OUT+name+'.webp'); console.log('saved',name);
}
const esc=async(p)=>{ await p.waitForTimeout(1200); for(let i=0;i<6;i++){ if(await p.locator('.gd-card').isVisible().catch(()=>false)) await p.keyboard.press('Escape'); await p.waitForTimeout(200);} };
(async()=>{const b=await chromium.launch();
const ctx=await b.newContext({...devices['iPhone 13']}); const p=await ctx.newPage();
const scrollTo=async(sel,off=12)=>{ const y=await p.locator(sel).first().evaluate((el,o)=>{const r=el.getBoundingClientRect(); window.scrollTo(0, window.scrollY+r.top-o); return 0;},off); await p.waitForTimeout(400); };
if (which==='all'||which==='public') {
  // Booking page: pick a service and a day so the times show.
  await p.goto(S+'/book/maison-demo-1f355e',{waitUntil:'load'}); await esc(p);
  await p.click('.choice:has-text("Silk press")'); await p.waitForTimeout(900); await p.locator('.date-choice').nth(1).click(); await p.waitForTimeout(900);
  await scrollTo('.bk-flow .card:has-text("Date & time")', -10); await shot(p,'booking');
  // Each trade's services.
  for (const [k,slug] of [['stylist','maison-demo-1f355e'],['barber','demo-barber-7d5224'],['tattoo','demo-tattoo-f0647d'],['tutor','demo-tutor-49395e']]) {
    await p.goto(S+'/book/'+slug,{waitUntil:'load'}); await esc(p); await scrollTo('.bk-flow .card:has(h2:text("Service")), .bk-flow .card:has(h2:text("Subject"))', -10); await shot(p,'trade-'+k);
  }
  await p.goto(S+'/p/maison-demo',{waitUntil:'load'}); await esc(p); await shot(p,'found');
}
if (which==='all'||which==='dash') {
  await p.goto(S+'/demo',{waitUntil:'load'}); await esc(p);
  await p.goto(S+'/dashboard/today',{waitUntil:'load'}); await esc(p); await scrollTo('.db-slot', 150); await shot(p,'regulars');
  await p.goto(S+'/dashboard/clients',{waitUntil:'load'}); await esc(p); await shot(p,'clients');
  await p.goto(S+'/dashboard/reports',{waitUntil:'load'}); await esc(p); await scrollTo('.in-stats', 70); await shot(p,'insights');
}
if (which==='all'||which==='dash'||which==='money') {
  await p.goto(S+'/dashboard/money?view=month',{waitUntil:'load'}); await esc(p); await scrollTo('.mn-summary', 70); await shot(p,'money');
}
await b.close();})()
