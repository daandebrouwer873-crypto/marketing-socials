// Pellens marketing: de app van Daan, Mila en Beau.
import {
  vandaag, plusDagen, maandagVan, weekdag, vorigeMaand, weekNummer, weekBereik, korteDatum, dagNaam, dagKort, maandNaam,
  begroeting, takenVoorWeek, vrijePlekken, routinesVoor, streak, postsTekstNodig, filterPosts,
  laatsteMeting, reeks, voortgang, maandVanPlan, getal, voorletter, geledenTekst, esc, MAX_TAKEN,
} from './lib/logica.js';
import { KANALEN, THEMAS, MERKEN, POST_STATUS, MAANDEN, RITME, SPELREGELS, METRICS, ROLLEN, metric } from './lib/plan.js';
import { ONDERWERPEN, onderwerp, driveMapUrl } from './lib/onderwerpen.js';
import { maakOpslag, DEMO_TEAM } from './lib/opslag.js';
import { uploadNaarBeeldbank, mimeVan } from './lib/upload.js';
import { dicterenKan, startDicteren, memoKan, startMemo } from './lib/spraak.js';
import { confetti, confettiBij, tril, melding } from './lib/effecten.js';
import { icoon, monogram } from './lib/iconen.js';
import { kiesThema, huidigThema, THEMAS as WEERGAVEN } from './thema.js';

const config = window.APP_CONFIG || { demo: true };
const opslag = maakOpslag(config);
const app = document.getElementById('app');
const nav = document.getElementById('nav');

const S = {
  lid: null,
  team: [],
  taken: [],
  posts: [],
  checks: [],
  metingen: [],
  doelen: [],
  uploads: [],
  weekVerschuiving: 0,
  postsVerschuiving: 0,
  postFilter: { status: 'alles', merk: 'alles' },
  cijferSoort: 'week',
  cijferVerschuiving: 0,
  upload: { bestanden: [], onderwerp: null, bezig: false },
  kwartier: { stap: 1, start: 0, doorgeschoven: new Set() },
  paneel: null,
  opname: null,
  klok: 0,
  geladenOp: 0,
};

const PIJL_LINKS = '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m15 5-7 7 7 7"/></svg>';
const PIJL_RECHTS = '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m9 5 7 7-7 7"/></svg>';

const nu = () => vandaag();
const dezeMaandag = () => maandagVan(nu());
const isEigenaar = () => S.lid && S.lid.rol === 'eigenaar';
const isSocial = () => S.lid && S.lid.rol === 'social';

function teamlid(email) {
  return S.team.find(l => l.email === email) || { email, naam: String(email || '?').split('@')[0], rol: '' };
}

function avatar(lid, klein = false) {
  return `<span class="avatar a-${esc(lid.rol)}${klein ? ' klein' : ''}" aria-hidden="true">${esc(voorletter(lid.naam))}</span>`;
}

function ring(waarde, totaal, { maat = 74, id = '' } = {}) {
  const r = maat / 2 - 6;
  const omtrek = 2 * Math.PI * r;
  const deel = totaal ? Math.min(1, waarde / totaal) : 0;
  return `<div class="ring-wrap" style="width:${maat}px;height:${maat}px">
    <svg width="${maat}" height="${maat}" viewBox="0 0 ${maat} ${maat}" aria-hidden="true">
      <circle class="ring-bg" cx="${maat / 2}" cy="${maat / 2}" r="${r}" fill="none" stroke-width="8"/>
      <circle class="ring-voor" ${id ? `id="${id}"` : ''} data-omtrek="${omtrek}" cx="${maat / 2}" cy="${maat / 2}" r="${r}" fill="none"
        stroke-width="8" stroke-linecap="round"
        stroke-dasharray="${omtrek}" stroke-dashoffset="${omtrek * (1 - deel)}"/>
    </svg>
    <span class="ring-tekst" ${id ? `id="${id}-tekst"` : ''}>${totaal ? `${waarde}/${totaal}` : '–'}</span>
  </div>`;
}

function vonk(waarden) {
  if (waarden.length < 2) return '';
  const min = Math.min(...waarden);
  const max = Math.max(...waarden);
  const b = 120;
  const h = 26;
  const punten = waarden.map((w, i) => `${(i / (waarden.length - 1)) * b},${h - 3 - ((w - min) / (max - min || 1)) * (h - 6)}`);
  const stijgt = waarden.at(-1) >= waarden[0];
  return `<svg class="vonk" width="${b}" height="${h}" viewBox="0 0 ${b} ${h}" aria-hidden="true">
    <polyline points="${punten.join(' ')}" fill="none" style="stroke:var(${stijgt ? '--salie' : '--sintel'})" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
  </svg>`;
}

// ---------------------------------------------------------------------------
// Gegevens

async function laadAlles() {
  const [team, taken, posts, checks, metingen, doelen, uploads] = await Promise.all([
    opslag.team(), opslag.taken(), opslag.posts(), opslag.checks(S.lid.email),
    opslag.metingen(), opslag.doelen(), opslag.uploads(),
  ]);
  Object.assign(S, { team, taken, posts, checks, metingen, doelen, uploads, geladenOp: Date.now() });
}

async function bewaar(werk, { fout = 'Opslaan mislukt.' } = {}) {
  try {
    return await werk();
  } catch (e) {
    melding(e.message || fout, 'fout');
    throw e;
  }
}

// ---------------------------------------------------------------------------
// Paneel van onderen

function openPaneel(html, { opSluit } = {}) {
  sluitPaneel(true);
  const achtergrond = document.createElement('div');
  achtergrond.className = 'achtergrond';
  achtergrond.dataset.actie = 'sluit-paneel';
  const paneel = document.createElement('section');
  paneel.className = 'paneel';
  paneel.setAttribute('role', 'dialog');
  paneel.setAttribute('aria-modal', 'true');
  paneel.tabIndex = -1;
  paneel.innerHTML = `<div class="greep" aria-hidden="true"></div>${html}`;
  document.body.append(achtergrond, paneel);
  requestAnimationFrame(() => {
    achtergrond.classList.add('open');
    paneel.classList.add('open');
    paneel.focus({ preventScroll: true });
  });
  document.body.style.overflow = 'hidden';
  S.paneel = { achtergrond, paneel, opSluit };
  return paneel;
}

function sluitPaneel(direct = false) {
  if (!S.paneel) return;
  const { achtergrond, paneel, opSluit } = S.paneel;
  S.paneel = null;
  stopOpname();
  if (opSluit) opSluit();
  achtergrond.classList.remove('open');
  paneel.classList.remove('open');
  setTimeout(() => { achtergrond.remove(); paneel.remove(); }, direct ? 0 : 340);
  document.body.style.overflow = '';
}

function foutIn(form, tekst) {
  const plek = form.querySelector('[data-fout]');
  if (plek) plek.textContent = tekst;
}

// ---------------------------------------------------------------------------
// Schermen

function topbalk() {
  return `<header class="topbalk">
    <a class="woordmerk" href="#vandaag" aria-label="Pellens marketing, naar vandaag">${monogram(34)}<span><span class="naam">Pellens</span><span class="onder">marketing</span></span></a>
    <div style="display:flex;align-items:center;gap:10px">${opslag.demo ? '<span class="demo-label">demo</span>' : ''}<a href="#meer" aria-label="Account en meer">${avatar(S.lid)}</a></div>
  </header>`;
}

