// Test het echte inlogpad (geen demo) tegen een nagebootste Supabase-client:
// account maken, mail bevestigen, inloggen, uitloggen en een buitenstaander weigeren.
import http from 'node:http';
import { readFile } from 'node:fs/promises';
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

const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.svg': 'image/svg+xml' };
const server = http.createServer(async (req, res) => {
  const pad = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  try {
    const bestand = join(dist, pad === '/' ? 'index.html' : pad);
    res.writeHead(200, { 'Content-Type': TYPES[extname(bestand)] || 'application/octet-stream' });
    res.end(await readFile(bestand));
  } catch {
    res.writeHead(404);
    res.end();
  }
});
await new Promise(r => server.listen(0, '127.0.0.1', r));
const basis = `http://localhost:${server.address().port}/`;

// Een kleine Supabase-namaak: gebruikers, één teamlid, lege tabellen.
const NEP_SUPABASE = `
(function () {
  var gebruikers = JSON.parse(localStorage.getItem('nep-gebruikers') || '{"vreemde@test.nl":{"pw":"geheim123","bevestigd":true}}');
  var sessie = JSON.parse(localStorage.getItem('nep-sessie') || 'null');
  var team = [{ email: 'mila@test.nl', naam: 'Mila', rol: 'social', actief: true }];
  window.nepLog = JSON.parse(localStorage.getItem('nep-log') || '[]');
  function bewaar() {
    localStorage.setItem('nep-gebruikers', JSON.stringify(gebruikers));
    localStorage.setItem('nep-sessie', JSON.stringify(sessie));
    localStorage.setItem('nep-log', JSON.stringify(window.nepLog));
  }
  function antwoord(data, error) { return Promise.resolve({ data: data, error: error || null }); }
  function vraag(tabel) {
    var filters = {};
    var q = {
      select: function () { return q; }, order: function () { return q; }, limit: function () { return q; },
      gte: function () { return q; }, or: function () { return q; }, match: function () { return q; },
      eq: function (k, v) { filters[k] = v; return q; },
      insert: function () { return q; }, update: function () { return q; }, upsert: function () { return q; }, delete: function () { return q; },
      maybeSingle: function () { return antwoord(rijen()[0] || null); },
      single: function () { return antwoord(rijen()[0] || null); },
      then: function (ok, fout) { return antwoord(rijen()).then(ok, fout); }
    };
    function rijen() {
      if (!sessie) return [];
      var lid = team.some(function (t) { return t.email === sessie.user.email; });
      if (!lid) return [];
      if (tabel === 'teamleden') return team.filter(function (t) { return !filters.email || t.email === filters.email; });
      return [];
    }
    return q;
  }
  window.supabase = { createClient: function () { return {
    auth: {
      onAuthStateChange: function () { return { data: { subscription: { unsubscribe: function () {} } } }; },
      getSession: function () { return antwoord({ session: sessie }); },
      signUp: function (a) {
        window.nepLog.push('signUp:' + a.email + ':' + (a.options && a.options.emailRedirectTo));
        if (gebruikers[a.email]) { bewaar(); return antwoord({ user: null, session: null }, { message: 'User already registered' }); }
        gebruikers[a.email] = { pw: a.password, bevestigd: false };
        bewaar();
        return antwoord({ user: { email: a.email }, session: null });
      },
      signInWithPassword: function (a) {
        var g = gebruikers[a.email];
        if (!g || g.pw !== a.password) return antwoord({}, { message: 'Invalid login credentials' });
        if (!g.bevestigd) return antwoord({}, { message: 'Email not confirmed' });
        sessie = { access_token: 't', user: { email: a.email } };
        bewaar();
        return antwoord({ session: sessie });
      },
      signOut: function () { sessie = null; bewaar(); return antwoord({}); },
      resetPasswordForEmail: function () { return antwoord({}); },
      updateUser: function () { return antwoord({}); }
    },
    from: vraag,
    storage: { from: function () { return {}; } }
  }; } };
  window.nepBevestig = function (email) { gebruikers[email].bevestigd = true; bewaar(); };
}());
`;

const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, locale: 'nl-NL', timezoneId: 'Europe/Amsterdam', ignoreHTTPSErrors: true, serviceWorkers: 'block' });
await context.route('**/config.js', route => route.fulfill({
  contentType: 'text/javascript',
  body: 'window.APP_CONFIG = Object.freeze({"supabaseUrl":"https://nep.supabase.co","supabaseAnonKey":"anon","demo":false,"driveUpload":false,"planUrl":""});',
}));
await context.route('https://cdn.jsdelivr.net/npm/@supabase/**', route => route.fulfill({ contentType: 'text/javascript', body: NEP_SUPABASE }));
await context.route(/fonts\.(googleapis|gstatic)\.com/, route => route.fulfill({ status: 200, contentType: 'text/css', body: '' }));

