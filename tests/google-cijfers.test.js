import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { draai, maandTotalen, prestatieAdres, vindProfiel } from '../scripts/google-cijfers.mjs';

// Vrijdag 16 oktober 2026: Google geeft september en oktober tot en met gisteren terug.
const VANDAAG = new Date('2026-10-16T05:30:00Z');

let aanroepen;
let tokenAntwoord;
let prestatieStatus;
let reviewsAntwoord;
let supabaseStatus;
const uitvoer = [];
const log = regel => uitvoer.push(regel);

const punt = (j, m, d, waarde) => ({ date: { year: j, month: m, day: d }, ...(waarde === undefined ? {} : { value: String(waarde) }) });
const reeks = (soort, punten) => ({ dailyMetric: soort, timeSeries: { datedValues: punten } });

const PRESTATIES = {
  multiDailyMetricTimeSeries: [{
    dailyMetricTimeSeries: [
      reeks('BUSINESS_IMPRESSIONS_MOBILE_MAPS', [punt(2026, 9, 30, 100), punt(2026, 10, 1, 40), punt(2026, 10, 2, 60)]),
      reeks('BUSINESS_IMPRESSIONS_MOBILE_SEARCH', [punt(2026, 9, 30, 50), punt(2026, 10, 1, 10)]),
      reeks('BUSINESS_IMPRESSIONS_DESKTOP_MAPS', [punt(2026, 10, 1, 5)]),
      reeks('BUSINESS_IMPRESSIONS_DESKTOP_SEARCH', [punt(2026, 10, 1)]),
      reeks('BUSINESS_DIRECTION_REQUESTS', [punt(2026, 9, 30, 7), punt(2026, 10, 2, 3)]),
      reeks('CALL_CLICKS', [punt(2026, 10, 1, 2), punt(2026, 10, 2)]),
      reeks('WEBSITE_CLICKS', [punt(2026, 10, 2, 9)]),
    ],
  }],
};

beforeEach(() => {
  aanroepen = [];
  uitvoer.length = 0;
  tokenAntwoord = { status: 200, body: { access_token: 'ya29.nep', expires_in: 3599 } };
  prestatieStatus = 200;
  reviewsAntwoord = { status: 200, body: { reviews: [{}], averageRating: 4.6, totalReviewCount: 232 } };
  supabaseStatus = 201;
  globalThis.fetch = async (url, opties = {}) => {
    const adres = String(url);
    aanroepen.push({ adres, opties });
    if (adres === 'https://oauth2.googleapis.com/token') {
      return Response.json(tokenAntwoord.body, { status: tokenAntwoord.status });
    }
    assert.ok(!adres.startsWith('https://proj.') ? opties.headers.Authorization === 'Bearer ya29.nep' : true, 'Google krijgt het toegangstoken');
    if (adres === 'https://mybusinessaccountmanagement.googleapis.com/v1/accounts') {
      return Response.json({ accounts: [{ name: 'accounts/111' }, { name: 'accounts/222' }] });
    }
    if (adres.startsWith('https://mybusinessbusinessinformation.googleapis.com/v1/accounts/111/locations')) {
      return Response.json({ locations: [{ name: 'locations/9', title: 'De Hofdreven' }] });
    }
    if (adres.startsWith('https://mybusinessbusinessinformation.googleapis.com/v1/accounts/222/locations')) {
      assert.match(adres, /readMask=name%2Ctitle|readMask=name,title/);
      return Response.json({ locations: [{ name: 'locations/5', title: 'Wijnkoperij' }, { name: 'locations/7', title: 'Pellens' }] });
    }
    if (adres.startsWith('https://businessprofileperformance.googleapis.com/v1/locations/7:fetchMultiDailyMetricsTimeSeries')) {
      return prestatieStatus === 200
        ? Response.json(PRESTATIES)
        : Response.json({ error: { code: 429, message: "Quota exceeded for quota metric 'Requests' ... limit 0" } }, { status: 429 });
    }
    if (adres.startsWith('https://mybusiness.googleapis.com/v4/accounts/222/locations/7/reviews')) {
      return Response.json(reviewsAntwoord.body, { status: reviewsAntwoord.status });
    }
    if (adres.startsWith('https://proj.supabase.co/rest/v1/marketing_metingen')) {
      return new Response(supabaseStatus < 300 ? null : '{"message":"fout"}', { status: supabaseStatus });
    }
    throw new Error(`onverwacht adres ${adres}`);
  };
});

