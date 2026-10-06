import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  vandaag, plusDagen, weekdag, maandagVan, vorigeMaand, weekNummer, weekBereik, korteDatum,
  takenVoorWeek, vrijePlekken, routinesVoor, streak, voortgang, filterPosts, postsTekstNodig,
  laatsteMeting, maandVanPlan, esc, getal,
  verwachtOpDatum, opSchema, verschil, waardenPer, weken, maanden, telPer, volgendeMaandVanPlan,
} from '../public/lib/logica.js';

test('datums rekenen in Nederlandse tijd', () => {
  assert.equal(vandaag(new Date('2026-10-04T22:30:00Z')), '2026-10-05');
  assert.equal(plusDagen('2026-10-31', 1), '2026-11-01');
  assert.equal(plusDagen('2026-03-29', -1), '2026-03-28');
  assert.equal(weekdag('2026-10-05'), 1);
  assert.equal(korteDatum('2026-10-08'), 'do 8 okt');
});

test('weken beginnen op maandag', () => {
  assert.equal(maandagVan('2026-10-05'), '2026-10-05');
  assert.equal(maandagVan('2026-10-08'), '2026-10-05');
  assert.equal(maandagVan('2026-10-11'), '2026-10-05');
  assert.equal(weekNummer('2026-10-05'), 41);
  assert.equal(weekNummer('2027-01-01'), 53);
  assert.equal(weekNummer('2027-01-04'), 1);
  assert.equal(weekBereik('2026-10-05'), '5–11 okt');
  assert.equal(weekBereik('2026-09-28'), '28 sep – 4 okt');
  assert.equal(vorigeMaand('2027-01-15'), '2026-12-01');
  assert.equal(vorigeMaand('2026-11-01'), '2026-10-01');
});

test('maximaal drie taken per week, open taken schuiven door', () => {
  const taken = [
    { id: 1, week_start: '2026-09-28', status: 'af', created_at: '1' },
    { id: 2, week_start: '2026-09-28', status: 'open', created_at: '2' },
    { id: 3, week_start: '2026-10-05', status: 'af', created_at: '3' },
    { id: 4, week_start: '2026-10-05', status: 'open', created_at: '4' },
    { id: 5, week_start: '2026-10-12', status: 'open', created_at: '5' },
  ];
  const deze = takenVoorWeek(taken, '2026-10-05');
  assert.deepEqual(deze.map(t => t.id), [2, 4, 3]);
  assert.equal(deze.find(t => t.id === 2).doorgeschoven, true);
  assert.equal(deze.find(t => t.id === 4).doorgeschoven, false);
  assert.equal(vrijePlekken(taken, '2026-10-05'), 0);
  assert.equal(vrijePlekken(taken, '2026-09-28'), 1);
  assert.equal(vrijePlekken([], '2026-10-05'), 3);
});

test('routines hangen af van rol en dag', () => {
  const keys = (rol, datum) => routinesVoor(rol, datum).map(r => r.key);
  // Maandag 5 oktober: gesloten, eerste maandag van de maand.
  assert.deepEqual(keys('social', '2026-10-05'), ['cijfers-team', 'weekplanning', 'volgers', 'maandcijfers', 'maandthema']);
  assert.ok(!keys('social', '2026-10-12').includes('maandcijfers'));
  // Woensdag 7 oktober: open, eerste woensdag.
  assert.deepEqual(keys('manager', '2026-10-07'), ['reviewvraag', 'reviews-beantwoorden', 'gasten', 'reserveringen']);
  assert.deepEqual(keys('manager', '2026-10-09'), ['reviewvraag', 'tafel-vrij']);
  // Dinsdag: Daan spreekt teksten in, in week 1 en 3 ook LinkedIn.
  assert.deepEqual(keys('eigenaar', '2026-10-06'), ['teksten', 'linkedin']);
  assert.deepEqual(keys('eigenaar', '2026-10-13'), ['teksten']);
  assert.deepEqual(keys('eigenaar', '2026-10-20'), ['teksten', 'linkedin']);
  assert.deepEqual(keys('social', '2026-10-06'), []);
});

