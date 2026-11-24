// Retakes the homepage pictures (public/home/*.webp) from the live demo:
//   node scripts/capture-homepage-shots.cjs [public|dash]
// "public": phone shots of the booking page, each trade and the public profile.
// "dash": the redesigned dashboard at desktop size (Home, Today, Clients,
// Money, Insights) plus Today on a phone. For realistic numbers, add the
// temporary month in scripts/homepage-demo-seed.sql first and remove it after
// (see docs/BUILD_LOG.md).
const { chromium, devices } = require('playwright'); const sharp = require('sharp'); const S = 'https://www.clientelesuite.com';
const OUT = require('path').join(__dirname, '..', 'public', 'home') + '/'; const which = process.argv[2] || 'all';
const HIDE = `[aria-label^="Show tips"],.demo-banner,.gd-layer,.gd-help-title,[data-guide-layer],.bk-demo-note,.as-fab,[class*="assistant-fab"],nextjs-portal,.aw-launch,.aw-fab,[class^="aw-"],.sh-fab{display:none!important}`;
const esc = async (p) => { await p.waitForTimeout(1200); for (let i = 0; i < 6; i++) { await p.keyboard.press('Escape'); await p.waitForTimeout(150); } };
async function phone(p, name, { y = 0, h = 700 } = {}) {
  await p.addStyleTag({ content: HIDE }); await p.waitForTimeout(600);
  const buf = await p.screenshot({ clip: { x: 0, y, width: 390, height: h } });
  await sharp(buf).resize({ width: 620 }).webp({ quality: 78 }).toFile(OUT + name + '.webp'); console.log('saved', name);
}
async function desk(p, name, { scrollSel = null, off = 0 } = {}) {
  await p.addStyleTag({ content: HIDE });
  if (scrollSel) await p.locator(scrollSel).first().evaluate((el, o) => window.scrollTo(0, window.scrollY + el.getBoundingClientRect().top - o), off);
  await p.waitForTimeout(700);
  const buf = await p.screenshot();
  await sharp(buf).resize({ width: 1600 }).webp({ quality: 80 }).toFile(OUT + name + '.webp'); console.log('saved', name);
}
(async () => {
  const b = await chromium.launch();
  if (which === 'all' || which === 'public') {
    const p = await (await b.newContext({ ...devices['iPhone 13'] })).newPage();
    const scrollTo = async (sel, off = 12) => { await p.locator(sel).first().evaluate((el, o) => window.scrollTo(0, window.scrollY + el.getBoundingClientRect().top - o), off); await p.waitForTimeout(400); };
    await p.goto(S + '/book/maison-demo-1f355e', { waitUntil: 'load' }); await esc(p);
    await p.click('.choice:has-text("Silk press")'); await p.waitForTimeout(900); await p.locator('.date-choice').nth(1).click(); await p.waitForTimeout(900);
    await scrollTo('.bk-flow .card:has-text("Date & time")', -10); await phone(p, 'booking');
    for (const [k, slug] of [['stylist', 'maison-demo-1f355e'], ['barber', 'demo-barber-7d5224'], ['tattoo', 'demo-tattoo-f0647d'], ['tutor', 'demo-tutor-49395e']]) {
      await p.goto(S + '/book/' + slug, { waitUntil: 'load' }); await esc(p); await scrollTo('.bk-flow .card:has(h2:text("Service")), .bk-flow .card:has(h2:text("Subject"))', -10); await phone(p, 'trade-' + k);
    }
    await p.goto(S + '/p/maison-demo', { waitUntil: 'load' }); await esc(p); await phone(p, 'found');
  }
  if (which === 'all' || which === 'dash') {
    const ctx = await b.newContext({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 2 });
    const p = await ctx.newPage();
    await p.goto(S + '/demo', { waitUntil: 'load' }); await esc(p);
    const go = async (path) => { await p.goto(S + path, { waitUntil: 'networkidle' }); await esc(p); };
    await go('/dashboard'); await desk(p, 'dash-home');
    await go('/dashboard/today'); await desk(p, 'dash-today');
    await go('/dashboard/clients'); await desk(p, 'dash-clients');
    await go('/dashboard/money?view=month'); await desk(p, 'dash-money');
    await go('/dashboard/reports?tab=clients'); await desk(p, 'dash-insights');
    // Today on a phone (the hero's small screen on narrow layouts).
    const m = await (await b.newContext({ ...devices['iPhone 13'], storageState: await ctx.storageState() })).newPage();
    await m.goto(S + '/dashboard/today', { waitUntil: 'networkidle' }); await esc(m); await phone(m, 'dash-today-phone', { h: 760 });
  }
  await b.close();
})();