function viewVandaag() {
  const d = nu();
  const rol = S.lid.rol;
  const routines = routinesVoor(rol, d);
  const gedaan = new Set(S.checks.filter(c => c.datum === d).map(c => c.routine));
  const aantalGedaan = routines.filter(r => gedaan.has(r.key)).length;
  const reeksDagen = streak(S.checks, rol, d);
  const maand = maandVanPlan(d);
  const mijnTaken = takenVoorWeek(S.taken, dezeMaandag()).filter(t => t.eigenaar === S.lid.email && t.status === 'open');

  const rijen = routines.map(r => {
    const aan = gedaan.has(r.key);
    return `<div class="rij${aan ? ' aan' : ''}">
      <button class="vink-knop" data-actie="routine" data-key="${esc(r.key)}" aria-pressed="${aan}">
        <span class="vink" aria-hidden="true"></span>
        <span class="rt"><span class="rl">${esc(r.label)}</span>${r.hint ? `<span class="rh">${esc(r.hint)}</span>` : ''}</span>
      </button>
      ${r.link ? `<a class="ga" href="${r.link}" aria-label="Ga naar ${esc(r.label)}">→</a>` : ''}
    </div>`;
  }).join('');

  return `
    <p class="dagregel">${dagNaam(d)} ${korteDatum(d).split(' ').slice(1).join(' ')} · week ${weekNummer(d)}</p>
    <h1 class="hey">${begroeting()},<br><em>${esc(S.lid.naam)}</em></h1>

    <div class="bento">
      <div class="kaart tegel streak">
        <span class="vlam-zacht">${icoon('vlam', 26)}</span>
        <div><div class="groot" id="streak-getal">${reeksDagen}</div><div class="tekst-onder">${reeksDagen === 1 ? 'dag' : 'dagen'} op rij alles af</div></div>
      </div>
      <div class="kaart tegel">
        ${ring(aantalGedaan, routines.length, { id: 'ring-vandaag' })}
        <div class="tekst-onder">${routines.length ? 'vaste taken vandaag' : 'vrije dag'}</div>
      </div>
    </div>

    ${weekdag(d) === 1 ? `
      <a class="kaart gloed klik" href="#maandag" style="display:block;text-decoration:none">
        <div class="kop"><h2>Maandagkwartier</h2><span class="pill p-bubbel">15 min</span></div>
        <p class="sub">Cijfers invullen, vorige week afvinken, drie taken kiezen. Daarna terug naar de keuken.</p>
      </a>` : ''}

    ${rolKaart()}

    <section class="kaart">
      <div class="kop"><h2>Vandaag</h2><span class="sub">${routines.length ? `${aantalGedaan} van ${routines.length}` : ''}</span></div>
      ${routines.length ? rijen : '<p class="leeg">Vandaag geen vaste taken. Geniet ervan.</p>'}
    </section>

    ${mijnTaken.length ? `
      <section class="kaart">
        <div class="kop"><h2>Jouw weektaken</h2><a class="link-knop" href="#week">Week →</a></div>
        ${mijnTaken.map(taakRij).join('')}
      </section>` : ''}

    <a class="kaart klik" href="#plan" style="display:block;text-decoration:none">
      <p class="label" style="margin-bottom:6px">Deze maand</p>
      <div class="kop"><h2>${esc(maand.naam)}, <em>${esc(maand.thema.toLowerCase())}</em></h2><span class="sub">${PIJL_RECHTS}</span></div>
      <div class="chips">${maand.momenten.map(m => `<span class="chip">${esc(m)}</span>`).join('')}</div>
    </a>`;
}

function rolKaart() {
  const maandag = dezeMaandag();
  const zondag = plusDagen(maandag, 6);
  const dezeWeek = S.posts.filter(p => p.datum >= maandag && p.datum <= zondag);
  const vanaf = plusDagen(nu(), -7);

  if (isEigenaar()) {
    const wachten = postsTekstNodig(S.posts.filter(p => p.datum >= vanaf));
    return wachten.length
      ? `<a class="kaart gloed klik" href="#posts/tekst" style="display:block;text-decoration:none">
          <p class="label" style="margin-bottom:6px">${icoon('mic', 14)} Jouw beurt</p>
          <div class="kop"><h2>${wachten.length} ${wachten.length === 1 ? 'post wacht' : 'posts wachten'} op jouw tekst</h2></div>
          <p class="sub">Tik, praat, keur goed. Mila doet de rest.</p>
          <div class="knoppen een"><span class="knop">${icoon('mic')} Inspreken</span></div>
        </a>`
      : `<div class="kaart"><p class="label" style="margin-bottom:6px">${icoon('check', 14)} Teksten</p><h2>Alle teksten zijn binnen</h2><p class="sub">Niets dat op jou wacht. Lekker.</p></div>`;
  }

  if (isSocial()) {
    const klaar = dezeWeek.filter(p => p.tekst_goedgekeurd).length;
    const nieuw = S.uploads.filter(u => u.onderwerp === 'nieuw' && u.created_at >= plusDagen(nu(), -14)).length;
    return `<div class="bento">
      <a class="kaart tegel klik" href="#posts" style="text-decoration:none">
        <span class="label">Deze week</span>
        <div><div class="groot">${dezeWeek.length}</div><div class="tekst-onder">posts gepland, ${klaar} met tekst</div></div>
      </a>
      <a class="kaart tegel klik" href="#upload" style="text-decoration:none">
        <span class="label">Beeldbank</span>
        <div><div class="groot">${nieuw}</div><div class="tekst-onder">in "Nieuw" te sorteren</div></div>
      </a>
    </div>`;
  }

  return `<div class="kaart">
    <p class="label" style="margin-bottom:6px">${icoon('ster', 14)} Reviews</p>
    <h2>Reviews komen van enthousiaste tafels</h2>
    <p class="sub">Vraag het bij de koffie, nooit bij de rekening. Een tafel vrij op vrijdag of zaterdag? Geef het direct door aan Mila.</p>
  </div>`;
}

function taakRij(t) {
  const lid = teamlid(t.eigenaar);
  const af = t.status === 'af';
  return `<article class="taak${af ? ' af aan' : ''}">
    <button class="vink-knop" data-actie="taak-af" data-id="${esc(t.id)}" aria-pressed="${af}" aria-label="${af ? 'Weer openzetten' : 'Afvinken'}: ${esc(t.titel)}">
      <span class="vink" aria-hidden="true"></span>
    </button>
    <button class="taak-tekst" data-actie="taak-open" data-id="${esc(t.id)}">
      <h3>${esc(t.titel)}</h3>
      <p class="meta">${avatar(lid, true)} ${esc(lid.naam)}${t.doorgeschoven ? ' · <span class="badge">doorgeschoven</span>' : ''}</p>
      ${t.minimumversie && !af ? `<p class="mini">Minimaal: ${esc(t.minimumversie)}</p>` : ''}
    </button>
  </article>`;
}

function viewWeek() {
  const maandag = plusDagen(dezeMaandag(), 7 * S.weekVerschuiving);
  const lijst = takenVoorWeek(S.taken, maandag);
  const plekken = vrijePlekken(S.taken, maandag);
  const af = lijst.filter(t => t.status === 'af').length;
  const verleden = maandag < dezeMaandag();

  return `
    <header class="paginakop">
      <button class="rond-knop" data-actie="week-terug" aria-label="Vorige week">${PIJL_LINKS}</button>
      <div class="midden">
        <h1 class="titel">Week ${weekNummer(maandag)}</h1>
        <p class="sub">${weekBereik(maandag)}${S.weekVerschuiving === 0 ? ' · deze week' : ''}</p>
      </div>
      <button class="rond-knop" data-actie="week-verder" aria-label="Volgende week">${PIJL_RECHTS}</button>
    </header>

    <div class="kaart gloed weekstatus">
      ${ring(af, Math.max(lijst.length, MAX_TAKEN))}
      <div>
        <b>${af} van ${lijst.length || MAX_TAKEN} af</b>
        <p class="sub">${verleden ? 'Deze week is voorbij.' : plekken ? `Nog ${plekken} ${plekken === 1 ? 'plek' : 'plekken'} vrij.` : 'Vol. Eerst iets afmaken.'}</p>
      </div>
    </div>

    <section class="kaart">
      ${lijst.length ? lijst.map(taakRij).join('') : '<p class="leeg">Nog geen taken. Kies er maximaal drie die echt het verschil maken.</p>'}
    </section>

    ${verleden ? '' : `<button class="knop" data-actie="taak-nieuw" data-week="${maandag}" ${plekken ? '' : 'disabled'}>+ Taak toevoegen</button>`}
    <p class="mini" style="margin-top:14px;text-align:center">Max ${MAX_TAKEN} per week. Wat niet af is, schuift door en telt mee.</p>`;
}

function taakPaneel(taak, week) {
  const t = taak || { eigenaar: S.lid.email };
  return `
    <h2>${taak ? 'Taak aanpassen' : 'Nieuwe taak'}</h2>
    <form data-form="taak" data-id="${esc(t.id || '')}" data-week="${esc(week || t.week_start || dezeMaandag())}">
      <label class="veld"><span>Wat moet er gebeuren?</span>
        <input type="text" name="titel" maxlength="140" required value="${esc(t.titel || '')}" placeholder="Bijvoorbeeld: lunch op Google zetten"></label>
      <div class="veld"><span>Wie is eigenaar?</span>
        <div class="keuze">${S.team.map(l => `<label><input type="radio" name="eigenaar" value="${esc(l.email)}" ${l.email === t.eigenaar ? 'checked' : ''} required><span class="chip">${avatar(l, true)} ${esc(l.naam)}</span></label>`).join('')}</div>
      </div>
      <label class="veld"><span>Minimumversie, voor als er weinig tijd is</span>
        <input type="text" name="minimumversie" maxlength="280" value="${esc(t.minimumversie || '')}" placeholder="Wat is genoeg als het druk is?"></label>
      <label class="veld"><span>Klaar wanneer…</span>
        <input type="text" name="klaar_wanneer" maxlength="280" value="${esc(t.klaar_wanneer || '')}" placeholder="Wanneer kun je hem afvinken?"></label>
      <p class="fout-tekst" data-fout></p>
      <button class="knop" type="submit">${taak ? 'Opslaan' : 'Toevoegen'}</button>
      ${taak ? `<div class="knoppen een"><button type="button" class="knop gevaar" data-actie="taak-weg" data-id="${esc(t.id)}">Verwijderen</button></div>` : ''}
    </form>`;
}

