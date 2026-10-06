// Klikt in demomodus als telefoon door de hele app en faalt bij fouten in de console.
// Gebruik: npm run build && npm run test:browser [-- --foto map]
import http from 'node:http';
import { readFile, mkdir } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { extname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';

const require = createRequire(import.meta.url);
function laadPlaywright() {
  for (const pad of ['playwright', '/opt/node22/lib/node_modules/playwright']) {
    try { return require(pad); } catch { /* volgende */ }
  }
  throw new Error('Playwright niet gevonden.');
}
const { chromium } = laadPlaywright();

const dist = resolve(fileURLToPath(import.meta.url), '../../../dist');
const fotoArg = process.argv.indexOf('--foto');
const fotoMap = fotoArg > -1 ? resolve(process.argv[fotoArg + 1]) : null;
if (fotoMap) await mkdir(fotoMap, { recursive: true });

const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.svg': 'image/svg+xml' };
const server = http.createServer(async (req, res) => {
  const pad = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  try {
    const bestand = join(dist, pad === '/' ? 'index.html' : pad);
    const inhoud = await readFile(bestand);
    res.writeHead(200, { 'Content-Type': TYPES[extname(bestand)] || 'application/octet-stream' });
    res.end(inhoud);
  } catch {
    res.writeHead(404);
    res.end('niet gevonden');
  }
});
await new Promise(r => server.listen(0, '127.0.0.1', r));
const basis = `http://localhost:${server.address().port}/`;

const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, locale: 'nl-NL', timezoneId: 'Europe/Amsterdam', ignoreHTTPSErrors: true });
const page = await context.newPage();
const fouten = [];
page.on('pageerror', e => fouten.push(`pagina: ${e.message}`));
// Mislukte verzoeken naar de eigen site tellen als fout. Externe lettertypes niet:
// die hangen af van het netwerk van de testomgeving.
page.on('console', m => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) fouten.push(`console: ${m.text()}`); });
page.on('requestfailed', r => {
  if (r.url().startsWith(basis)) fouten.push(`verzoek mislukt: ${r.url()} (${r.failure() && r.failure().errorText})`);
  else console.log(`(extern niet geladen: ${new URL(r.url()).host})`);
});
page.on('dialog', d => d.accept());

let n = 0;
async function foto(naam) {
  if (!fotoMap) return;
  await page.waitForTimeout(450);
  n += 1;
  await page.screenshot({ path: join(fotoMap, `${String(n).padStart(2, '0')}-${naam}.png`), fullPage: false });
}

async function stap(naam, werk) {
  try {
    await werk();
    console.log(`ok  ${naam}`);
  } catch (e) {
    console.log(`FOUT ${naam}: ${e.message}`);
    await page.screenshot({ path: join(fotoMap || '.', `fout-${naam.replace(/\W+/g, '-')}.png`) }).catch(() => {});
    throw e;
  }
}