const env = (extra = {}) => ({
  SUPABASE_URL: 'https://proj.supabase.co',
  SUPABASE_SECRET_KEY: 'sb_secret_test',
  GBP_CLIENT_ID: 'id.apps.googleusercontent.com',
  GBP_CLIENT_SECRET: 'GOCSPX-nep',
  GBP_REFRESH_TOKEN: '1//nep',
  ...extra,
});

test('zonder Google-geheimen doet hij niets en faalt hij niet', async () => {
  const { rijen, fouten } = await draai({ SUPABASE_URL: 'https://proj.supabase.co', GBP_CLIENT_ID: ' ' }, log, VANDAAG);
  assert.deepEqual(rijen, []);
  assert.deepEqual(fouten, []);
  assert.equal(aanroepen.length, 0);
  assert.match(uitvoer[0], /Nog geen Google-koppeling/);
});

test('half ingevulde geheimen zijn een fout', async () => {
  const { fouten } = await draai(env({ GBP_REFRESH_TOKEN: '' }), log, VANDAAG);
  assert.match(fouten[0], /alle drie nodig/);
  assert.equal(aanroepen.length, 0);
});

test('haalt profielcijfers per maand en reviews op en slaat ze op', async () => {
  const { rijen, fouten } = await draai(env(), log, VANDAAG);
  assert.deepEqual(fouten, []);
  assert.deepEqual(rijen, [
    { metric: 'gbp_route', periode_start: '2026-09-01', waarde: 7 },
    { metric: 'gbp_weergaven', periode_start: '2026-09-01', waarde: 150 },
    { metric: 'gbp_bellen', periode_start: '2026-10-01', waarde: 2 },
    { metric: 'gbp_route', periode_start: '2026-10-01', waarde: 3 },
    { metric: 'gbp_website', periode_start: '2026-10-01', waarde: 9 },
    { metric: 'gbp_weergaven', periode_start: '2026-10-01', waarde: 115 },
    { metric: 'google_reviews', periode_start: '2026-10-01', waarde: 232 },
    { metric: 'google_score', periode_start: '2026-10-01', waarde: 4.6 },
  ]);

  const token = aanroepen[0];
  const vorm = new URLSearchParams(String(token.opties.body));
  assert.equal(vorm.get('grant_type'), 'refresh_token');
  assert.equal(vorm.get('refresh_token'), '1//nep');

  const prestaties = aanroepen.find(a => a.adres.includes(':fetchMultiDailyMetricsTimeSeries'));
  const p = new URL(prestaties.adres).searchParams;
  assert.deepEqual(p.getAll('dailyMetrics').length, 7);
  assert.equal(p.get('dailyRange.start_date.month'), '9');
  assert.equal(p.get('dailyRange.start_date.day'), '1');
  assert.equal(p.get('dailyRange.end_date.month'), '10');
  assert.equal(p.get('dailyRange.end_date.day'), '15', 'tot en met gisteren');

  const opslaan = aanroepen.find(a => a.adres.includes('/rest/v1/'));
  assert.equal(JSON.parse(opslaan.opties.body).length, 8);
  assert.ok(!uitvoer.join('\n').match(/1\/\/nep|GOCSPX|ya29/), 'geen geheimen in de uitvoer');
  assert.ok(uitvoer.includes('Profiel: accounts/222/locations/7'));
});

test('nog niet goedgekeurd (quotum 0): geen fout maar wachten, reviews gaan door', async () => {
  prestatieStatus = 429;
  const { rijen, fouten, wachten } = await draai(env(), log, VANDAAG);
  assert.deepEqual(rijen.map(r => r.metric), ['google_reviews', 'google_score']);
  assert.deepEqual(fouten, []);
  assert.match(wachten[0], /^Profielcijfers: Google weigert \(429\).*nog niet goedgekeurd/);
});