function viewPosts() {
  const maandag = plusDagen(dezeMaandag(), 7 * S.postsVerschuiving);
  const dagen = Array.from({ length: 7 }, (_, i) => plusDagen(maandag, i));
  const inWeek = S.posts.filter(p => p.datum >= dagen[0] && p.datum <= dagen[6]);
  const gefilterd = filterPosts(inWeek, S.postFilter);
  const tekstNodig = postsTekstNodig(inWeek).length;
  const filters = [
    ['alles', 'Alles'], ['tekst_nodig', `Tekst nodig${tekstNodig ? ` <span class="tel">${tekstNodig}</span>` : ''}`],
    ['tekst_klaar', 'Klaar'], ['ingepland', 'Ingepland'], ['geplaatst', 'Geplaatst'],
  ];
  const merken = [['alles', 'Beide merken'], ['pellens', 'Pellens'], ['brouwerij', 'Brouwerij']];

  const groepen = dagen.map(d => {
    const posts = gefilterd.filter(p => p.datum === d);
    if (!posts.length) return '';
    return `<h3 class="dagkop">${dagNaam(d)} ${korteDatum(d).split(' ').slice(1).join(' ')}</h3>${posts.map(postKaart).join('')}`;
  }).join('');

  return `
    <header class="paginakop">
      <button class="rond-knop" data-actie="posts-terug" aria-label="Vorige week">${PIJL_LINKS}</button>
      <div class="midden"><h1 class="titel">Posts</h1><p class="sub">Week ${weekNummer(maandag)} · ${weekBereik(maandag)}</p></div>
      <button class="rond-knop" data-actie="posts-verder" aria-label="Volgende week">${PIJL_RECHTS}</button>
    </header>

    <div class="weekstrook">
      ${dagen.map(d => {
        const posts = inWeek.filter(p => p.datum === d);
        return `<div class="dag${d === nu() ? ' vandaag' : ''}">${dagKort(d)}<b>${Number(d.slice(8))}</b>
          <span class="stipjes">${posts.slice(0, 3).map(p => `<span class="stip${p.tekst_goedgekeurd ? ' klaar' : ''}"></span>`).join('')}</span></div>`;
      }).join('')}
    </div>

    <div class="chips scroll" role="group" aria-label="Filter op status">
      ${filters.map(([k, l]) => `<button class="chip${S.postFilter.status === k ? ' aan' : ''}" data-actie="post-filter" data-status="${k}">${l}</button>`).join('')}
    </div>
    <div class="chips scroll" role="group" aria-label="Filter op merk" style="margin-top:8px">
      ${merken.map(([k, l]) => `<button class="chip${S.postFilter.merk === k ? ' aan' : ''}" data-actie="post-merk" data-merk="${k}">${l}</button>`).join('')}
    </div>

    ${groepen || `<div class="kaart" style="margin-top:16px"><p class="leeg">${inWeek.length ? 'Niets met dit filter.' : 'Nog niets gepland deze week.'}</p></div>`}

    ${S.lid.rol !== 'manager' ? '<button class="fab" data-actie="post-nieuw">＋ Post</button>' : ''}`;
}

function postKaart(p) {
  const kanaal = KANALEN[p.kanaal] || { label: p.kanaal, emoji: '•' };
  const status = POST_STATUS[p.status] || POST_STATUS.idee;
  const thema = THEMAS[p.thema];
  const wachtOpDaan = isEigenaar() && postsTekstNodig([p]).length;
  return `<article class="kaart post" data-actie="post-open" data-id="${esc(p.id)}" tabindex="0" role="button">
    <div class="post-top">
      <span class="kanaal">${esc(kanaal.label)}</span>
      <span class="merk m-${esc(p.merk)}">${esc((MERKEN[p.merk] || MERKEN.pellens).kort)}</span>
      <span class="pill p-${status.kleur}">${status.label}</span>
    </div>
    <p class="idee">${esc(p.idee)}</p>
    ${p.tekst ? `<p class="tekst-preview">“${esc(p.tekst)}”</p>` : ''}
    <div class="post-voet">
      ${thema ? `<span>${esc(thema.label)}</span>` : ''}
      ${(p.beeld || []).length ? `<span>${icoon('beeld', 15)} ${p.beeld.length}</span>` : ''}
      ${p.spraakmemo_pad ? `<span>${icoon('geluid', 15)} memo</span>` : ''}
      ${wachtOpDaan ? `<span class="cta">${icoon('mic', 14)} Inspreken</span>` : ''}
    </div>
  </article>`;
}

function kortNaam(naam) {
  const zonderDatum = String(naam).replace(/^\d{4}-\d{2}-\d{2}_/, '');
  return zonderDatum.length > 30 ? `${zonderDatum.slice(0, 29)}…` : zonderDatum;
}

function keuzeRij(naam, opties, gekozen) {
  return `<div class="keuze">${Object.entries(opties).map(([k, o]) => `<label><input type="radio" name="${naam}" value="${k}" ${k === gekozen ? 'checked' : ''}><span class="chip">${esc(o.label)}</span></label>`).join('')}</div>`;
}

function postPaneel(post) {
  const nieuw = !post;
  const p = post || { datum: nu(), merk: 'pellens', kanaal: 'reel', thema: 'vuur', idee: '', beeld: [], status: 'tekst_nodig' };
  const details = S.lid.rol !== 'manager';
  const kanaal = KANALEN[p.kanaal] || KANALEN.reel;
  const gekozenBeeld = new Set((p.beeld || []).map(b => b.naam));
  const recent = S.uploads.slice(0, 12);

  const detailVelden = details ? `
    <label class="veld"><span>Wanneer</span><input type="date" name="datum" required value="${esc(p.datum)}"></label>
    <div class="veld"><span>Merk</span>${keuzeRij('merk', { pellens: { label: 'Pellens' }, brouwerij: { label: 'Brouwerij de Brouwer' } }, p.merk)}</div>
    <div class="veld"><span>Kanaal</span>${keuzeRij('kanaal', KANALEN, p.kanaal)}</div>
    <div class="veld"><span>Thema</span>${keuzeRij('thema', THEMAS, p.thema)}</div>
    <label class="veld"><span>Waar gaat de post over?</span>
      <textarea name="idee" maxlength="600" required placeholder="Wat zie je, wat gebeurt er? Kort is goed.">${esc(p.idee)}</textarea></label>
    ${recent.length ? `<div class="veld"><span>Beeld uit de beeldbank</span>
      <div class="keuze">${recent.map(u => `<label><input type="checkbox" name="beeld" value="${esc(u.naam)}" data-link="${esc(u.link || '')}" ${gekozenBeeld.has(u.naam) ? 'checked' : ''}><span class="chip">${esc(kortNaam(u.naam))}</span></label>`).join('')}</div></div>` : ''}
  ` : `
    <p class="sub">${korteDatum(p.datum)} · ${esc((MERKEN[p.merk] || MERKEN.pellens).label)}</p>
    <p class="idee" style="margin:10px 0 16px">${esc(p.idee)}</p>`;

  const tekstDeel = nieuw ? `<p class="mini" style="margin-bottom:12px">Na het opslaan kan Daan de tekst inspreken.</p>` : `
    <div class="kop" style="display:flex;justify-content:space-between;align-items:center;margin:6px 0 8px">
      <h3 class="serif" style="font-size:20px;font-weight:450">Tekst</h3><span class="geen-ai">Eigen woorden, geen AI</span>
    </div>
    <textarea name="tekst" maxlength="2200" id="post-tekst" placeholder="${isEigenaar() ? 'Spreek je tekst in of typ hem hier.' : 'Hier komt de tekst van Daan.'}">${esc(p.tekst || '')}</textarea>
    <div class="teller"><span id="teller">${(p.tekst || '').length}</span>/2200</div>
    <div class="inspreek">
      ${dicterenKan()
        ? `<button type="button" class="mic" data-actie="dicteer" aria-label="Dicteren starten of stoppen">${icoon('mic', 24)}</button><div class="mic-uitleg"><b>Tik en praat</b>Je woorden verschijnen direct als tekst.</div>`
        : '<div class="mic-uitleg"><b>Inspreken?</b>Tik op het microfoontje van je toetsenbord en praat.</div>'}
    </div>
    ${memoKan() ? `<div class="inspreek">
      <button type="button" class="mic op-memo" data-actie="memo" aria-label="Spraakmemo opnemen of stoppen">${icoon('opname', 24)}</button>
      <div class="mic-uitleg"><b>Spraakmemo</b>Vertel je verhaal, Mila typt het letterlijk uit.</div>
      <div class="golf" id="golf" hidden>${'<i></i>'.repeat(16)}</div>
    </div>` : ''}
    <div id="memo-speler">${p.spraakmemo_pad ? `<button type="button" class="knop stil klein" data-actie="memo-luister" data-pad="${esc(p.spraakmemo_pad)}">${icoon('geluid')} Spraakmemo afspelen</button>` : ''}</div>
    <p class="mini" style="margin-top:10px">${p.tekst_goedgekeurd ? 'Goedgekeurd door Daan.' : p.tekst ? 'Wacht op goedkeuring van Daan.' : ''}</p>`;

  const knoppen = [];
  if (details || !nieuw) knoppen.push('<button class="knop" type="submit" value="opslaan">Opslaan</button>');
  if (!nieuw && isEigenaar()) knoppen.push(`<button class="knop groen" type="submit" value="goedkeuren">${icoon('check')} Goedkeuren</button>`);
  if (!nieuw && p.tekst_goedgekeurd && p.tekst) knoppen.push(`<button class="knop stil" type="button" data-actie="kopieer">${icoon('kopie')} Kopieer tekst</button>`);
  if (!nieuw && p.status === 'tekst_klaar' && details) knoppen.push(`<button class="knop stil" type="submit" value="ingepland">${icoon('kalender')} Ingepland</button>`);
  if (!nieuw && p.status === 'ingepland' && details) knoppen.push(`<button class="knop stil" type="submit" value="geplaatst">${icoon('check')} Geplaatst</button>`);

  return `
    <h2>${nieuw ? 'Nieuwe post' : `${kanaal.emoji} ${esc(kanaal.label)}`}</h2>
    <form data-form="post" data-id="${esc(p.id || '')}">
      ${detailVelden}
      ${tekstDeel}
      <p class="fout-tekst" data-fout></p>
      <div class="knoppen${knoppen.length === 1 ? ' een' : ''}">${knoppen.join('')}</div>
      ${!nieuw && details ? `<div style="text-align:center;margin-top:10px"><button type="button" class="link-knop" data-actie="post-weg" data-id="${esc(p.id)}">Post verwijderen</button></div>` : ''}
    </form>`;
}

