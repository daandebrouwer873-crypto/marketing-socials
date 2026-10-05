import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { createVerify, generateKeyPairSync } from 'node:crypto';

const { privateKey, publicKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
const pem = privateKey.export({ type: 'pkcs8', format: 'pem' });

process.env.SUPABASE_URL = 'https://proj.supabase.co';
process.env.SUPABASE_ANON_KEY = 'anon-key';
process.env.GOOGLE_CLIENT_EMAIL = 'uploader@pellens.iam.gserviceaccount.com';
process.env.GOOGLE_PRIVATE_KEY = pem.replace(/\n/g, '\\n');

const { handler } = await import('../netlify/functions/drive-upload.js');
const { _resetVoorTests } = await import('../netlify/lib/google.js');

const HOST = 'marketing.pellens.nl';
let aanroepen;
let teamlid;

function verifieerJwt(jwt) {
  const [kop, claims, handtekening] = jwt.split('.');
  const ok = createVerify('RSA-SHA256').update(`${kop}.${claims}`).verify(publicKey, handtekening, 'base64url');
  return { ok, claims: JSON.parse(Buffer.from(claims, 'base64url').toString()) };
}

beforeEach(() => {
  _resetVoorTests();
  aanroepen = [];
  teamlid = { naam: 'Mila', rol: 'social', actief: true };
  globalThis.fetch = async (url, opties = {}) => {
    const adres = String(url);
    aanroepen.push({ adres, opties });
    const antwoord = (status, body, headers = {}) =>
      new Response(body === null ? null : JSON.stringify(body), { status, headers });

    if (adres === 'https://proj.supabase.co/auth/v1/user') {
      return opties.headers.Authorization === 'Bearer goed'
        ? antwoord(200, { email: 'Mila@Test.nl' })
        : antwoord(401, { msg: 'invalid' });
    }
    if (adres.startsWith('https://proj.supabase.co/rest/v1/marketing_teamleden')) {
      assert.match(adres, /email=eq\.mila%40test\.nl/);
      return antwoord(200, teamlid ? [teamlid] : []);
    }
    if (adres === 'https://oauth2.googleapis.com/token') {
      const assertion = new URLSearchParams(String(opties.body)).get('assertion');
      const { ok, claims } = verifieerJwt(assertion);
      assert.ok(ok, 'JWT is ondertekend met de serviceaccountsleutel');
      assert.equal(claims.iss, process.env.GOOGLE_CLIENT_EMAIL);
      assert.equal(claims.scope, 'https://www.googleapis.com/auth/drive');
      return antwoord(200, { access_token: 'google-token', expires_in: 3600 });
    }
    if (adres.startsWith('https://www.googleapis.com/drive/v3/files?q=') || adres.includes('drive/v3/files?q')) {
      return antwoord(200, { files: [] });
    }
    if (adres.startsWith('https://www.googleapis.com/drive/v3/files?supportsAllDrives=true')) {
      return antwoord(200, { id: 'map-nieuw' });
    }
    if (adres.startsWith('https://www.googleapis.com/upload/drive/v3/files')) {
      return antwoord(200, {}, { location: 'https://www.googleapis.com/upload/drive/v3/files?upload_id=xyz' });
    }
    throw new Error(`Onverwachte aanroep: ${adres}`);
  };
});

function verzoek({ body, token = 'goed', origin = `https://${HOST}`, methode = 'POST' } = {}) {
  const headers = { host: HOST };
  if (origin) headers.origin = origin;
  if (token) headers.authorization = `Bearer ${token}`;
  return { httpMethod: methode, headers, body: body === undefined ? undefined : JSON.stringify(body) };
}

const foto = { onderwerp: 'gerechten', naam: 'IMG 0042.JPG', mime: 'image/jpeg', grootte: 2_400_000 };

test('weigert een andere herkomst', async () => {
  const res = await handler(verzoek({ body: foto, origin: 'https://kwaadaardig.example' }));
  assert.equal(res.statusCode, 403);
  assert.equal(aanroepen.length, 0);
});

test('voorcontrole van de eigen site mag, van een andere niet', async () => {
  assert.equal((await handler(verzoek({ methode: 'OPTIONS' }))).statusCode, 204);
  assert.equal((await handler(verzoek({ methode: 'OPTIONS', origin: 'https://x.example' }))).statusCode, 403);
});

test('vraagt om in te loggen zonder token', async () => {
  const res = await handler(verzoek({ body: foto, token: null }));
  assert.equal(res.statusCode, 401);
});

test('weigert een verlopen sessie', async () => {
  const res = await handler(verzoek({ body: foto, token: 'fout' }));
  assert.equal(res.statusCode, 401);
});

test('weigert wie niet in het team zit', async () => {
  teamlid = null;
  const res = await handler(verzoek({ body: foto }));
  assert.equal(res.statusCode, 403);
  assert.ok(!aanroepen.some(a => a.adres.includes('googleapis')), 'Google wordt niet aangeroepen');
});

test('weigert een inactief teamlid', async () => {
  teamlid = { naam: 'Mila', rol: 'social', actief: false };
  assert.equal((await handler(verzoek({ body: foto }))).statusCode, 403);
});

test('controleert onderwerp, type en grootte', async () => {
  assert.equal((await handler(verzoek({ body: { ...foto, onderwerp: 'geheim' } }))).statusCode, 400);
  assert.equal((await handler(verzoek({ body: { ...foto, mime: 'application/pdf' } }))).statusCode, 400);
  assert.equal((await handler(verzoek({ body: { ...foto, grootte: 6 * 1024 ** 3 } }))).statusCode, 400);
  assert.equal((await handler(verzoek({ body: { ...foto, grootte: 0 } }))).statusCode, 400);
});

test('start een upload in de vaste map met nette bestandsnaam en de herkomst van de app', async () => {
  const res = await handler(verzoek({ body: foto }));
  assert.equal(res.statusCode, 200);
  const data = JSON.parse(res.body);
  assert.equal(data.uploadUrl, 'https://www.googleapis.com/upload/drive/v3/files?upload_id=xyz');
  assert.match(data.bestandsnaam, /^\d{4}-\d{2}-\d{2}_Mila_Gerechten_IMG-0042\.jpg$/);
  assert.equal(res.headers['Access-Control-Allow-Origin'], `https://${HOST}`);

  const start = aanroepen.find(a => a.adres.includes('/upload/drive/v3/files'));
  assert.match(start.adres, /uploadType=resumable/);
  assert.match(start.adres, /supportsAllDrives=true/);
  assert.equal(start.opties.headers.Origin, `https://${HOST}`);
  assert.equal(start.opties.headers['X-Upload-Content-Type'], 'image/jpeg');
  assert.equal(start.opties.headers['X-Upload-Content-Length'], '2400000');
  const metadata = JSON.parse(start.opties.body);
  assert.deepEqual(metadata.parents, ['1DkqZT9LFm6uDekhgZ4HBbC_ULJ56BwoM']);
  assert.match(metadata.description, /Mila/);
});

test('zoekt of maakt de map "Nieuw - te sorteren" en onthoudt hem', async () => {
  const eerste = await handler(verzoek({ body: { ...foto, onderwerp: 'nieuw', mime: 'video/quicktime', naam: 'clip.MOV' } }));
  assert.equal(eerste.statusCode, 200);
  const zoek = aanroepen.find(a => a.adres.includes('drive/v3/files?q'));
  const q = new URL(zoek.adres).searchParams.get('q');
  assert.ok(q.includes("name = 'Nieuw - te sorteren'"), q);
  assert.ok(q.includes("'1CPgrC9ULe5qR9n-LPCrrvXMlwegjhQ1c' in parents"), q);
  const start = aanroepen.find(a => a.adres.includes('/upload/drive/v3/files'));
  assert.deepEqual(JSON.parse(start.opties.body).parents, ['map-nieuw']);

  aanroepen = [];
  await handler(verzoek({ body: { ...foto, onderwerp: 'nieuw' } }));
  assert.ok(!aanroepen.some(a => a.adres.includes('drive/v3/files?q')), 'tweede keer geen zoekopdracht');
  assert.ok(!aanroepen.some(a => a.adres.includes('oauth2')), 'token wordt hergebruikt');
});

test('meldt een ontbrekende Google-koppeling duidelijk', async () => {
  const bewaard = process.env.GOOGLE_PRIVATE_KEY;
  delete process.env.GOOGLE_PRIVATE_KEY;
  try {
    const res = await handler(verzoek({ body: foto }));
    assert.equal(res.statusCode, 500);
    assert.match(JSON.parse(res.body).error, /nog niet ingesteld/);
  } finally {
    process.env.GOOGLE_PRIVATE_KEY = bewaard;
  }
});
