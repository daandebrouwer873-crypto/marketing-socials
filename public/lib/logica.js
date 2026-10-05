// Pure rekenregels van de app: datums, weken, de drie-takenregel, routines, streaks en voortgang.
import { MAANDEN, ROUTINES } from './plan.js';

const DAG = 864e5;
const DAGEN = ['zo', 'ma', 'di', 'wo', 'do', 'vr', 'za'];
const DAGEN_LANG = ['zondag', 'maandag', 'dinsdag', 'woensdag', 'donderdag', 'vrijdag', 'zaterdag'];
const MAAND_KORT = ['jan', 'feb', 'mrt', 'apr', 'mei', 'jun', 'jul', 'aug', 'sep', 'okt', 'nov', 'dec'];

// ---- Datums (altijd als 'YYYY-MM-DD', gerekend in Nederlandse tijd) ----

const amsterdam = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Europe/Amsterdam', year: 'numeric', month: '2-digit', day: '2-digit',
});

export function vandaag(moment = new Date()) {
  return amsterdam.format(moment);
}

function utc(datum) {
  return Date.parse(`${datum}T00:00:00Z`);
}

export function plusDagen(datum, n) {
  return new Date(utc(datum) + n * DAG).toISOString().slice(0, 10);
}

export function weekdag(datum) {
  return new Date(utc(datum)).getUTCDay();
}

export function maandagVan(datum) {
  const d = weekdag(datum);
  return plusDagen(datum, d === 0 ? -6 : 1 - d);
}

export function maandStart(datum) {
  return `${datum.slice(0, 7)}-01`;
}

export function vorigeMaand(datum) {
  const [j, m] = datum.slice(0, 7).split('-').map(Number);
  const nieuw = m === 1 ? [j - 1, 12] : [j, m - 1];
  return `${nieuw[0]}-${String(nieuw[1]).padStart(2, '0')}-01`;
}

export function weekNummer(datum) {
  const donderdag = plusDagen(maandagVan(datum), 3);
  const jaarStart = `${donderdag.slice(0, 4)}-01-01`;
  return Math.floor((utc(donderdag) - utc(jaarStart)) / DAG / 7) + 1;
}

export function korteDatum(datum) {
  const [, m, d] = datum.split('-').map(Number);
  return `${DAGEN[weekdag(datum)]} ${d} ${MAAND_KORT[m - 1]}`;
}

export function dagNaam(datum) {
  return DAGEN_LANG[weekdag(datum)];
}

export function dagKort(datum) {
  return DAGEN[weekdag(datum)];
}

export function maandNaam(datum) {
  const namen = ['januari', 'februari', 'maart', 'april', 'mei', 'juni', 'juli', 'augustus', 'september', 'oktober', 'november', 'december'];
  return namen[Number(datum.slice(5, 7)) - 1];
}

export function weekBereik(maandag) {
  const zondag = plusDagen(maandag, 6);
  const [, m1, d1] = maandag.split('-').map(Number);
  const [, m2, d2] = zondag.split('-').map(Number);
  return m1 === m2
    ? `${d1}–${d2} ${MAAND_KORT[m2 - 1]}`
    : `${d1} ${MAAND_KORT[m1 - 1]} – ${d2} ${MAAND_KORT[m2 - 1]}`;
}

export function begroeting(moment = new Date()) {
  const uur = Number(new Intl.DateTimeFormat('nl-NL', { timeZone: 'Europe/Amsterdam', hour: 'numeric', hour12: false }).format(moment));
  if (uur < 6) return 'Nachtbraker';
  if (uur < 12) return 'Goeiemorgen';
  if (uur < 18) return 'Goeiemiddag';
  return 'Goeienavond';
}

// ---- Weektaken: maximaal drie, open taken schuiven door ----

export const MAX_TAKEN = 3;

export function takenVoorWeek(taken, maandag) {
  return taken
    .filter(t => t.week_start === maandag || (t.status === 'open' && t.week_start < maandag))
    .map(t => ({ ...t, doorgeschoven: t.week_start < maandag }))
    .sort((a, b) => (a.status === b.status ? String(a.created_at).localeCompare(String(b.created_at)) : a.status === 'open' ? -1 : 1));
}

export function vrijePlekken(taken, maandag) {
  return Math.max(0, MAX_TAKEN - takenVoorWeek(taken, maandag).length);
}