// Zolang de Google-koppeling niet is ingesteld, gaat uploaden via de Drive-app.
// In de demo is dat te bekijken met ?demo&zonderdrive.
function directUploaden() {
  if (opslag.demo) return !new URLSearchParams(location.search).has('zonderdrive');
  return Boolean(config.driveUpload);
}

function viewUploadViaDrive() {
  return `
    <h1 class="titel">Beeldbank</h1>
    <p class="sub" style="margin:6px 0 16px">Alles komt in de BEELDBANK op Google Drive.</p>

    <section class="kaart gloed">
      <p class="label" style="margin-bottom:6px">${icoon('uploaden', 14)} Uploaden via Drive</p>
      <h2>Kies de map en zet je beeld erin</h2>
      <p class="sub" style="margin:6px 0 14px">Tik op een onderwerp. De map opent in Google Drive. Tik daar op + en kies Uploaden.
        Direct uploaden vanuit deze app komt zodra de Google-koppeling klaar is.</p>
      <a class="knop" href="${driveMapUrl('nieuw')}" target="_blank" rel="noopener">${icoon('beeld')} Open de beeldbank</a>
    </section>

    <h2 style="margin:20px 0 2px">Of kies direct de map</h2>
    <div class="stickers">
      ${ONDERWERPEN.filter(o => o.map).map(o => `<a class="sticker" href="${driveMapUrl(o.key)}" target="_blank" rel="noopener" style="text-decoration:none">${esc(o.label)}</a>`).join('')}
    </div>
    <p class="mini" style="text-align:center">Twijfel je over de map? Zet het in de beeldbank zelf, dan sorteert Mila het op vrijdag.</p>`;
}

function viewUpload() {
  if (!directUploaden()) return viewUploadViaDrive();
  const u = S.upload;
  const voorbeelden = u.bestanden.map(b => {
    const mime = mimeVan(b.file);
    const kanTonen = /^image\/(jpeg|png|webp|gif)/.test(mime);
    const inhoud = kanTonen
      ? `<img src="${b.url}" alt="">`
      : mime.startsWith('video/') ? `<video src="${b.url}" muted playsinline preload="metadata"></video>` : icoon('camera', 30);
    return `<div class="voorbeeld${b.status === 'klaar' ? ' klaar' : ''}${b.status === 'fout' ? ' fout' : ''}" title="${esc(b.file.name)}">
      ${inhoud}
      ${u.bezig || b.status === 'klaar' ? '' : `<button class="weg" data-actie="bestand-weg" data-id="${b.id}" aria-label="Verwijder ${esc(b.file.name)}">✕</button>`}
      ${b.status === 'bezig' || b.voortgang ? `<div class="balk" data-voortgang="${b.id}"><i style="width:${Math.round((b.voortgang || 0) * 100)}%"></i></div>` : ''}
    </div>`;
  }).join('');
  const fouten = u.bestanden.filter(b => b.status === 'fout');

  return `
    <h1 class="titel">Beeldbank</h1>
    <p class="sub" style="margin:6px 0 16px">Alles komt direct in de BEELDBANK op Google Drive, met je naam en de datum erbij.</p>

    <label class="dropzone" id="dropzone">
      <input type="file" accept="image/*,video/*" multiple data-input="bestanden" ${u.bezig ? 'disabled' : ''} aria-label="Kies foto's of video's">
      <span class="dz-icoon">${icoon('uploaden', 40)}</span>
      <b>Drop je beeld</b>
      <span class="sub">Tik om foto's of video's te kiezen</span>
    </label>

    ${u.bestanden.length ? `
      <div class="voorbeelden">${voorbeelden}</div>
      ${fouten.length ? `<p class="fout-tekst">${fouten.map(f => esc(f.fout)).join(' · ')}</p>` : ''}
      <h2 style="margin:6px 0 2px">Waar hoort het bij?</h2>
      <div class="stickers">
        ${ONDERWERPEN.map(o => `<button class="sticker${u.onderwerp === o.key ? ' aan' : ''}" data-actie="kies-onderwerp" data-key="${o.key}" ${u.bezig ? 'disabled' : ''}>${esc(o.label)}</button>`).join('')}
      </div>
      <button class="knop" data-actie="upload-start" ${!u.onderwerp || u.bezig ? 'disabled' : ''}>
        ${u.bezig ? 'Bezig met uploaden…' : `Uploaden naar de beeldbank (${u.bestanden.filter(b => b.status !== 'klaar').length})`}
      </button>` : ''}

    <section class="kaart" style="margin-top:18px">
      <div class="kop"><h2>Laatst geüpload</h2></div>
      ${S.uploads.length ? S.uploads.slice(0, 15).map(r => {
        const o = onderwerp(r.onderwerp) || { label: r.onderwerp };
        return `<div class="bestand"><span class="e">${icoon(/^video/.test(r.mime || '') ? 'geluid' : 'beeld')}</span>
          <div><div class="naam">${esc(r.naam)}</div><div class="mini">${esc(teamlid(r.email).naam)} · ${esc(o.label)} · ${geledenTekst(r.created_at)}</div></div>
          ${r.link ? `<a href="${esc(r.link)}" target="_blank" rel="noopener">Open</a>` : ''}</div>`;
      }).join('') : '<p class="leeg">Nog niets geüpload. Jij mag de eerste zijn.</p>'}
    </section>`;
}

function viewMeer() {
  const rol = ROLLEN[S.lid.rol] || { label: S.lid.rol, taak: '' };
  return `
    <h1 class="titel" style="margin-bottom:16px">Meer</h1>
    <div class="kaart" style="display:flex;gap:14px;align-items:center">
      ${avatar(S.lid)}
      <div><h2>${esc(S.lid.naam)}</h2><p class="sub">${esc(rol.label)} · ${esc(rol.taak)}</p></div>
    </div>
    <div class="tegels">
      <a class="kaart klik" href="#doelen"><span class="e">${icoon('doel', 26)}</span><div><b>Doelen</b><p class="mini">Tot eind maart 2027</p></div></a>
      <a class="kaart klik" href="#cijfers"><span class="e">${icoon('grafiek', 26)}</span><div><b>Cijfers</b><p class="mini">Week en maand invullen</p></div></a>
      <a class="kaart klik" href="#maandag"><span class="e">${icoon('klok', 26)}</span><div><b>Maandagkwartier</b><p class="mini">15 minuten, 3 stappen</p></div></a>
      <a class="kaart klik" href="#plan"><span class="e">${icoon('kaart', 26)}</span><div><b>Het plan</b><p class="mini">Zes maanden vooruit</p></div></a>
    </div>
    <section class="kaart" style="margin-top:12px">
      <p class="label" style="margin-bottom:10px">${icoon('thema', 14)} Weergave</p>
      <div class="chips">${Object.entries(WEERGAVEN).map(([k, naam]) => `<button class="chip${huidigThema() === k ? ' aan' : ''}" data-actie="thema" data-thema="${k}" aria-pressed="${huidigThema() === k}">${naam}</button>`).join('')}</div>
    </section>
    ${opslag.demo ? `
      <section class="kaart gloed" style="margin-top:12px">
        <h2>Je kijkt naar de demo</h2>
        <p class="sub" style="margin:4px 0 12px">Niets gaat naar de server. Bekijk de app door de ogen van:</p>
        <div class="chips">${DEMO_TEAM.map(l => `<button class="chip${l.email === S.lid.email ? ' aan' : ''}" data-actie="demo-als" data-email="${l.email}">${avatar(l, true)} ${esc(l.naam)}</button>`).join('')}</div>
        <div class="knoppen een"><button class="knop stil" data-actie="demo-reset">Demo opnieuw beginnen</button></div>
      </section>` : ''}
    <div class="knoppen een" style="margin-top:14px"><button class="knop stil" data-actie="uitloggen">Uitloggen</button></div>`;
}