test('reviews-API nog niet aan (403 SERVICE_DISABLED) is wachten, een gewone 403 is een fout', async () => {
  reviewsAntwoord = { status: 403, body: { error: { code: 403, message: 'Google My Business API has not been used in project 682139451223 before or it is disabled.', details: [{ reason: 'SERVICE_DISABLED' }] } } };
  const wacht = await draai(env(), log, VANDAAG);
  assert.deepEqual(wacht.fouten, []);
  assert.match(wacht.wachten[0], /^Reviews: .*nog niet goedgekeurd/);
  assert.equal(wacht.rijen.length, 6, 'de profielcijfers komen wel binnen');

  reviewsAntwoord = { status: 403, body: { error: { code: 403, message: 'The caller does not have permission' } } };
  const fout = await draai(env(), log, VANDAAG);
  assert.match(fout.fouten[0], /^Reviews: Google weigert \(403\): The caller does not have permission\.$/);
  assert.deepEqual(fout.wachten, []);
});

test('al bij het zoeken van het profiel quotum 0: niets opgehaald, wel groen', async () => {
  prestatieStatus = 429;
  const origineel = globalThis.fetch;
  globalThis.fetch = async (url, opties) => (String(url).endsWith('/v1/accounts')
    ? Response.json({ error: { code: 429, message: "Quota exceeded for quota metric 'Requests' ... limit 0" } }, { status: 429 })
    : origineel(url, opties));
  const { rijen, fouten, wachten } = await draai(env(), log, VANDAAG);
  assert.deepEqual(rijen, []);
  assert.deepEqual(fouten, []);
  assert.match(wachten[0], /nog niet goedgekeurd/);
});

test('verlopen koppeling geeft een duidelijke fout en roept verder niets aan', async () => {
  tokenAntwoord = { status: 400, body: { error: 'invalid_grant', error_description: 'Token has been expired or revoked.' } };
  const { rijen, fouten } = await draai(env(), log, VANDAAG);
  assert.deepEqual(rijen, []);
  assert.match(fouten[0], /Google-inlog weigert \(invalid_grant\).*nieuw refresh token/);
  assert.equal(aanroepen.length, 1);
});

test('vast ingesteld profiel slaat het zoeken over', async () => {
  const profiel = await vindProfiel('ya29.nep', { GBP_LOCATIE: 'accounts/222/locations/7' });
  assert.deepEqual(profiel, { account: 'accounts/222', locatie: 'locations/7' });
  assert.equal(aanroepen.length, 0);
  await assert.rejects(vindProfiel('ya29.nep', { GBP_LOCATIE: 'locations/7' }), /vorm accounts/);
  await assert.rejects(vindProfiel('ya29.nep', { GBP_LOCATIE_NAAM: 'Brioche' }), /Geen bedrijfsprofiel met de naam "Brioche"/);
});

test('op de eerste van de maand telt alleen de vorige maand', async () => {
  const adres = prestatieAdres('locations/7', '2026-10-01', '2026-10-31');
  assert.match(adres, /^https:\/\/businessprofileperformance\.googleapis\.com\/v1\/locations\/7:fetchMultiDailyMetricsTimeSeries\?/);
  const { fouten } = await draai(env(), log, new Date('2026-11-01T05:30:00Z'));
  assert.deepEqual(fouten, []);
  const p = new URL(aanroepen.find(a => a.adres.includes(':fetch')).adres).searchParams;
  assert.equal(p.get('dailyRange.start_date.month'), '10');
  assert.equal(p.get('dailyRange.end_date.month'), '10');
  assert.equal(p.get('dailyRange.end_date.day'), '31');
});

test('maandtotalen tellen ontbrekende waarden als nul en negeren onbekende soorten', () => {
  const totalen = maandTotalen({
    multiDailyMetricTimeSeries: [{ dailyMetricTimeSeries: [
      reeks('CALL_CLICKS', [punt(2026, 10, 1), punt(2026, 10, 2)]),
      reeks('BUSINESS_FOOD_ORDERS', [punt(2026, 10, 1, 99)]),
    ] }],
  });
  assert.deepEqual(totalen, [{ metric: 'gbp_bellen', periode_start: '2026-10-01', waarde: 0 }]);
  assert.deepEqual(maandTotalen({}), []);
});
