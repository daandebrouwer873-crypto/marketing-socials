// Test het echte inlogpad (geen demo) tegen een nagebootste Supabase-client:
// inloggen met het Pellens-account van de team-app, en wie er (nog) niet in mag.
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

// Een kleine Supabase-namaak met Pellens-accounts zoals in de team-app.
const NEP_SUPABASE = `
(function () {
  var gebruikers = {
    'mila@test.nl': { id: 'u-mila', pw: 'akker2026' },
    'nieuw@test.nl': { id: 'u-nieuw', pw: 'tijdelijk1' },
    'frits@test.nl': { id: 'u-frits', pw: 'wijn2026' },
    'oud@test.nl': { id: 'u-oud', pw: 'weg2026' }
  };
  var lidmaatschappen = {
    'u-mila': { active: true, must_change_password: false },
    'u-nieuw': { active: true, must_change_password: true },
    'u-frits': { active: true, must_change_password: false },
    'u-oud': { active: false, must_change_password: false }
  };
  var marketing = [{ email: 'mila@test.nl', naam: 'Mila', rol: 'social', actief: true }];
  var sessie = JSON.parse(localStorage.getItem('nep-sessie') || 'null');
  function bewaar() { localStorage.setItem('nep-sessie', JSON.stringify(sessie)); }
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
      var lid = lidmaatschappen[sessie.user.id];
      if (tabel === 'app_memberships') return filters.user_id === sessie.user.id && lid ? [lid] : [];
      // Zoals de rijbeveiliging: alleen actief, eigen wachtwoord gekozen en op de marketinglijst.
      var toegang = lid && lid.active && !lid.must_change_password && marketing.some(function (m) { return m.email === sessie.user.email; });
      if (!toegang) return [];
      if (tabel === 'marketing_teamleden') return marketing.filter(function (m) { return !filters.email || m.email === filters.email; });
      return [];
    }
    return q;
  }
  window.supabase = { createClient: function () { return {
    auth: {
      getSession: function () { return antwoord({ session: sessie }); },
      signInWithPassword: function (a) {
        var g = gebruikers[a.email];
        if (!g || g.pw !== a.password) return antwoord({}, { message: 'Invalid login credentials' });
        sessie = { access_token: 't', user: { id: g.id, email: a.email } };
        bewaar();
        return antwoord({ session: sessie });
      },
      signOut: function () { sessie = null; bewaar(); return antwoord({}); }
    },
    from: vraag,
    storage: { from: function () { return {}; } }
  }; } };
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
  async function login(email, wachtwoord) {
    const form = page.locator('form[data-form="login"]');
    await form.locator('input[name=email]').fill(email);
    await form.locator('input[name=wachtwoord]').fill(wachtwoord);
    await form.locator('button[type=submit]').click();
  }
  const melding = async patroon => page.waitForFunction(
    p => new RegExp(p).test(document.querySelector('[data-fout]').textContent), patroon.source);

  await stap('inlogscherm: alleen het Pellens-account', async () => {
    await page.goto(basis);
    await page.locator('form[data-form="login"]').waitFor();
    assert.equal(await page.locator('[data-actie="demo-als"]').count(), 0);
    assert.match(await page.locator('.login').innerText(), /hetzelfde als in de team-app/);
    assert.equal(await page.getByText(/Maak je account/).count(), 0);
  });

  await stap('fout wachtwoord', async () => {
    await login('mila@test.nl', 'fout');
    await melding(/klopt niet/);
  });

  await stap('eerst eigen wachtwoord kiezen in de team-app', async () => {
    await login('nieuw@test.nl', 'tijdelijk1');
    await melding(/eigen wachtwoord in de team-app/);
    assert.equal(await page.locator('h1.hey').count(), 0);
  });

  await stap('account zonder actieve toegang', async () => {
    await login('oud@test.nl', 'weg2026');
    await melding(/geen actieve toegang/);
  });

  await stap('collega zonder marketingrol', async () => {
    await login('frits@test.nl', 'wijn2026');
    await melding(/nog geen toegang tot de marketing-app/);
  });

  await stap('Mila logt in met het Pellens-account', async () => {
    await login('mila@test.nl', 'akker2026');
    await page.locator('h1.hey', { hasText: 'Mila' }).waitFor();
  });

  await stap('sessie blijft na herladen, uitloggen werkt', async () => {
    await page.reload();
    await page.locator('h1.hey', { hasText: 'Mila' }).waitFor();
    await page.goto(`${basis}#meer`);
    await page.locator('[data-actie="uitloggen"]').click();
    await page.locator('form[data-form="login"]').waitFor();
  });

  assert.deepEqual(fouten, [], `Fouten in de pagina:\n${fouten.join('\n')}`);
  console.log('Inlogtest geslaagd.');
} finally {
  await browser.close();
  server.close();
}