function viewDoelen() {
  const kaarten = S.doelen.map(doel => {
    const m = metric(doel.metric) || { decimalen: 0 };
    const laatst = laatsteMeting(S.metingen, doel.metric);
    const huidig = laatst ? Number(laatst.waarde) : null;
    const v = voortgang(doel, huidig);
    const geenDoel = doel.doel_maart == null;
    return `<article class="kaart doel">
      <div class="kop"><h3>${esc(doel.label)}</h3>${isEigenaar() ? `<button class="link-knop" data-actie="doel-bewerk" data-metric="${esc(doel.metric)}">Aanpassen</button>` : ''}</div>
      <div class="waarde">${getal(huidig ?? doel.start_waarde, m.decimalen)} <small>${huidig == null ? 'start' : 'nu'}${geenDoel ? '' : ` · doel ${getal(doel.doel_maart, m.decimalen)}`}</small></div>
      ${geenDoel ? '<p class="mini" style="margin-top:10px">Doel volgt na de nulmeting in oktober.</p>' : v ? `
        <div class="balk-groot" role="img" aria-label="${Math.round(v.procent * 100)} procent van het doel">
          <i style="width:${Math.max(3, v.procent * 100)}%"></i>
          ${v.tussenstap != null ? `<span class="merkpunt" style="left:${v.tussenstap * 100}%" title="Tussendoel december"></span>` : ''}
        </div>
        <div class="doel-voet"><span>Start ${getal(doel.start_waarde, m.decimalen)}</span><span>Dec ${getal(doel.doel_december, m.decimalen)}</span><span>Mrt ${getal(doel.doel_maart, m.decimalen)}</span></div>
        ${v.gehaald ? '<p class="mini" style="margin-top:8px;color:var(--salie)">Doel gehaald.</p>' : ''}`
        : '<p class="mini" style="margin-top:10px">Nog geen meting. Vul de cijfers in om de voortgang te zien.</p>'}
    </article>`;
  }).join('');
  return `
    <header class="paginakop"><a class="rond-knop" href="#meer" aria-label="Terug">${PIJL_LINKS}</a><div class="midden"><h1 class="titel">Doelen</h1><p class="sub">Tot eind maart 2027 · streepje = december</p></div></header>
    ${kaarten || '<div class="kaart"><p class="leeg">Nog geen doelen ingesteld.</p></div>'}`;
}

function doelPaneel(doel) {
  const veld = (naam, label, waarde) => `<label class="veld"><span>${label}</span><input type="number" step="any" min="0" name="${naam}" value="${waarde ?? ''}" inputmode="decimal"></label>`;
  return `<h2>${esc(doel.label)}</h2>
    <form data-form="doel" data-metric="${esc(doel.metric)}">
      ${veld('start_waarde', 'Startwaarde', doel.start_waarde)}
      ${veld('doel_december', 'Doel eind december', doel.doel_december)}
      ${veld('doel_maart', 'Doel eind maart', doel.doel_maart)}
      <p class="fout-tekst" data-fout></p>
      <button class="knop" type="submit">Opslaan</button>
    </form>`;
}

function maandPlus(eerste, n) {
  let d = eerste;
  for (let i = 0; i < Math.abs(n); i += 1) {
    if (n < 0) d = vorigeMaand(d);
    else d = plusDagen(`${d.slice(0, 7)}-28`, 4).slice(0, 7) + '-01';
  }
  return d;
}

function cijferPeriode() {
  if (S.cijferSoort === 'week') {
    const maandag = plusDagen(dezeMaandag(), -7 + 7 * S.cijferVerschuiving);
    return { start: maandag, label: `Week ${weekNummer(maandag)} · ${weekBereik(maandag)}` };
  }
  const start = maandPlus(vorigeMaand(nu()), S.cijferVerschuiving);
  return { start, label: `${maandNaam(start)} ${start.slice(0, 4)}` };
}

function metingVelden(soort, periode) {
  return METRICS.filter(m => m.periode === soort).map(m => {
    const bestaand = S.metingen.find(x => x.metric === m.key && x.periode_start === periode);
    const waarden = reeks(S.metingen, m.key).map(x => Number(x.waarde));
    return `<div class="meting">
      <label for="m-${m.key}"><span class="naam">${esc(m.label)}</span>${m.rol === S.lid.rol ? '<span class="jij">jij</span>' : ''}${vonk(waarden)}</label>
      <input id="m-${m.key}" type="number" inputmode="decimal" step="any" min="0" name="${m.key}" value="${bestaand ? Number(bestaand.waarde) : ''}" placeholder="–">
    </div>`;
  }).join('');
}

function viewCijfers() {
  const { start, label } = cijferPeriode();
  return `
    <header class="paginakop"><a class="rond-knop" href="#meer" aria-label="Terug">${PIJL_LINKS}</a><div class="midden"><h1 class="titel">Cijfers</h1><p class="sub">Zes cijfers vertellen of het werkt</p></div></header>
    <div class="segment" role="tablist">
      <button class="${S.cijferSoort === 'week' ? 'aan' : ''}" data-actie="cijfer-soort" data-soort="week" role="tab" aria-selected="${S.cijferSoort === 'week'}">Per week</button>
      <button class="${S.cijferSoort === 'maand' ? 'aan' : ''}" data-actie="cijfer-soort" data-soort="maand" role="tab" aria-selected="${S.cijferSoort === 'maand'}">Per maand</button>
    </div>
    <div class="paginakop" style="margin:0 0 12px">
      <button class="rond-knop" data-actie="cijfer-terug" aria-label="Eerder">${PIJL_LINKS}</button>
      <div class="midden" style="text-align:center"><h2>${esc(label)}</h2></div>
      <button class="rond-knop" data-actie="cijfer-verder" aria-label="Later" ${S.cijferVerschuiving >= 0 ? 'disabled' : ''}>${PIJL_RECHTS}</button>
    </div>
    <form data-form="cijfers" data-periode="${start}" data-soort="${S.cijferSoort}" class="kaart">
      ${metingVelden(S.cijferSoort, start)}
      <p class="fout-tekst" data-fout></p>
      <button class="knop" type="submit" style="margin-top:8px">Opslaan</button>
    </form>
    <p class="mini" style="text-align:center">Geen likes of views: die zeggen niets over gasten aan tafel.</p>`;
}

function viewMaandag() {
  const k = S.kwartier;
  const vorigeMaandag = plusDagen(dezeMaandag(), -7);
  const stappen = `<div class="stappen" aria-hidden="true">${[1, 2, 3].map(i => `<i class="${i <= k.stap ? 'aan' : ''}"></i>`).join('')}</div>`;
  const kop = `<header class="paginakop"><a class="rond-knop" href="#meer" aria-label="Terug">${PIJL_LINKS}</a>
    <div class="midden"><h1 class="titel">Maandag&shy;kwartier</h1><p class="sub">Stap ${k.stap} van 3</p></div>
    <span class="klok" id="klok">00:00</span></header>${stappen}`;

  if (k.stap === 1) {
    return `${kop}
      <form data-form="kwartier-cijfers" data-periode="${vorigeMaandag}" class="kaart">
        <h2 style="margin-bottom:6px">Cijfers van vorige week</h2>
        <p class="sub" style="margin-bottom:8px">Week ${weekNummer(vorigeMaandag)} · ${weekBereik(vorigeMaandag)}</p>
        ${metingVelden('week', vorigeMaandag)}
        <p class="fout-tekst" data-fout></p>
        <button class="knop" type="submit">Volgende →</button>
      </form>`;
  }

  if (k.stap === 2) {
    const open = takenVoorWeek(S.taken, vorigeMaandag).filter(t => t.status === 'open');
    return `${kop}
      <section class="kaart">
        <h2 style="margin-bottom:6px">Vorige week: af of niet af?</h2>
        <p class="sub" style="margin-bottom:8px">Niet af schuift door. Er komt niets nieuws bovenop.</p>
        ${open.length ? open.map(t => `<div class="taak">
            <div class="taak-tekst"><h3>${esc(t.titel)}</h3><p class="meta">${avatar(teamlid(t.eigenaar), true)} ${esc(teamlid(t.eigenaar).naam)}</p>
            <div class="chips" style="margin-top:10px">
              <button class="chip" data-actie="kwartier-af" data-id="${esc(t.id)}">${icoon('check', 15)} Af</button>
              <button class="chip${k.doorgeschoven.has(t.id) ? ' aan' : ''}" data-actie="kwartier-door" data-id="${esc(t.id)}">Schuift door</button>
            </div></div></div>`).join('') : '<p class="leeg">Alles van vorige week is af. Lekker.</p>'}
      </section>
      <div class="knoppen"><button class="knop stil" data-actie="kwartier-stap" data-stap="1">← Terug</button><button class="knop" data-actie="kwartier-stap" data-stap="3">Volgende →</button></div>`;
  }

  const lijst = takenVoorWeek(S.taken, dezeMaandag());
  const plekken = vrijePlekken(S.taken, dezeMaandag());
  return `${kop}
    <section class="kaart">
      <h2 style="margin-bottom:6px">Drie taken voor deze week</h2>
      <p class="sub" style="margin-bottom:6px">${plekken ? `Nog ${plekken} ${plekken === 1 ? 'plek' : 'plekken'}. Met een naam erbij.` : 'Vol. Mooi zo.'}</p>
      ${lijst.map(taakRij).join('')}
    </section>
    ${plekken ? `<form data-form="kwartier-taak" class="kaart">
        <label class="veld"><span>Nieuwe taak</span><input type="text" name="titel" maxlength="140" required placeholder="Wat maakt deze week het verschil?"></label>
        <div class="keuze">${S.team.map((l, i) => `<label><input type="radio" name="eigenaar" value="${esc(l.email)}" ${i === 0 ? 'required' : ''} ${l.email === S.lid.email ? 'checked' : ''}><span class="chip">${avatar(l, true)} ${esc(l.naam)}</span></label>`).join('')}</div>
        <p class="fout-tekst" data-fout></p>
        <button class="knop stil" type="submit">+ Toevoegen</button>
      </form>` : ''}
    <div class="knoppen"><button class="knop stil" data-actie="kwartier-stap" data-stap="2">← Terug</button><button class="knop" data-actie="kwartier-klaar">Klaar</button></div>`;
}

