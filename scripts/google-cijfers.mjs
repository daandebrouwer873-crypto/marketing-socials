// Haalt elke ochtend de cijfers van het Google-bedrijfsprofiel op en zet ze als maandcijfer in
// marketing_metingen: weergaven, routeverzoeken, belklikken, websiteklikken, aantal reviews en score.
// Draait in GitHub Actions (.github/workflows/google-cijfers.yml). Werkt pas als Google de
// API-toegang van het project heeft goedgekeurd; tot dan weigert Google met quotum 0.
import { pathToFileURL } from 'node:url';
import { vandaag, plusDagen, maandStart, vorigeMaand } from '../public/lib/logica.js';
import { opslaan } from './meta-cijfers.mjs';

const TOKEN = 'https://oauth2.googleapis.com/token';
const ACCOUNTS = 'https://mybusinessaccountmanagement.googleapis.com/v1';
const INFO = 'https://mybusinessbusinessinformation.googleapis.com/v1';
const PRESTATIES = 'https://businessprofileperformance.googleapis.com/v1';
const REVIEWS = 'https://mybusiness.googleapis.com/v4';

// Welke dagcijfers van Google bij welk cijfer in de app horen. De vier soorten vertoningen
// (Zoeken en Maps, mobiel en desktop) tellen samen op tot de weergaven.
export const DAGCIJFERS = Object.freeze({
  BUSINESS_IMPRESSIONS_DESKTOP_MAPS: 'gbp_weergaven',
  BUSINESS_IMPRESSIONS_DESKTOP_SEARCH: 'gbp_weergaven',
  BUSINESS_IMPRESSIONS_MOBILE_MAPS: 'gbp_weergaven',
  BUSINESS_IMPRESSIONS_MOBILE_SEARCH: 'gbp_weergaven',
  BUSINESS_DIRECTION_REQUESTS: 'gbp_route',
  CALL_CLICKS: 'gbp_bellen',
  WEBSITE_CLICKS: 'gbp_website',
});

export async function toegangstoken({ clientId, clientSecret, refreshToken }) {
  const antwoord = await fetch(TOKEN, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: clientId, client_secret: clientSecret, refresh_token: refreshToken, grant_type: 'refresh_token',
    }),
  });
  const data = await antwoord.json().catch(() => ({}));
  if (!antwoord.ok || !data.access_token) {
    const verlopen = data.error === 'invalid_grant'
      ? ' De Google-koppeling is verlopen of ingetrokken: maak een nieuw refresh token.' : '';
    throw new Error(`Google-inlog weigert (${data.error || antwoord.status}).${verlopen}`);
  }
  return data.access_token;
}

async function haal(adres, token) {
  const antwoord = await fetch(adres, { headers: { Authorization: `Bearer ${token}` } });
  const data = await antwoord.json().catch(() => ({}));
  if (!antwoord.ok) {
    const fout = data.error || {};
    const tekst = `${fout.message || ''} ${JSON.stringify(fout.details || '')}`;
    // Quotum 0 of een API die pas na goedkeuring aan kan: geen storing, maar wachten op Google.
    const wacht = antwoord.status === 429 || /quota/i.test(tekst)
      || (antwoord.status === 403 && /SERVICE_DISABLED|has not been used|is disabled/i.test(tekst));
    const e = new Error(`Google weigert (${antwoord.status}): ${fout.message || 'onbekende fout'}.`
      + (wacht ? ' Waarschijnlijk is de API-toegang nog niet goedgekeurd.' : ''));
    e.wachtOpGoedkeuring = wacht;
    throw e;
  }
  return data;
}

// Het profiel: vast ingesteld (GBP_LOCATIE = accounts/…/locations/…) of opgezocht op naam.
export async function vindProfiel(token, env) {
  const vast = (env.GBP_LOCATIE || '').trim();
  if (vast) {
    const m = vast.match(/^(accounts\/[^/]+)\/(locations\/[^/]+)$/);
    if (!m) throw new Error('GBP_LOCATIE moet de vorm accounts/…/locations/… hebben.');
    return { account: m[1], locatie: m[2] };
  }
  const naam = (env.GBP_LOCATIE_NAAM || 'Pellens').trim();
  const { accounts = [] } = await haal(`${ACCOUNTS}/accounts`, token);
  for (const account of accounts) {
    const { locations = [] } = await haal(`${INFO}/${account.name}/locations?readMask=name,title&pageSize=100`, token);
    const gevonden = locations.find(l => (l.title || '').trim() === naam);
    if (gevonden) return { account: account.name, locatie: gevonden.name };
  }
  throw new Error(`Geen bedrijfsprofiel met de naam "${naam}" gevonden bij dit Google-account.`);
}

function datumDelen(datum) {
  const [jaar, maand, dag] = datum.split('-').map(Number);
  return { jaar, maand, dag };
}

