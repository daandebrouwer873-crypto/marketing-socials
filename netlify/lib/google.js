// Google Drive via een serviceaccount: token ophalen, mappen vinden en uploads starten.
import { createSign } from 'node:crypto';

const TOKEN_URL = 'https://oauth2.googleapis.com/token';
const DRIVE = 'https://www.googleapis.com/drive/v3/files';
const UPLOAD = 'https://www.googleapis.com/upload/drive/v3/files';
const MAP_TYPE = 'application/vnd.google-apps.folder';

let tokenCache = null;
const mapCache = new Map();

function base64url(waarde) {
  return Buffer.from(waarde).toString('base64url');
}

export function privesleutel(ruw = process.env.GOOGLE_PRIVATE_KEY) {
  if (!ruw) return '';
  // Netlify bewaart regeleinden vaak als letterlijke \n.
  return String(ruw).replace(/\\n/g, '\n');
}

export function maakJwt({ email, sleutel, scope, nu = Math.floor(Date.now() / 1000) }) {
  const kop = base64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const claims = base64url(JSON.stringify({ iss: email, scope, aud: TOKEN_URL, iat: nu, exp: nu + 3600 }));
  const handtekening = createSign('RSA-SHA256').update(`${kop}.${claims}`).sign(sleutel, 'base64url');
  return `${kop}.${claims}.${handtekening}`;
}

export async function googleToken() {
  if (tokenCache && tokenCache.geldigTot > Date.now() + 60_000) return tokenCache.token;

  const email = process.env.GOOGLE_CLIENT_EMAIL;
  const sleutel = privesleutel();
  if (!email || !sleutel) throw new Error('GOOGLE_CONFIG_ONTBREEKT');

  const assertion = maakJwt({ email, sleutel, scope: 'https://www.googleapis.com/auth/drive' });
  const antwoord = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion }),
  });
  if (!antwoord.ok) throw new Error(`GOOGLE_TOKEN_${antwoord.status}`);
  const data = await antwoord.json();
  tokenCache = { token: data.access_token, geldigTot: Date.now() + (data.expires_in || 3600) * 1000 };
  return tokenCache.token;
}

function aanhalen(tekst) {
  return String(tekst).replace(/\\/g, '\\\\').replace(/'/g, "\\'");
}

export async function vindOfMaakMap(token, naam, ouder) {
  const sleutel = `${ouder}/${naam}`;
  if (mapCache.has(sleutel)) return mapCache.get(sleutel);

  const q = `'${aanhalen(ouder)}' in parents and name = '${aanhalen(naam)}' and mimeType = '${MAP_TYPE}' and trashed = false`;
  const zoek = new URL(DRIVE);
  zoek.search = new URLSearchParams({
    q,
    fields: 'files(id)',
    pageSize: '1',
    supportsAllDrives: 'true',
    includeItemsFromAllDrives: 'true',
    corpora: 'allDrives',
  }).toString();
  const gevonden = await fetch(zoek, { headers: { Authorization: `Bearer ${token}` } });
  if (!gevonden.ok) throw new Error(`DRIVE_ZOEKEN_${gevonden.status}`);
  const { files = [] } = await gevonden.json();

  let id = files[0] && files[0].id;
  if (!id) {
    const gemaakt = await fetch(`${DRIVE}?supportsAllDrives=true&fields=id`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json; charset=UTF-8' },
      body: JSON.stringify({ name: naam, mimeType: MAP_TYPE, parents: [ouder] }),
    });
    if (!gemaakt.ok) throw new Error(`DRIVE_MAP_MAKEN_${gemaakt.status}`);
    id = (await gemaakt.json()).id;
  }
  mapCache.set(sleutel, id);
  return id;
}

// Start een hervatbare upload. De browser stuurt het bestand daarna zelf rechtstreeks naar Google;
// omdat de sessie met de herkomst van de app is gestart, staat Google die browser-upload toe.
export async function startUpload(token, { naam, map, mime, grootte, herkomst, beschrijving }) {
  const url = `${UPLOAD}?uploadType=resumable&supportsAllDrives=true&fields=id,name,webViewLink,mimeType,size`;
  const antwoord = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json; charset=UTF-8',
      'X-Upload-Content-Type': mime,
      'X-Upload-Content-Length': String(grootte),
      Origin: herkomst,
    },
    body: JSON.stringify({ name: naam, parents: [map], description: beschrijving }),
  });
  if (!antwoord.ok) throw new Error(`DRIVE_UPLOAD_START_${antwoord.status}`);
  const locatie = antwoord.headers.get('location');
  if (!locatie) throw new Error('DRIVE_UPLOAD_GEEN_LOCATIE');
  return locatie;
}

export function _resetVoorTests() {
  tokenCache = null;
  mapCache.clear();
}