try {
  await stap('inlogscherm toont demo-keuze', async () => {
    await page.goto(`${basis}?demo`);
    await page.getByRole('button', { name: /Mila/ }).waitFor();
    await foto('inloggen');
  });

  await stap('Mila ziet vandaag', async () => {
    await page.getByRole('button', { name: /Mila/ }).click();
    await page.locator('h1.hey').waitFor();
    assert.match(await page.locator('h1.hey').innerText(), /Mila/);
    await foto('vandaag-mila');
  });

  await stap('routine afvinken werkt bij de ring', async () => {
    const knoppen = page.locator('[data-actie="routine"]');
    const aantal = await knoppen.count();
    if (aantal) {
      await knoppen.first().click();
      await page.waitForTimeout(150);
      assert.equal(await knoppen.first().getAttribute('aria-pressed'), 'true');
      assert.match(await page.locator('#ring-vandaag-tekst').innerText(), /^1\//);
    }
  });

  await stap('week: maximaal drie taken', async () => {
    await page.goto(`${basis}?demo#week`);
    await page.locator('h1.titel', { hasText: 'Week' }).waitFor();
    const knop = page.locator('[data-actie="taak-nieuw"]');
    while (await knop.isEnabled()) {
      await knop.click();
      await page.locator('form[data-form="taak"] input[name=titel]').fill(`Test taak ${Date.now()}`);
      await page.locator('form[data-form="taak"] button[type=submit]').click();
      await page.locator('.paneel').waitFor({ state: 'detached' });
    }
    assert.ok(await knop.isDisabled());
    assert.match(await page.locator('.weekstatus').innerText(), /Vol/);
    await foto('week-vol');
    await page.locator('[data-actie="taak-af"]').first().click();
    await page.waitForTimeout(200);
    await foto('week-afgevinkt');
  });

  await stap('posts: nieuwe post plannen', async () => {
    await page.goto(`${basis}?demo#posts`);
    await page.locator('.weekstrook').waitFor();
    await foto('posts');
    await page.locator('[data-actie="post-nieuw"]').click();
    await page.locator('form[data-form="post"] textarea[name=idee]').fill('Testpost: de grill bij zonsondergang');
    await foto('post-nieuw');
    await page.locator('form[data-form="post"] button[type=submit]').first().click();
    await page.locator('.paneel').waitFor({ state: 'detached' });
    await page.locator('.post', { hasText: 'Testpost' }).waitFor();
  });

  await stap('beeldbank: uploaden met onderwerp', async () => {
    await page.goto(`${basis}?demo#upload`);
    const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64');
    await page.locator('#dropzone input[type=file]').setInputFiles([{ name: 'grill.png', mimeType: 'image/png', buffer: png }]);
    await page.locator('.voorbeeld').waitFor();
    assert.ok(await page.locator('[data-actie="upload-start"]').isDisabled(), 'eerst onderwerp kiezen');
    await page.locator('[data-actie="kies-onderwerp"][data-key="vuur"]').click();
    await foto('upload-gekozen');
    await page.locator('[data-actie="upload-start"]').click();
    await page.locator('.voorbeeld.klaar').waitFor({ timeout: 10000 });
    await foto('upload-klaar');
    await page.locator('.bestand', { hasText: 'grill' }).first().waitFor();
  });

  await stap('zonder Google-koppeling: uploaden via Drive', async () => {
    await page.goto(`${basis}?demo&zonderdrive#upload`);
    const knop = page.getByRole('link', { name: /Open de beeldbank/ });
    await knop.waitFor();
    assert.match(await knop.getAttribute('href'), /drive\/folders\/1CPgrC9ULe5qR9n-LPCrrvXMlwegjhQ1c$/);
    assert.equal(await page.locator('a.sticker').count(), 12);
    assert.equal(await page.locator('#dropzone').count(), 0);
    await foto('upload-via-drive');
  });

  await stap('cijfers opslaan', async () => {
    await page.goto(`${basis}?demo#cijfers`);
    await page.locator('#m-ig_volgers_pellens').fill('4012');
    await page.locator('form[data-form="cijfers"] button[type=submit]').click();
    await page.waitForTimeout(300);
    await foto('cijfers');
  });

  await stap('doelen en plan', async () => {
    await page.goto(`${basis}?demo#doelen`);
    await page.locator('.doel').first().waitFor();
    await foto('doelen');
    await page.goto(`${basis}?demo#plan`);
    await page.locator('.maand.nu').waitFor();
    await foto('plan');
  });

  await stap('maandagkwartier in drie stappen', async () => {
    await page.goto(`${basis}?demo#maandag`);
    await page.locator('form[data-form="kwartier-cijfers"]').waitFor();
    await foto('maandag-1');
    await page.locator('form[data-form="kwartier-cijfers"] button[type=submit]').click();
    await page.locator('h2', { hasText: 'Vorige week' }).waitFor();
    await page.locator('[data-actie="kwartier-stap"][data-stap="3"]').click();
    await page.locator('h2', { hasText: 'Drie taken' }).waitFor();
    await page.locator('[data-actie="kwartier-klaar"]').click();
    await page.waitForURL(/#week/);
  });

  await stap('weergave wisselen blijft bewaard', async () => {
    await page.goto(`${basis}?demo#meer`);
    await page.locator('[data-actie="thema"][data-thema="licht"]').click();
    assert.equal(await page.evaluate(() => document.documentElement.dataset.thema), 'licht');
    await page.reload();
    await page.locator('.tegels').waitFor();
    assert.equal(await page.evaluate(() => document.documentElement.dataset.thema), 'licht');
    await foto('meer-licht');
    await page.locator('[data-actie="thema"][data-thema="donker"]').click();
  });

  await stap('Daan spreekt in en keurt goed', async () => {
    await page.goto(`${basis}?demo#meer`);
    await page.locator('[data-actie="demo-als"][data-email="daan@demo"]').click();
    await page.locator('h1.hey', { hasText: 'Daan' }).waitFor();
    await foto('vandaag-daan');
    await page.goto(`${basis}?demo#posts/tekst`);
    await page.locator('.post .cta').first().waitFor();
    await page.locator('.post', { hasText: 'Testpost' }).click();
    await page.locator('#post-tekst').fill('De grill brandt al sinds vier uur. Kom kijken.');
    await foto('inspreken');
    await page.locator('button[value="goedkeuren"]').click();
    await page.locator('.paneel').waitFor({ state: 'detached' });
    await page.locator('[data-actie="post-filter"][data-status="alles"]').click();
    const kaart = page.locator('.post', { hasText: 'Testpost' });
    assert.match(await kaart.innerText(), /Tekst klaar/);
  });

  await stap('Mila kan niet goedkeuren, wel inplannen', async () => {
    await page.goto(`${basis}?demo#meer`);
    await page.locator('[data-actie="demo-als"][data-email="mila@demo"]').click();
    await page.goto(`${basis}?demo#posts`);
    await page.locator('.post', { hasText: 'Testpost' }).click();
    assert.equal(await page.locator('button[value="goedkeuren"]').count(), 0);
    await page.locator('button[value="ingepland"]').click();
    await page.locator('.paneel').waitFor({ state: 'detached' });
    assert.match(await page.locator('.post', { hasText: 'Testpost' }).innerText(), /Ingepland/);
  });

  await stap('Beau ziet de eigen routines', async () => {
    await page.goto(`${basis}?demo#meer`);
    await page.locator('[data-actie="demo-als"][data-email="beau@demo"]').click();
    await page.locator('h1.hey', { hasText: 'Beau' }).waitFor();
    await foto('vandaag-beau');
    await page.goto(`${basis}?demo#meer`);
    await foto('meer');
  });

  // Laptop en groot scherm: zijbalk, overzicht, grafieken met tooltip, paneel aan de zijkant.
  const groot = await browser.newPage({ viewport: { width: 1440, height: 900 }, locale: 'nl-NL', timezoneId: 'Europe/Amsterdam' });
  groot.on('pageerror', e => fouten.push(`groot scherm: ${e.message}`));
  groot.on('console', m => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) fouten.push(`groot scherm console: ${m.text()}`); });
  const geenZijwaartsScrollen = async () => {
    const [scroll, breedte] = await groot.evaluate(() => [document.documentElement.scrollWidth, window.innerWidth]);
    assert.ok(scroll <= breedte, `pagina scrolt zijwaarts: ${scroll} > ${breedte}`);
  };

  await stap('groot scherm: overzicht met zijbalk', async () => {
    await groot.goto(`${basis}?demo`);
    await groot.locator('[data-actie="demo-als"][data-email="daan@demo"]').click();
    await groot.locator('.dash-kop h1', { hasText: 'Daan' }).waitFor();
    assert.match(groot.url(), /#overzicht$/);
    assert.ok(await groot.locator('#zijbalk').isVisible());
    assert.ok(await groot.locator('#nav').isHidden());
    assert.equal(await groot.locator('.kpis .stat').count(), 7);
    assert.equal(await groot.locator('.kalender .kal-week').count(), 2);
    assert.ok(await groot.locator('.kal-post').count() > 5);
    assert.equal(await groot.locator('.teamrij').count(), 3);
    await groot.locator('.grafiek-vlak svg').first().waitFor();
    await geenZijwaartsScrollen();
  });

  await stap('groot scherm: tooltip op grafiek en kalender', async () => {
    // De laatste week van de eerste grafiek (gasten per dienst). Scrollen verbergt de tooltip,
    // dus eerst in beeld brengen en dan pas aanwijzen.
    const raak = groot.locator('figure.grafiek').first().locator('.raak').last();
    await raak.scrollIntoViewIfNeeded();
    await groot.waitForTimeout(250);
    await raak.hover();
    await groot.locator('.tip').waitFor();
    assert.match(await groot.locator('.tip').innerText(), /wk \d+[\s\S]*Diner/);
    assert.ok(await groot.locator('.grafiek .punt.actief').count() >= 1);
    await groot.locator('.kal-post').first().hover();
    assert.match(await groot.locator('.tip').innerText(), /status/);
  });

  await stap('groot scherm: post openen in het zijpaneel', async () => {
    await groot.locator('.kal-post').first().click();
    const paneel = groot.locator('.paneel.open');
    await paneel.waitFor();
    await groot.waitForTimeout(400);
    const vak = await paneel.boundingBox();
    assert.ok(vak.x > 700 && vak.height > 800, `paneel staat niet rechts: ${JSON.stringify(vak)}`);
    await groot.keyboard.press('Escape');
    await groot.locator('.paneel').waitFor({ state: 'detached' });
  });

  await stap('groot scherm: kalender verschuift, zijbalk navigeert', async () => {
    const eersteWeek = await groot.locator('.kal-wk').first().innerText();
    await groot.locator('[data-actie="kal-verder"]').click();
    assert.notEqual(await groot.locator('.kal-wk').first().innerText(), eersteWeek);
    await groot.locator('[data-actie="kal-nu"]').click();
    assert.equal(await groot.locator('.kal-wk').first().innerText(), eersteWeek);
    for (const [pagina, kenmerk] of [['posts', '.postraster'], ['doelen', '.doelen-raster'], ['cijfers', '.cijfertabel'], ['plan', '.plan-onder']]) {
      await groot.locator(`.menu a[href="#${pagina}"]`).click();
      await groot.locator(kenmerk).first().waitFor();
      assert.equal(await groot.locator(`.menu a[href="#${pagina}"]`).getAttribute('aria-current'), 'page');
      await geenZijwaartsScrollen();
    }
  });

  await stap('groot scherm: weergave wisselen in de zijbalk', async () => {
    await groot.locator('.zij-thema [data-thema="groen"]').click();
    assert.equal(await groot.evaluate(() => document.documentElement.dataset.thema), 'groen');
    await groot.locator('.zij-thema [data-thema="donker"]').click();
  });

  await stap('van groot naar klein scherm: zijbalk weg, balk onderin terug', async () => {
    await groot.setViewportSize({ width: 390, height: 844 });
    await groot.locator('#nav').waitFor();
    assert.ok(await groot.locator('#zijbalk').isHidden());
    assert.equal(await groot.locator('#zijbalk [data-actie]').count(), 0);
  });
  await groot.close();

  assert.deepEqual(fouten, [], `Fouten in de browser:\n${fouten.join('\n')}`);
  console.log('Browsertest geslaagd.');
} finally {
  await browser.close();
  server.close();
}