// ---- Routines en streak ----

export function context(datum) {
  const dag = weekdag(datum);
  const dagVanMaand = Number(datum.slice(8, 10));
  return { datum, weekdag: dag, dagVanMaand, eersteMaandag: dag === 1 && dagVanMaand <= 7 };
}

export function routinesVoor(rol, datum) {
  const c = context(datum);
  return ROUTINES.filter(r => r.rollen.includes(rol) && r.wanneer(c));
}

// checks: lijst van { datum, routine } van één persoon.
export function streak(checks, rol, tot, maxDagen = 366) {
  const perDag = new Map();
  for (const c of checks) {
    if (!perDag.has(c.datum)) perDag.set(c.datum, new Set());
    perDag.get(c.datum).add(c.routine);
  }
  const compleet = datum => {
    const nodig = routinesVoor(rol, datum);
    if (!nodig.length) return null;
    const gedaan = perDag.get(datum) || new Set();
    return nodig.every(r => gedaan.has(r.key));
  };

  let telling = 0;
  let datum = tot;
  // Vandaag nog niet af breekt de reeks niet: die dag loopt nog.
  if (compleet(datum) === false) datum = plusDagen(datum, -1);
  for (let i = 0; i < maxDagen; i += 1, datum = plusDagen(datum, -1)) {
    const status = compleet(datum);
    if (status === null) continue;
    if (!status) break;
    telling += 1;
  }
  return telling;
}

// ---- Posts ----

export function postsTekstNodig(posts) {
  return posts.filter(p => !p.tekst_goedgekeurd && ['idee', 'tekst_nodig'].includes(p.status));
}

export function filterPosts(posts, { status = 'alles', merk = 'alles' } = {}) {
  return posts.filter(p =>
    (merk === 'alles' || p.merk === merk) &&
    (status === 'alles' || (status === 'tekst_nodig' ? postsTekstNodig([p]).length > 0 : p.status === status)),
  );
}

// ---- Metingen en doelen ----

export function laatsteMeting(metingen, metric) {
  return metingen
    .filter(m => m.metric === metric)
    .sort((a, b) => b.periode_start.localeCompare(a.periode_start))[0] || null;
}

export function reeks(metingen, metric, aantal = 8) {
  return metingen
    .filter(m => m.metric === metric)
    .sort((a, b) => a.periode_start.localeCompare(b.periode_start))
    .slice(-aantal);
}

export function voortgang(doel, huidig) {
  const start = doel.start_waarde;
  const eind = doel.doel_maart;
  if (start == null || eind == null || huidig == null || eind === start) return null;
  const deel = (huidig - start) / (eind - start);
  const tussen = doel.doel_december == null ? null : (doel.doel_december - start) / (eind - start);
  return {
    procent: Math.max(0, Math.min(1, deel)),
    tussenstap: tussen == null ? null : Math.max(0, Math.min(1, tussen)),
    nogTeGaan: Math.max(0, eind - huidig),
    gehaald: eind > start ? huidig >= eind : huidig <= eind,
  };
}

export function maandVanPlan(datum) {
  const sleutel = datum.slice(0, 7);
  return MAANDEN.find(m => m.maand === sleutel) || (sleutel < MAANDEN[0].maand ? MAANDEN[0] : MAANDEN.at(-1));
}

// ---- Weergave ----

export function getal(waarde, decimalen = 0) {
  if (waarde == null || Number.isNaN(Number(waarde))) return '–';
  return new Intl.NumberFormat('nl-NL', { maximumFractionDigits: decimalen, minimumFractionDigits: 0 }).format(Number(waarde));
}

export function voorletter(naam) {
  return String(naam || '?').trim().charAt(0).toUpperCase() || '?';
}

export function geledenTekst(moment, nu = new Date()) {
  const verschil = Math.round((nu - new Date(moment)) / 60000);
  if (verschil < 1) return 'net';
  if (verschil < 60) return `${verschil} min geleden`;
  const uren = Math.round(verschil / 60);
  if (uren < 24) return `${uren} uur geleden`;
  const dagen = Math.round(uren / 24);
  return dagen === 1 ? 'gisteren' : `${dagen} dagen geleden`;
}

export function esc(tekst) {
  return String(tekst ?? '').replace(/[&<>"']/g, t => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[t]));
}