function viewPlan() {
  const huidige = maandVanPlan(nu()).maand;
  return `
    <header class="paginakop"><a class="rond-knop" href="#meer" aria-label="Terug">${PIJL_LINKS}</a><div class="midden"><h1 class="titel">Het plan</h1><p class="sub">Oktober 2026 tot en met maart 2027</p></div></header>
    <div class="maanden" id="maanden">
      ${MAANDEN.map(m => `<article class="kaart maand${m.maand === huidige ? ' nu' : ''}" ${m.maand === huidige ? 'id="maand-nu"' : ''}>
        <p class="mini">${m.maand.slice(0, 4)}</p><h2>${esc(m.naam)}</h2><p class="sub">${esc(m.thema)}</p>
        <ul>${m.momenten.map(x => `<li>${esc(x)}</li>`).join('')}</ul>
      </article>`).join('')}
    </div>
    <section class="kaart"><h2 style="margin-bottom:12px">Spelregels</h2><ol class="regels">${SPELREGELS.map(r => `<li>${esc(r)}</li>`).join('')}</ol></section>
    <section class="kaart"><h2 style="margin-bottom:8px">Het ritme</h2>${RITME.map(r => `<div class="ritme-rij"><b>${esc(r.wanneer)}</b><span>${esc(r.wat)} <span class="vaag">· ${esc(r.wie)}</span></span></div>`).join('')}</section>
    <section class="kaart"><h2 style="margin-bottom:8px">Vijf thema's</h2>${Object.values(THEMAS).map(t => `<div class="ritme-rij"><b>${esc(t.label)}</b><span>${esc(t.uitleg)}</span></div>`).join('')}</section>
    ${config.planUrl ? `<a class="knop stil" href="${esc(config.planUrl)}" target="_blank" rel="noopener">Volledig plan openen</a>` : ''}`;
}

// ---------------------------------------------------------------------------
// Inloggen

function viewLogin(fout = '') {
  nav.hidden = true;
  app.innerHTML = `<section class="login binnen">
    ${monogram(84)}
    <div class="login-merk">Pellens<br><em>marketing</em></div>
    <p class="slogan">Van eigen akker, op het vuur.</p>
    ${opslag.demo ? `
      <p class="sub" style="margin-bottom:12px">Demo: kies wie je bent.</p>
      <div class="demo-keuze">${DEMO_TEAM.map(l => `<button class="knop ${l.rol === 'social' ? '' : 'stil'}" data-actie="demo-als" data-email="${l.email}">${avatar(l, true)} ${esc(l.naam)} <small>${esc(ROLLEN[l.rol].label)}</small></button>`).join('')}</div>`
    : `
      ${loginFormulier(fout)}`}
  </section>`;
}

function loginFormulier(fout = '') {
  return `<form data-form="login">
    <label class="veld"><span>E-mail</span><input type="email" name="email" autocomplete="email" required></label>
    <label class="veld"><span>Wachtwoord</span><input type="password" name="wachtwoord" autocomplete="current-password" required></label>
    <p class="fout-tekst" data-fout>${esc(fout)}</p>
    <button class="knop" type="submit">Inloggen</button>
    <p class="mini" style="text-align:center;margin-top:14px">Log in met je Pellens-account, hetzelfde als in de team-app.<br>Wachtwoord vergeten? Dat regel je in de team-app.</p>
  </form>`;
}

// ---------------------------------------------------------------------------
// Render en routes

const PAGINAS = {
  vandaag: viewVandaag, week: viewWeek, posts: viewPosts, upload: viewUpload, meer: viewMeer,
  doelen: viewDoelen, cijfers: viewCijfers, maandag: viewMaandag, plan: viewPlan,
};
const ONDER_MEER = new Set(['meer', 'doelen', 'cijfers', 'maandag', 'plan']);

