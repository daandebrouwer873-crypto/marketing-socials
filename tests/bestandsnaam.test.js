import { test } from 'node:test';
import assert from 'node:assert/strict';
import { bestandsnaam, datumAmsterdam } from '../netlify/lib/bestandsnaam.js';

test('datum volgt de Nederlandse tijd, ook rond middernacht', () => {
  assert.equal(datumAmsterdam(new Date('2026-10-07T22:30:00Z')), '2026-10-08');
  assert.equal(datumAmsterdam(new Date('2026-12-31T10:00:00Z')), '2026-12-31');
});

test('maakt een veilige, leesbare naam', () => {
  const naam = bestandsnaam({
    moment: new Date('2026-10-08T12:00:00Z'),
    naam: 'Mila',
    onderwerp: 'Vuur en grill',
    origineel: 'Crème brûlée / grill (1).HEIC',
  });
  assert.equal(naam, '2026-10-08_Mila_Vuur-en-grill_grill-1.heic');
});

test('houdt het pad buiten de naam en kapt lange namen af', () => {
  const naam = bestandsnaam({
    moment: new Date('2026-10-08T12:00:00Z'),
    naam: 'Daan',
    onderwerp: 'Gerechten',
    origineel: `C:\\fotos\\..\\${'a'.repeat(200)}.jpg`,
  });
  assert.ok(naam.startsWith('2026-10-08_Daan_Gerechten_aaaa'));
  assert.ok(naam.endsWith('.jpg'));
  assert.ok(naam.length < 130);
  assert.ok(!naam.includes('\\') && !naam.includes('/'));
});

test('werkt ook zonder extensie of naam', () => {
  const naam = bestandsnaam({ moment: new Date('2026-10-08T12:00:00Z'), naam: '', onderwerp: 'Overig', origineel: '' });
  assert.equal(naam, '2026-10-08_team_Overig_bestand');
});