test('streak telt volledige dagen en slaat dagen zonder routines over', () => {
  const alles = datum => routinesVoor('social', datum).map(r => ({ datum, routine: r.key }));
  const checks = [
    ...alles('2026-10-04'), // zo
    ...alles('2026-10-05'), // ma
    // di 6 oktober: geen routines
    ...alles('2026-10-07'), // wo
  ];
  // Donderdag nog niet af: reeks loopt door tot en met woensdag.
  assert.equal(streak(checks, 'social', '2026-10-08'), 3);
  // Donderdag ook af: vier.
  assert.equal(streak([...checks, ...alles('2026-10-08')], 'social', '2026-10-08'), 4);
  // Een gemiste zaterdag breekt de reeks.
  const metGat = [...alles('2026-10-02'), ...alles('2026-10-04'), ...alles('2026-10-05')];
  assert.equal(streak(metGat, 'social', '2026-10-05'), 2);
  assert.equal(streak([], 'social', '2026-10-05'), 0);
});

test('voortgang richting het doel van maart', () => {
  const doel = { start_waarde: 31, doel_december: 33, doel_maart: 35 };
  assert.deepEqual(voortgang(doel, 33), { procent: 0.5, tussenstap: 0.5, nogTeGaan: 2, gehaald: false });
  assert.equal(voortgang(doel, 36).gehaald, true);
  assert.equal(voortgang(doel, 29).procent, 0);
  assert.equal(voortgang({ start_waarde: null, doel_maart: 10 }, 5), null);
  assert.equal(voortgang(doel, null), null);
});

test('posts filteren op status en merk', () => {
  const posts = [
    { id: 1, merk: 'pellens', status: 'tekst_nodig', tekst_goedgekeurd: false },
    { id: 2, merk: 'brouwerij', status: 'tekst_klaar', tekst_goedgekeurd: true },
    { id: 3, merk: 'pellens', status: 'idee', tekst_goedgekeurd: false },
    { id: 4, merk: 'pellens', status: 'geplaatst', tekst_goedgekeurd: true },
  ];
  assert.deepEqual(postsTekstNodig(posts).map(p => p.id), [1, 3]);
  assert.deepEqual(filterPosts(posts, { status: 'tekst_nodig', merk: 'pellens' }).map(p => p.id), [1, 3]);
  assert.deepEqual(filterPosts(posts, { merk: 'brouwerij' }).map(p => p.id), [2]);
  assert.deepEqual(filterPosts(posts, { status: 'geplaatst' }).map(p => p.id), [4]);
});

test('laatste meting en maand van het plan', () => {
  const metingen = [
    { metric: 'x', periode_start: '2026-09-28', waarde: 1 },
    { metric: 'x', periode_start: '2026-10-05', waarde: 2 },
    { metric: 'y', periode_start: '2026-10-12', waarde: 9 },
  ];
  assert.equal(laatsteMeting(metingen, 'x').waarde, 2);
  assert.equal(laatsteMeting(metingen, 'z'), null);
  assert.equal(maandVanPlan('2026-10-05').naam, 'Oktober');
  assert.equal(maandVanPlan('2026-09-20').naam, 'Oktober');
  assert.equal(maandVanPlan('2027-02-14').naam, 'Februari');
  assert.equal(maandVanPlan('2027-06-01').naam, 'Maart');
});

test('tekst wordt veilig getoond', () => {
  assert.equal(esc('<img src=x onerror="a">&\''), '&lt;img src=x onerror=&quot;a&quot;&gt;&amp;&#39;');
  assert.equal(getal(3769), '3.769');
  assert.equal(getal(4.55, 1), '4,6');
  assert.equal(getal(null), '–');
});

