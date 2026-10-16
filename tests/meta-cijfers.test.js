import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { draai, metingenVoor, BRONNEN } from '../scripts/meta-cijfers.mjs';

const PELLENS = BRONNEN.find(b => b.naam === 'Pellens');
const BROUWERIJ = BRONNEN.find(b => b.naam === 'Brouwerij');
const WOENSDAG = new Date('2026-10-14T05:15:00Z');

let aanroepen;
let paginas;
let supabaseStatus;
const uitvoer = [];
const log = regel => uitvoer.push(regel);

beforeEach(() => {
  aanroepen = [];
  uitvoer.length = 0;
  supabaseStatus = 201;
  paginas = {
    'token-pellens': { name: 'Pellens', followers_count: 1210, instagram_business_account: { username: 'restaurantpellens.breda', followers_count: 3802 } },
    'token-brouwerij': { name: 'Brouwerij', followers_count: 90, instagram_business_account: { username: 'brouwerij', followers_count: 412 } },
  };
  globalThis.fetch = async (url, opties = {}) => {
    const adres = String(url);
    aanroepen.push({ adres, opties });
    if (adres.startsWith('https://graph.facebook.com/')) {
      const token = (opties.headers.Authorization || '').replace('Bearer ', '');
      const pagina = paginas[token];
      return pagina
        ? Response.json(pagina)
        : Response.json({ error: { message: 'Error validating access token', code: 190 } }, { status: 400 });
    }
    if (adres.startsWith('https://proj.supabase.co/rest/v1/marketing_metingen')) {
      return new Response(supabaseStatus < 300 ? null : '{"message":"fout"}', { status: supabaseStatus });
    }
    throw new Error(`onverwacht adres ${adres}`);
  };
});

const env = (extra = {}) => ({ SUPABASE_URL: 'https://proj.supabase.co', SUPABASE_SECRET_KEY: 'sb_secret_test', ...extra });

test('zonder token doet hij niets en faalt hij niet', async () => {
  const { rijen, fouten } = await draai(env(), log, WOENSDAG);
  assert.deepEqual(rijen, []);
  assert.deepEqual(fouten, []);
  assert.equal(aanroepen.length, 0);
  assert.match(uitvoer[0], /Nog geen Meta-token/);
});

test('haalt volgers op en slaat ze op als cijfer van deze week', async () => {
  const { rijen, fouten } = await draai(env({ META_TOKEN_PELLENS: 'token-pellens', META_TOKEN_BROUWERIJ: 'token-brouwerij' }), log, WOENSDAG);
  assert.deepEqual(fouten, []);
  assert.deepEqual(rijen, [
    { metric: 'fb_volgers_pellens', periode_start: '2026-10-12', waarde: 1210 },
    { metric: 'ig_volgers_pellens', periode_start: '2026-10-12', waarde: 3802 },
    { metric: 'ig_volgers_brouwerij', periode_start: '2026-10-12', waarde: 412 },
  ]);

  const meta = aanroepen.find(a => a.adres.startsWith('https://graph.facebook.com/'));
  assert.ok(!meta.adres.includes('token-'), 'het token staat niet in het adres');
  assert.match(decodeURIComponent(meta.adres), /instagram_business_account\{username,followers_count\}/);

  const opslaan = aanroepen.find(a => a.adres.includes('/rest/v1/'));
  assert.equal(opslaan.opties.method, 'POST');
  assert.match(opslaan.adres, /on_conflict=metric,periode_start/);
  assert.equal(opslaan.opties.headers.apikey, 'sb_secret_test');
  assert.equal(opslaan.opties.headers.Authorization, undefined, 'een sb_secret-sleutel gaat niet als Bearer mee');
  assert.match(opslaan.opties.headers.Prefer, /merge-duplicates/);
  assert.equal(JSON.parse(opslaan.opties.body).length, 3);
  assert.ok(!uitvoer.join('\n').includes('token-'), 'tokens komen niet in de uitvoer');
});

test('zondagavond telt nog voor dezelfde week, maandag begint een nieuwe', async () => {
  const zondag = await draai(env({ META_TOKEN_PELLENS: 'token-pellens' }), log, new Date('2026-10-18T21:30:00Z'));
  assert.equal(zondag.rijen[0].periode_start, '2026-10-12');
  const maandag = await draai(env({ META_TOKEN_PELLENS: 'token-pellens' }), log, new Date('2026-10-19T05:15:00Z'));
  assert.equal(maandag.rijen[0].periode_start, '2026-10-19');
});

test('een verlopen token geeft een duidelijke fout, de andere bron gaat door', async () => {
  const { rijen, fouten } = await draai(env({ META_TOKEN_PELLENS: 'oud', META_TOKEN_BROUWERIJ: 'token-brouwerij' }), log, WOENSDAG);
  assert.deepEqual(rijen.map(r => r.metric), ['ig_volgers_brouwerij']);
  assert.equal(fouten.length, 1);
  assert.match(fouten[0], /^Pellens: Meta weigert \(190\).*verlopen/);
});

test('ontbrekende Supabase-sleutel of geweigerde opslag is een fout', async () => {
  const zonderSleutel = await draai({ META_TOKEN_PELLENS: 'token-pellens', SUPABASE_URL: 'https://proj.supabase.co' }, log, WOENSDAG);
  assert.match(zonderSleutel.fouten[0], /SUPABASE_SECRET_KEY ontbreekt/);
  assert.equal(aanroepen.length, 0);

  supabaseStatus = 401;
  const geweigerd = await draai(env({ META_TOKEN_PELLENS: 'token-pellens' }), log, WOENSDAG);
  assert.match(geweigerd.fouten[0], /Supabase weigert \(401\)/);
});

test('oude service_role-sleutel gaat ook als Bearer mee', async () => {
  await draai(env({ META_TOKEN_PELLENS: 'token-pellens', SUPABASE_SECRET_KEY: 'eyJoud' }), log, WOENSDAG);
  const opslaan = aanroepen.find(a => a.adres.includes('/rest/v1/'));
  assert.equal(opslaan.opties.headers.Authorization, 'Bearer eyJoud');
});

test('meldt wat Meta niet teruggaf', () => {
  const zonderIg = metingenVoor(PELLENS, { followers_count: 10 }, '2026-10-12');
  assert.deepEqual(zonderIg.rijen, [{ metric: 'fb_volgers_pellens', periode_start: '2026-10-12', waarde: 10 }]);
  assert.match(zonderIg.missend[0], /geen zakelijk Instagram-account/);

  const zonderRechten = metingenVoor(PELLENS, { instagram_business_account: { username: 'x' } }, '2026-10-12');
  assert.deepEqual(zonderRechten.rijen, []);
  assert.equal(zonderRechten.missend.length, 2);

  const brouwerij = metingenVoor(BROUWERIJ, { followers_count: 5, instagram_business_account: { followers_count: 0 } }, '2026-10-12');
  assert.deepEqual(brouwerij.rijen, [{ metric: 'ig_volgers_brouwerij', periode_start: '2026-10-12', waarde: 0 }]);
  assert.deepEqual(brouwerij.missend, []);
});