function route() {
  const [pagina, arg] = location.hash.replace(/^#/, '').split('/');
  return { pagina: PAGINAS[pagina] ? pagina : 'vandaag', arg };
}

function render({ animeer = false } = {}) {
  if (!S.lid) return;
  const { pagina } = route();
  app.innerHTML = `${topbalk()}<div class="${animeer ? 'binnen' : ''}">${PAGINAS[pagina]()}</div>`;
  nav.hidden = false;
  const actief = ONDER_MEER.has(pagina) ? 'meer' : pagina;
  nav.querySelectorAll('a').forEach(a => {
    a.classList.toggle('aan', a.dataset.nav === actief);
    if (a.dataset.nav === actief) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current');
  });
  naRender(pagina);
}

function naRender(pagina) {
  clearInterval(S.klok);
  if (pagina === 'maandag') {
    if (!S.kwartier.start) S.kwartier.start = Date.now();
    const tik = () => {
      const el = document.getElementById('klok');
      if (!el) return clearInterval(S.klok);
      const s = Math.floor((Date.now() - S.kwartier.start) / 1000);
      el.textContent = `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
      el.style.color = s > 15 * 60 ? 'var(--rood)' : '';
    };
    tik();
    S.klok = setInterval(tik, 1000);
  }
  if (pagina === 'plan') {
    const nuMaand = document.getElementById('maand-nu');
    if (nuMaand) nuMaand.scrollIntoView({ inline: 'center', block: 'nearest' });
  }
}

function werkVandaagBij() {
  const d = nu();
  const routines = routinesVoor(S.lid.rol, d);
  const gedaan = new Set(S.checks.filter(c => c.datum === d).map(c => c.routine));
  const aantal = routines.filter(r => gedaan.has(r.key)).length;
  const cirkel = document.getElementById('ring-vandaag');
  if (cirkel) {
    const omtrek = Number(cirkel.dataset.omtrek);
    cirkel.style.strokeDashoffset = String(omtrek * (1 - (routines.length ? aantal / routines.length : 0)));
    document.getElementById('ring-vandaag-tekst').textContent = `${aantal}/${routines.length}`;
  }
  const getal = document.getElementById('streak-getal');
  if (getal) getal.textContent = String(streak(S.checks, S.lid.rol, d));
  return { aantal, totaal: routines.length };
}

// ---------------------------------------------------------------------------
// Inspreken en spraakmemo

function stopOpname() {
  if (!S.opname) return;
  const opname = S.opname;
  S.opname = null;
  if (opname.soort === 'dicteer') opname.stop();
  if (opname.soort === 'memo') opname.recorder.annuleer();
  document.querySelectorAll('.mic.actief').forEach(m => m.classList.remove('actief'));
  const golf = document.getElementById('golf');
  if (golf) golf.hidden = true;
}

function telTekens() {
  const veld = document.getElementById('post-tekst');
  const teller = document.getElementById('teller');
  if (veld && teller) teller.textContent = String(veld.value.length);
}

// ---------------------------------------------------------------------------
// Acties

const acties = {
  'sluit-paneel': () => sluitPaneel(),

  async routine(el) {
    const key = el.dataset.key;
    const d = nu();
    const aan = !S.checks.some(c => c.datum === d && c.routine === key);
    const rij = el.closest('.rij');
    if (aan) S.checks.push({ datum: d, routine: key, email: S.lid.email });
    else S.checks = S.checks.filter(c => !(c.datum === d && c.routine === key));
    rij.classList.toggle('aan', aan);
    el.setAttribute('aria-pressed', String(aan));
    tril(aan ? 14 : 6);
    const { aantal, totaal } = werkVandaagBij();
    if (aan) {
      confettiBij(el.querySelector('.vink'));
      if (aantal === totaal) {
        setTimeout(() => confetti({ aantal: 160, kracht: 1.2 }), 180);
        melding('Alles af vandaag. Mooi werk.');
      }
    }
    try {
      await opslag.check(d, key, aan);
    } catch (e) {
      if (aan) S.checks = S.checks.filter(c => !(c.datum === d && c.routine === key));
      else S.checks.push({ datum: d, routine: key, email: S.lid.email });
      melding(e.message, 'fout');
      render();
    }
  },

  'week-terug': () => { S.weekVerschuiving -= 1; render(); },
  'week-verder': () => { S.weekVerschuiving += 1; render(); },
  'posts-terug': () => { S.postsVerschuiving -= 1; render(); },
  'posts-verder': () => { S.postsVerschuiving += 1; render(); },

  'taak-nieuw': el => openPaneel(taakPaneel(null, el.dataset.week)),
  'taak-open': el => openPaneel(taakPaneel(S.taken.find(t => t.id === el.dataset.id))),

  async 'taak-af'(el) {
    const taak = S.taken.find(t => t.id === el.dataset.id);
    if (!taak) return;
    const status = taak.status === 'af' ? 'open' : 'af';
    await bewaar(() => opslag.taakBijwerken(taak.id, { status }));
    taak.status = status;
    if (status === 'af') {
      tril(24);
      confettiBij(el, { aantal: 70 });
      const week = takenVoorWeek(S.taken, plusDagen(dezeMaandag(), 7 * S.weekVerschuiving));
      if (week.length && week.every(t => t.status === 'af')) {
        setTimeout(() => confetti({ aantal: 200, kracht: 1.3 }), 200);
        melding('Alle weektaken af.');
      }
    }
    render();
  },

  async 'taak-weg'(el) {
    if (!confirm('Deze taak verwijderen?')) return;
    await bewaar(() => opslag.taakVerwijderen(el.dataset.id));
    S.taken = S.taken.filter(t => t.id !== el.dataset.id);
    sluitPaneel();
    render();
  },

  'post-filter': el => { S.postFilter.status = el.dataset.status; render(); },
  'post-merk': el => { S.postFilter.merk = el.dataset.merk; render(); },
  'post-nieuw': () => openPaneel(postPaneel(null)),
  'post-open': el => {
    const post = S.posts.find(p => p.id === el.dataset.id);
    if (post) openPaneel(postPaneel(post));
  },

  async 'post-weg'(el) {
    if (!confirm('Deze post verwijderen?')) return;
    await bewaar(() => opslag.postVerwijderen(el.dataset.id));
    S.posts = S.posts.filter(p => p.id !== el.dataset.id);
    sluitPaneel();
    render();
  },

  async kopieer() {
    const veld = document.getElementById('post-tekst');
    try {
      await navigator.clipboard.writeText(veld.value);
      melding('Gekopieerd. Plakken maar.');
    } catch {
      veld.select();
      melding('Selecteer en kopieer de tekst handmatig.', 'fout');
    }
  },

  dicteer(el) {
    if (S.opname && S.opname.soort === 'dicteer') { stopOpname(); return; }
    stopOpname();
    const veld = document.getElementById('post-tekst');
    const basis = veld.value ? `${veld.value.replace(/\s+$/, '')} ` : '';
    let vast = '';
    el.classList.add('actief');
    tril();
    const stop = startDicteren({
      opTekst(definitief, voorlopig) {
        vast += definitief;
        veld.value = `${basis}${vast}${voorlopig}`.slice(0, 2200);
        telTekens();
      },
      opStop() {
        el.classList.remove('actief');
        if (S.opname && S.opname.soort === 'dicteer') S.opname = null;
      },
      opFout(tekst) { melding(tekst, 'fout'); },
    });
    S.opname = { soort: 'dicteer', stop };
  },

  async memo(el) {
    const form = el.closest('form');
    const postId = form.dataset.id;
    if (S.opname && S.opname.soort === 'memo') {
      const { recorder } = S.opname;
      S.opname = null;
      el.classList.remove('actief');
      document.getElementById('golf').hidden = true;
      const blob = await recorder.stop();
      if (blob.size < 1500) { melding('Te kort. Probeer het nog eens.', 'fout'); return; }
      melding('Spraakmemo opslaan…');
      const pad = await bewaar(() => opslag.memoOpslaan(postId, blob));
      const post = S.posts.find(p => p.id === postId);
      const opgeslagen = await bewaar(() => opslag.postOpslaan({ id: postId, spraakmemo_pad: pad }));
      Object.assign(post, opgeslagen);
      document.getElementById('memo-speler').innerHTML = `<button type="button" class="knop stil klein" data-actie="memo-luister" data-pad="${esc(pad)}">${icoon('geluid')} Spraakmemo afspelen</button>`;
      melding('Spraakmemo staat erbij.');
      return;
    }
    stopOpname();
    try {
      const golf = document.getElementById('golf');
      const balkjes = [...golf.querySelectorAll('i')];
      const recorder = await startMemo({
        opNiveau(n) {
          balkjes.forEach((b, i) => { b.style.height = `${6 + n * 28 * (0.45 + 0.55 * Math.abs(Math.sin(i * 1.7 + Date.now() / 180)))}px`; });
        },
      });
      golf.hidden = false;
      el.classList.add('actief');
      tril();
      S.opname = { soort: 'memo', recorder };
    } catch {
      melding('Geef de app toegang tot je microfoon.', 'fout');
    }
  },

  async 'memo-luister'(el) {
    const url = await bewaar(() => opslag.memoUrl(el.dataset.pad));
    if (!url) { melding('Deze memo is niet meer beschikbaar.', 'fout'); return; }
    el.outerHTML = `<audio controls autoplay src="${esc(url)}"></audio>`;
  },

  'bestand-weg': el => {
    const b = S.upload.bestanden.find(x => x.id === el.dataset.id);
    if (b) URL.revokeObjectURL(b.url);
    S.upload.bestanden = S.upload.bestanden.filter(x => x.id !== el.dataset.id);
    render();
  },

  'kies-onderwerp': el => {
    S.upload.onderwerp = el.dataset.key;
    tril(8);
    render();
  },

  async 'upload-start'() {
    const u = S.upload;
    if (!u.onderwerp || u.bezig) return;
    u.bezig = true;
    render();
    for (const b of u.bestanden.filter(x => x.status !== 'klaar')) {
      b.status = 'bezig';
      b.voortgang = 0.02;
      render();
      try {
        const rij = await uploadNaarBeeldbank(opslag, b.file, u.onderwerp, v => {
          b.voortgang = v;
          const balk = document.querySelector(`[data-voortgang="${b.id}"] i`);
          if (balk) balk.style.width = `${Math.round(v * 100)}%`;
        });
        b.status = 'klaar';
        S.uploads.unshift(rij);
      } catch (e) {
        b.status = 'fout';
        b.fout = `${b.file.name}: ${e.message}`;
      }
    }
    u.bezig = false;
    const klaar = u.bestanden.filter(b => b.status === 'klaar').length;
    const fouten = u.bestanden.filter(b => b.status === 'fout').length;
    render();
    if (klaar) {
      confetti({ aantal: 180, kracht: 1.2 });
      tril(30);
      melding(`${klaar} ${klaar === 1 ? 'bestand staat' : 'bestanden staan'} in de beeldbank.`);
    }
    if (!fouten) {
      setTimeout(() => {
        u.bestanden.forEach(b => URL.revokeObjectURL(b.url));
        u.bestanden = [];
        u.onderwerp = null;
        if (route().pagina === 'upload') render();
      }, 1400);
    }
  },

  'doel-bewerk': el => openPaneel(doelPaneel(S.doelen.find(d => d.metric === el.dataset.metric))),

  'cijfer-soort': el => { S.cijferSoort = el.dataset.soort; S.cijferVerschuiving = 0; render(); },
  'cijfer-terug': () => { S.cijferVerschuiving -= 1; render(); },
  'cijfer-verder': () => { S.cijferVerschuiving = Math.min(0, S.cijferVerschuiving + 1); render(); },

  'kwartier-stap': el => { S.kwartier.stap = Number(el.dataset.stap); render(); },

  async 'kwartier-af'(el) {
    const taak = S.taken.find(t => t.id === el.dataset.id);
    await bewaar(() => opslag.taakBijwerken(taak.id, { status: 'af' }));
    taak.status = 'af';
    confettiBij(el);
    tril(20);
    render();
  },

  'kwartier-door': el => {
    S.kwartier.doorgeschoven.add(el.dataset.id);
    render();
  },

  'kwartier-klaar'() {
    const minuten = Math.max(1, Math.round((Date.now() - S.kwartier.start) / 60000));
    confetti({ aantal: 220, kracht: 1.3 });
    tril(40);
    melding(minuten <= 15 ? `Klaar in ${minuten} min. Terug naar de keuken.` : `Klaar in ${minuten} min. Volgende week iets sneller.`);
    S.kwartier = { stap: 1, start: 0, doorgeschoven: new Set() };
    location.hash = '#week';
  },

  async 'demo-als'(el) {
    S.lid = await opslag.inloggen(el.dataset.email);
    await laadAlles();
    location.hash = '#vandaag';
    render({ animeer: true });
  },

  async 'demo-reset'() {
    opslag.reset();
    await laadAlles();
    melding('Demo staat weer op start');
    render();
  },

  herlaad: () => location.reload(),

  thema(el) {
    kiesThema(el.dataset.thema);
    tril(8);
    render();
  },

  async uitloggen() {
    await opslag.uitloggen();
    S.lid = null;
    viewLogin();
  },
};

// ---------------------------------------------------------------------------
// Formulieren

const formulieren = {
  async login(form) {
    const knop = form.querySelector('button[type=submit]');
    knop.disabled = true;
    try {
      S.lid = await opslag.inloggen(form.email.value, form.wachtwoord.value);
      await start();
    } catch (e) {
      foutIn(form, e.message);
      knop.disabled = false;
    }
  },

  async taak(form) {
    const gegevens = {
      titel: form.titel.value.trim(),
      eigenaar: form.eigenaar.value,
      minimumversie: form.minimumversie.value.trim() || null,
      klaar_wanneer: form.klaar_wanneer.value.trim() || null,
    };
    try {
      if (form.dataset.id) {
        const rij = await opslag.taakBijwerken(form.dataset.id, gegevens);
        Object.assign(S.taken.find(t => t.id === form.dataset.id), rij);
      } else {
        S.taken.push(await opslag.taakToevoegen({ ...gegevens, week_start: form.dataset.week }));
        tril(14);
      }
      sluitPaneel();
      render();
    } catch (e) {
      foutIn(form, e.message);
    }
  },

  async post(form, knop) {
    const actie = (knop && knop.value) || 'opslaan';
    const id = form.dataset.id || null;
    const bestaand = id ? S.posts.find(p => p.id === id) : null;
    const gegevens = id ? { id } : {};
    if (form.idee) {
      Object.assign(gegevens, {
        datum: form.datum.value,
        merk: form.merk.value,
        kanaal: form.kanaal.value,
        thema: form.thema.value || null,
        idee: form.idee.value.trim(),
        beeld: [...form.querySelectorAll('input[name=beeld]:checked')].map(i => ({ naam: i.value, link: i.dataset.link || null })),
      });
    }
    if (form.tekst) gegevens.tekst = form.tekst.value.trim() || null;
    if (actie === 'goedkeuren') gegevens.tekst_goedgekeurd = true;
    if (actie === 'ingepland' || actie === 'geplaatst') gegevens.status = actie;
    if (!id) gegevens.status = 'tekst_nodig';

    stopOpname();
    try {
      const rij = await opslag.postOpslaan(gegevens);
      if (bestaand) Object.assign(bestaand, rij); else S.posts.push(rij);
      S.posts.sort((a, b) => a.datum.localeCompare(b.datum));
      sluitPaneel();
      render();
      if (actie === 'goedkeuren') { confetti({ aantal: 120 }); melding('Goedgekeurd. Mila kan door.'); }
      else if (actie === 'geplaatst') { confetti({ aantal: 200, kracht: 1.3 }); melding('Geplaatst.'); }
      else melding(id ? 'Opgeslagen.' : 'Post staat in de planning.');
    } catch (e) {
      foutIn(form, e.message);
    }
  },

  async doel(form) {
    const getalOfLeeg = naam => (form[naam].value === '' ? null : Number(form[naam].value));
    try {
      const rij = await opslag.doelOpslaan(form.dataset.metric, {
        start_waarde: getalOfLeeg('start_waarde'),
        doel_december: getalOfLeeg('doel_december'),
        doel_maart: getalOfLeeg('doel_maart'),
      });
      Object.assign(S.doelen.find(d => d.metric === form.dataset.metric), rij);
      sluitPaneel();
      render();
    } catch (e) {
      foutIn(form, e.message);
    }
  },

  async cijfers(form) {
    await slaMetingenOp(form);
    melding('Cijfers opgeslagen.');
    confettiBij(form.querySelector('button[type=submit]'));
    render();
  },

  async 'kwartier-cijfers'(form) {
    await slaMetingenOp(form);
    S.kwartier.stap = 2;
    render();
  },

  async 'kwartier-taak'(form) {
    try {
      S.taken.push(await opslag.taakToevoegen({ titel: form.titel.value.trim(), eigenaar: form.eigenaar.value, week_start: dezeMaandag() }));
      tril(14);
      render();
    } catch (e) {
      foutIn(form, e.message);
    }
  },
};

async function slaMetingenOp(form) {
  const periode = form.dataset.periode;
  const invoer = [...form.querySelectorAll('input[type=number]')];
  for (const veld of invoer) {
    const bestaand = S.metingen.find(m => m.metric === veld.name && m.periode_start === periode);
    const waarde = veld.value === '' ? null : Number(veld.value);
    if ((bestaand ? Number(bestaand.waarde) : null) === waarde) continue;
    try {
      await opslag.metingOpslaan(veld.name, periode, waarde);
    } catch (e) {
      foutIn(form, e.message);
      throw e;
    }
    S.metingen = S.metingen.filter(m => !(m.metric === veld.name && m.periode_start === periode));
    if (waarde !== null) S.metingen.push({ metric: veld.name, periode_start: periode, waarde, ingevuld_door: S.lid.email });
  }
}

// ---------------------------------------------------------------------------
// Gebeurtenissen

document.addEventListener('click', e => {
  const el = e.target.closest('[data-actie]');
  if (!el || el.disabled) return;
  const actie = acties[el.dataset.actie];
  if (!actie) return;
  e.preventDefault();
  Promise.resolve(actie(el, e)).catch(fout => console.error(fout));
});

document.addEventListener('keydown', e => {
  if (e.key === 'Escape') sluitPaneel();
  if ((e.key === 'Enter' || e.key === ' ') && e.target.matches('[role=button][data-actie]')) {
    e.preventDefault();
    e.target.click();
  }
});

document.addEventListener('submit', e => {
  const form = e.target.closest('form[data-form]');
  if (!form) return;
  e.preventDefault();
  const verwerk = formulieren[form.dataset.form];
  if (verwerk) Promise.resolve(verwerk(form, e.submitter)).catch(fout => console.error(fout));
});

document.addEventListener('input', e => {
  if (e.target.id === 'post-tekst') telTekens();
});

function voegBestandenToe(lijst) {
  const nieuw = [...lijst].filter(f => /^(image|video)\//.test(mimeVan(f)));
  if (nieuw.length < lijst.length) melding("Alleen foto's en video's.", 'fout');
  for (const file of nieuw) {
    S.upload.bestanden.push({ id: `b${Date.now()}${Math.random().toString(16).slice(2, 7)}`, file, url: URL.createObjectURL(file), status: null, voortgang: 0 });
  }
  render();
}

document.addEventListener('change', e => {
  if (e.target.matches('[data-input="bestanden"]') && e.target.files.length) {
    voegBestandenToe(e.target.files);
    e.target.value = '';
  }
});

document.addEventListener('dragover', e => {
  const zone = e.target.closest && e.target.closest('#dropzone');
  if (!zone) return;
  e.preventDefault();
  zone.classList.add('slepen');
});
document.addEventListener('dragleave', e => {
  const zone = e.target.closest && e.target.closest('#dropzone');
  if (zone) zone.classList.remove('slepen');
});
document.addEventListener('drop', e => {
  const zone = e.target.closest && e.target.closest('#dropzone');
  if (!zone) return;
  e.preventDefault();
  zone.classList.remove('slepen');
  if (e.dataTransfer && e.dataTransfer.files.length && !S.upload.bezig) voegBestandenToe(e.dataTransfer.files);
});

window.addEventListener('hashchange', () => {
  sluitPaneel(true);
  const { pagina, arg } = route();
  if (pagina === 'posts' && arg === 'tekst') { S.postFilter = { status: 'tekst_nodig', merk: 'alles' }; S.postsVerschuiving = 0; }
  render({ animeer: true });
  window.scrollTo({ top: 0 });
});

document.addEventListener('visibilitychange', async () => {
  if (document.hidden || !S.lid || S.paneel || S.upload.bezig || Date.now() - S.geladenOp < 30_000) return;
  try {
    await laadAlles();
    render();
  } catch { /* volgende keer opnieuw */ }
});

// ---------------------------------------------------------------------------
// Start

async function start() {
  await laadAlles();
  if (!location.hash) history.replaceState(null, '', '#vandaag');
  const { pagina, arg } = route();
  if (pagina === 'posts' && arg === 'tekst') S.postFilter = { status: 'tekst_nodig', merk: 'alles' };
  render({ animeer: true });
}

async function boot() {
  if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost')) {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  }
  try {
    await opslag.start();
    S.lid = await opslag.sessie();
  } catch (e) {
    viewLogin(e.message);
    return;
  }
  if (!S.lid) { viewLogin(); return; }
  try {
    await start();
  } catch (e) {
    app.innerHTML = `<div class="kaart" style="margin-top:40px"><h2>Even geen verbinding</h2><p class="sub" style="margin:6px 0 14px">${esc(e.message)}</p><button class="knop" data-actie="herlaad">Opnieuw proberen</button></div>`;
  }
}

boot();
