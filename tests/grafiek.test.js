import { test } from 'node:test';
import assert from 'node:assert/strict';
import { schaal, lijnGrafiek, svgLijn, statTegel, staafLijst, vonkje, nieuweRender } from '../public/lib/grafiek.js';

test('nette asverdeling', () => {
  assert.deepEqual(schaal(0, 40), { onder: 0, boven: 40, ticks: [0, 10, 20, 30, 40] });
  assert.deepEqual(schaal(3612, 3978).ticks, [3600, 3700, 3800, 3900, 4000]);
  const gelijk = schaal(5, 5);
  assert.ok(gelijk.onder < 5 && gelijk.boven > 5);
});

test('lijngrafiek: tabel als alternatief, gaten blijven gaten', () => {
  nieuweRender();
  const spec = {
    titel: 'Gasten', labels: ['wk 1', 'wk 2', 'wk 3'],
    reeksen: [{ naam: 'Diner', kleur: 'g1', waarden: [30, null, 32] }, { naam: 'Lunch', kleur: 'g2', waarden: [9, 10, 12] }],
  };
  const html = lijnGrafiek(spec);
  assert.match(html, /class="legenda"/);
  assert.match(html, /<td>wk 2<\/td><td>–<\/td><td>10<\/td>/);
  const svg = svgLijn(spec, 600);
  // Diner heeft een gat: twee losse stukken.
  const diner = svg.match(/<path class="lijn" d="([^"]+)" style="stroke:var\(--g1\)"/)[1];
  assert.equal((diner.match(/M/g) || []).length, 2);
  // Per periode een raakvlak met tooltip, voor muis en toetsenbord.
  assert.equal((svg.match(/class="raak"/g) || []).length, 3);
  assert.match(svg, /tabindex="0"/);
  assert.match(svg, /aria-label="wk 2: Diner –, Lunch 10"/);
});

test('lijngrafiek zonder cijfers en met onveilige namen', () => {
  assert.match(lijnGrafiek({ titel: 'x', labels: ['a'], reeksen: [{ naam: 'n', kleur: 'g1', waarden: [null] }] }), /Nog geen cijfers/);
  const html = lijnGrafiek({ titel: '<b>', labels: ['<i>'], reeksen: [{ naam: '<script>', kleur: 'g1', waarden: [1] }] });
  assert.ok(!html.includes('<script>'));
  assert.ok(!html.includes('<i>'));
});

test('cijfertegel, staafjes en verloop', () => {
  const omhoog = statTegel({ label: 'Volgers', waarde: 3978, delta: 47, deltaTekst: 't.o.v. week ervoor', reeks: [1, 2, 3] });
  assert.match(omhoog, /delta goed/);
  assert.match(omhoog, /\+47/);
  assert.match(omhoog, /3\.978/);
  assert.match(statTegel({ label: 'x', waarde: 1, delta: -2 }), /delta slecht/);
  assert.match(statTegel({ label: 'x', waarde: 1, delta: null }), /nog geen vergelijking/);
  assert.ok(!statTegel({ label: 'x', waarde: 1 }).includes('delta'));
  const staven = staafLijst({ rijen: [{ label: 'Reel', waarde: 4 }, { label: 'Story', waarde: 2 }] });
  assert.match(staven, /width:100\.0%/);
  assert.match(staven, /width:50\.0%/);
  assert.equal(vonkje([1]), '');
  assert.match(vonkje([1, null, 3]), /polyline/);
});