const page = await context.newPage();
const fouten = [];
page.on('pageerror', e => fouten.push(e.message));

async function stap(naam, werk) {
  try {
    await werk();
    console.log(`ok  ${naam}`);
  } catch (e) {
    console.log(`FOUT ${naam}: ${e.message}`);
    throw e;
  }
}

try {
  await stap('inlogscherm zonder demo', async () => {
    await page.goto(basis);
    await page.locator('form[data-form="login"]').waitFor();
    assert.equal(await page.locator('[data-actie="demo-als"]').count(), 0);
  });

  await stap('account maken: wachtwoorden moeten gelijk zijn', async () => {
    await page.getByRole('button', { name: /Eerste keer/ }).click();
    const form = page.locator('form[data-form="account"]');
    await form.locator('input[name=email]').fill('mila@test.nl');
    await form.locator('input[name=w1]').fill('akker2026');
    await form.locator('input[name=w2]').fill('akker2027');
    await form.locator('button[type=submit]').click();
    assert.match(await form.locator('[data-fout]').innerText(), /niet hetzelfde/);
  });

  await stap('account maken stuurt bevestigingsmail', async () => {
    const form = page.locator('form[data-form="account"]');
    await form.locator('input[name=w2]').fill('akker2026');
    await form.locator('button[type=submit]').click();
    await page.getByRole('heading', { name: 'Check je mail' }).waitFor();
    assert.match(await page.locator('.login').innerText(), /mila@test\.nl/);
    const log = await page.evaluate(() => window.nepLog);
    assert.deepEqual(log, [`signUp:mila@test.nl:${basis}`]);
  });

  await stap('onbevestigd inloggen geeft een duidelijke melding', async () => {
    await page.getByRole('button', { name: 'Naar inloggen' }).click();
    const form = page.locator('form[data-form="login"]');
    assert.equal(await form.locator('input[name=email]').inputValue(), 'mila@test.nl');
    await form.locator('input[name=wachtwoord]').fill('akker2026');
    await form.locator('button[type=submit]').click();
    assert.match(await form.locator('[data-fout]').innerText(), /Bevestig eerst/);
  });

  await stap('na bevestigen: fout wachtwoord en daarna binnen', async () => {
    await page.evaluate(() => window.nepBevestig('mila@test.nl'));
    const form = page.locator('form[data-form="login"]');
    await form.locator('input[name=wachtwoord]').fill('fout');
    await form.locator('button[type=submit]').click();
    await page.waitForFunction(() => /klopt niet/.test(document.querySelector('[data-fout]').textContent));
    await form.locator('input[name=wachtwoord]').fill('akker2026');
    await form.locator('button[type=submit]').click();
    await page.locator('h1.hey', { hasText: 'Mila' }).waitFor();
  });

  await stap('sessie blijft na herladen, uitloggen werkt', async () => {
    await page.reload();
    await page.locator('h1.hey', { hasText: 'Mila' }).waitFor();
    await page.goto(`${basis}#meer`);
    await page.locator('[data-actie="uitloggen"]').click();
    await page.locator('form[data-form="login"]').waitFor();
  });

  await stap('een account buiten het team komt er niet in', async () => {
    const form = page.locator('form[data-form="login"]');
    await form.locator('input[name=email]').fill('vreemde@test.nl');
    await form.locator('input[name=wachtwoord]').fill('geheim123');
    await form.locator('button[type=submit]').click();
    await page.waitForFunction(() => /hoort niet bij het team/.test(document.querySelector('[data-fout]').textContent));
    assert.equal(await page.locator('h1.hey').count(), 0);
  });

  await stap('bestaand adres opnieuw aanmelden', async () => {
    await page.getByRole('button', { name: /Eerste keer/ }).click();
    const form = page.locator('form[data-form="account"]');
    await form.locator('input[name=email]').fill('mila@test.nl');
    await form.locator('input[name=w1]').fill('akker2026');
    await form.locator('input[name=w2]').fill('akker2026');
    await form.locator('button[type=submit]').click();
    assert.match(await form.locator('[data-fout]').innerText(), /al een account/);
  });

  assert.deepEqual(fouten, [], `Fouten in de pagina:\n${fouten.join('\n')}`);
  console.log('Inlogtest geslaagd.');
} finally {
  await browser.close();
  server.close();
}