export function prestatieAdres(locatie, van, tot) {
  const p = new URLSearchParams();
  for (const soort of Object.keys(DAGCIJFERS)) p.append('dailyMetrics', soort);
  const a = datumDelen(van);
  const b = datumDelen(tot);
  p.set('dailyRange.start_date.year', a.jaar);
  p.set('dailyRange.start_date.month', a.maand);
  p.set('dailyRange.start_date.day', a.dag);
  p.set('dailyRange.end_date.year', b.jaar);
  p.set('dailyRange.end_date.month', b.maand);
  p.set('dailyRange.end_date.day', b.dag);
  return `${PRESTATIES}/${locatie}:fetchMultiDailyMetricsTimeSeries?${p}`;
}

// Telt de dagwaarden per maand op. Google laat een waarde weg als die nul is.
export function maandTotalen(antwoord) {
  const totalen = new Map();
  for (const groep of antwoord.multiDailyMetricTimeSeries || []) {
    for (const reeks of groep.dailyMetricTimeSeries || []) {
      const metric = DAGCIJFERS[reeks.dailyMetric];
      if (!metric) continue;
      for (const punt of reeks.timeSeries?.datedValues || []) {
        const { year, month } = punt.date || {};
        if (!year || !month) continue;
        const sleutel = `${metric}|${year}-${String(month).padStart(2, '0')}-01`;
        totalen.set(sleutel, (totalen.get(sleutel) || 0) + Number(punt.value || 0));
      }
    }
  }
  return [...totalen]
    .map(([sleutel, waarde]) => {
      const [metric, periode_start] = sleutel.split('|');
      return { metric, periode_start, waarde };
    })
    .sort((x, y) => x.periode_start.localeCompare(y.periode_start) || x.metric.localeCompare(y.metric));
}

export async function draai(env = process.env, log = console.log, moment = new Date()) {
  const geheim = naam => (env[naam] || '').trim();
  const inlog = { clientId: geheim('GBP_CLIENT_ID'), clientSecret: geheim('GBP_CLIENT_SECRET'), refreshToken: geheim('GBP_REFRESH_TOKEN') };
  const ingevuld = Object.values(inlog).filter(Boolean).length;
  if (!ingevuld) {
    log('Nog geen Google-koppeling ingesteld. Niets opgehaald.');
    return { rijen: [], fouten: [] };
  }
  if (ingevuld < 3) {
    return { rijen: [], fouten: ['Niet alle Google-geheimen staan erin: GBP_CLIENT_ID, GBP_CLIENT_SECRET en GBP_REFRESH_TOKEN zijn alle drie nodig.'] };
  }
  const sleutel = geheim('SUPABASE_SECRET_KEY');
  if (!env.SUPABASE_URL || !sleutel) {
    return { rijen: [], fouten: ['SUPABASE_URL of SUPABASE_SECRET_KEY ontbreekt.'] };
  }

  // Elke dag de vorige en de lopende maand opnieuw optellen: Google loopt een paar dagen achter,
  // dus de vorige maand is pas na een paar dagen in de nieuwe maand compleet.
  const dag = vandaag(moment);
  const dezeMaand = maandStart(dag);
  const vanaf = vorigeMaand(dag);
  const tot = plusDagen(dag, -1);

  let token;
  let profiel;
  try {
    token = await toegangstoken(inlog);
    profiel = await vindProfiel(token, env);
    log(`Profiel: ${profiel.account}/${profiel.locatie}`);
  } catch (e) {
    return e.wachtOpGoedkeuring ? { rijen: [], fouten: [], wachten: [e.message] } : { rijen: [], fouten: [e.message], wachten: [] };
  }

  const rijen = [];
  const fouten = [];
  const wachten = [];
  const meld = (onderdeel, e) => (e.wachtOpGoedkeuring ? wachten : fouten).push(`${onderdeel}: ${e.message}`);
  try {
    const totalen = maandTotalen(await haal(prestatieAdres(profiel.locatie, vanaf, tot), token))
      .filter(r => r.periode_start >= vanaf && r.periode_start <= dezeMaand);
    rijen.push(...totalen);
  } catch (e) {
    meld('Profielcijfers', e);
  }
  try {
    const data = await haal(`${REVIEWS}/${profiel.account}/${profiel.locatie}/reviews?pageSize=1`, token);
    rijen.push({ metric: 'google_reviews', periode_start: dezeMaand, waarde: Number(data.totalReviewCount || 0) });
    if (Number.isFinite(data.averageRating)) {
      rijen.push({ metric: 'google_score', periode_start: dezeMaand, waarde: data.averageRating });
    }
  } catch (e) {
    meld('Reviews', e);
  }

  for (const r of rijen) log(`${r.periode_start} ${r.metric} = ${r.waarde}`);
  if (rijen.length) {
    try {
      await opslaan(rijen, { url: env.SUPABASE_URL, sleutel });
      log(`${rijen.length} cijfers opgeslagen.`);
    } catch (e) {
      fouten.push(e.message);
    }
  }
  return { rijen, fouten, wachten };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const { fouten, wachten = [] } = await draai();
  // Wachten op Google is geen storing: dat komt in de uitvoer, maar de run blijft groen.
  for (const w of wachten) console.log(`Wacht op Google: ${w}`);
  for (const f of fouten) console.error(f);
  // Een rode run stuurt Daan een mail van GitHub: zo valt een verlopen koppeling op.
  if (fouten.length) process.exitCode = 1;
}