test('Drive-links per onderwerp, onbekend of zonder vaste map naar de beeldbank zelf', async () => {
  const { driveMapUrl, ONDERWERPEN, BEELDBANK_MAP_ID } = await import('../public/lib/onderwerpen.js');
  assert.equal(driveMapUrl('gerechten'), 'https://drive.google.com/drive/folders/1DkqZT9LFm6uDekhgZ4HBbC_ULJ56BwoM');
  assert.equal(driveMapUrl('nieuw'), `https://drive.google.com/drive/folders/${BEELDBANK_MAP_ID}`);
  assert.equal(driveMapUrl('bestaat-niet'), `https://drive.google.com/drive/folders/${BEELDBANK_MAP_ID}`);
  assert.equal(ONDERWERPEN.filter(o => o.map).length, 12);
});

test('waar je volgens het plan nu zou moeten staan', () => {
  const doel = { start_waarde: 0, doel_december: 150, doel_maart: 400 };
  assert.equal(verwachtOpDatum(doel, '2026-09-15'), 0);
  assert.equal(verwachtOpDatum(doel, '2026-10-01'), 0);
  assert.equal(verwachtOpDatum(doel, '2026-12-31'), 150);
  assert.equal(verwachtOpDatum(doel, '2027-03-31'), 400);
  assert.equal(verwachtOpDatum(doel, '2027-06-01'), 400);
  // Halverwege oktober tot eind december: 46 van de 91 dagen.
  assert.ok(Math.abs(verwachtOpDatum(doel, '2026-11-16') - (150 * 46) / 91) < 1e-9);
  // Zonder decemberdoel: rechte lijn naar maart.
  assert.ok(Math.abs(verwachtOpDatum({ start_waarde: 0, doel_december: null, doel_maart: 181 }, '2026-12-31') - 91) < 1e-9);
  assert.equal(verwachtOpDatum({ start_waarde: null, doel_maart: 10 }, '2026-11-01'), null);
});

test('voor, op of achter op schema', () => {
  const doel = { start_waarde: 0, doel_december: 150, doel_maart: 400 };
  assert.equal(opSchema(doel, 150, '2026-12-31').status, 'op');
  assert.equal(opSchema(doel, 200, '2026-12-31').status, 'voor');
  assert.equal(opSchema(doel, 100, '2026-12-31').status, 'achter');
  assert.equal(opSchema(doel, 140, '2026-12-31').status, 'op');
  assert.equal(opSchema(doel, 150, '2026-12-31').verwachtDeel, 150 / 400);
  assert.equal(opSchema(doel, null, '2026-12-31'), null);
  assert.equal(opSchema({ start_waarde: 5, doel_maart: 5 }, 5, '2026-12-31'), null);
});

test('verschil, reeksen met gaten, weken en maanden', () => {
  const metingen = [
    { metric: 'v', periode_start: '2026-09-21', waarde: 10 },
    { metric: 'v', periode_start: '2026-10-05', waarde: 14 },
    { metric: 'v', periode_start: '2026-09-28', waarde: 12 },
  ];
  assert.deepEqual(verschil(metingen, 'v'), { huidig: 14, vorig: 12, delta: 2, periode: '2026-10-05' });
  assert.deepEqual(verschil(metingen.slice(0, 1), 'v'), { huidig: 10, vorig: null, delta: null, periode: '2026-09-21' });
  assert.deepEqual(verschil([], 'v'), { huidig: null, vorig: null, delta: null, periode: null });
  assert.deepEqual(weken('2026-10-05', 3), ['2026-09-21', '2026-09-28', '2026-10-05']);
  assert.deepEqual(waardenPer(metingen, 'v', ['2026-09-14', '2026-09-21', '2026-10-05']), [null, 10, 14]);
  assert.deepEqual(maanden('2027-01-20', 3), ['2026-11-01', '2026-12-01', '2027-01-01']);
  assert.deepEqual(telPer([{ a: 'x' }, { a: 'y' }, { a: 'x' }], 'a'), { x: 2, y: 1 });
  assert.equal(volgendeMaandVanPlan('2026-10-06').naam, 'November');
  assert.equal(volgendeMaandVanPlan('2027-03-10'), null);
});
