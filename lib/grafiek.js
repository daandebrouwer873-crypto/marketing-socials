// Grafieken in de Pellens-stijl: dunne lijnen, rustige assen, een tooltip bij aanwijzen
// en altijd een tabel als alternatief. Kleuren komen uit --g1 (goud) en --g2 (blauw), in die
// volgorde. Die zijn per weergave gecontroleerd op contrast en kleurenblindheid.
import { esc, getal } from './logica.js';

let volgnummer = 0;
const specs = new Map();

// Nette asverdeling: 0, 10, 20, 30 in plaats van 3, 13, 23.
export function schaal(min, max, stappen = 4) {
  if (!Number.isFinite(min) || !Number.isFinite(max)) return { onder: 0, boven: 1, ticks: [0, 1] };
  if (min === max) {
    const ruimte = Math.abs(min) * 0.1 || 1;
    min -= ruimte;
    max += ruimte;
  }
  const ruw = (max - min) / stappen;
  const macht = 10 ** Math.floor(Math.log10(ruw));
  const stap = [1, 2, 2.5, 5, 10].map(f => f * macht).find(s => s >= ruw - 1e-12);
  const onder = Math.floor(min / stap) * stap;
  const boven = Math.ceil(max / stap) * stap;
  const ticks = [];
  for (let t = onder; t <= boven + stap / 1e6; t += stap) ticks.push(Math.round(t * 1e6) / 1e6);
  return { onder, boven, ticks };
}

export function tipAttr(titel, rijen) {
  return `data-tip-titel="${esc(titel)}" data-tip-rijen="${esc(JSON.stringify(rijen))}"`;
}

// ---------------------------------------------------------------------------
// Lijngrafiek: de HTML komt direct, de lijnen worden getekend op de echte breedte.

export function nieuweRender() {
  specs.clear();
}

export function lijnGrafiek(spec) {
  const { titel, labels, reeksen, decimalen = 0, hoogte = 190, tabelKop = 'Periode' } = spec;
  if (!reeksen.some(r => r.waarden.some(v => v != null))) {
    return '<p class="leeg">Nog geen cijfers ingevuld.</p>';
  }
  volgnummer += 1;
  const id = `grafiek-${volgnummer}`;
  specs.set(id, spec);
  const legenda = reeksen.length > 1
    ? `<div class="legenda">${reeksen.map(r => `<span><i class="sleutel-lijn" style="background:var(--${r.kleur})"></i>${esc(r.naam)}</span>`).join('')}</div>`
    : '';
  const tabel = `<details class="tabelweergave"><summary>Toon als tabel</summary>
    <table><thead><tr><th>${esc(tabelKop)}</th>${reeksen.map(r => `<th>${esc(r.naam)}</th>`).join('')}</tr></thead>
    <tbody>${labels.map((l, i) => `<tr><td>${esc(l)}</td>${reeksen.map(r => `<td>${esc(getal(r.waarden[i], decimalen))}</td>`).join('')}</tr>`).join('')}</tbody></table>
  </details>`;
  return `<figure class="grafiek" id="${id}">${legenda}
    <div class="grafiek-vlak" style="height:${hoogte}px" role="img" aria-label="${esc(titel)}"></div>
    ${tabel}</figure>`;
}

export function svgLijn(spec, breedte) {
  const { labels, reeksen, decimalen = 0, hoogte = 190, vanafNul = false } = spec;
  const alle = reeksen.flatMap(r => r.waarden).filter(v => v != null);
  const L = 48;
  const R = 56;
  const T = 10;
  const O = 26;
  const { onder: y0, boven: y1, ticks } = schaal(vanafNul ? Math.min(0, ...alle) : Math.min(...alle), Math.max(...alle));
  const n = labels.length;
  const plot = breedte - L - R;
  const x = i => L + (n === 1 ? plot / 2 : (i * plot) / (n - 1));
  const y = v => T + (1 - (v - y0) / (y1 - y0)) * (hoogte - T - O);
  const f = g => g.toFixed(1);

  const raster = ticks.map(t => `<line class="raster" x1="${L}" x2="${breedte - R}" y1="${f(y(t))}" y2="${f(y(t))}"/>
    <text class="as" x="${L - 8}" y="${f(y(t) + 4)}" text-anchor="end">${esc(getal(t, decimalen))}</text>`).join('');
  const elke = Math.max(1, Math.ceil(n / Math.max(2, Math.floor(plot / 64))));
  const asLabels = labels.map((l, i) => ((n - 1 - i) % elke === 0
    ? `<text class="as" x="${f(x(i))}" y="${hoogte - 6}" text-anchor="middle">${esc(l)}</text>` : '')).join('');

  const lijnen = reeksen.map(r => {
    let pad = '';
    let open = false;
    const punten = [];
    r.waarden.forEach((v, i) => {
      if (v == null) { open = false; return; }
      pad += `${open ? 'L' : 'M'}${f(x(i))},${f(y(v))}`;
      punten.push(i);
      open = true;
    });
    const zonderGat = punten.length > 1 && punten.at(-1) - punten[0] === punten.length - 1;
    const vlak = reeksen.length === 1 && zonderGat
      ? `<path class="vlak" d="${pad}L${f(x(punten.at(-1)))},${f(y(y0))}L${f(x(punten[0]))},${f(y(y0))}Z" style="fill:var(--${r.kleur})"/>`
      : '';
    return `${vlak}<path class="lijn" d="${pad}" style="stroke:var(--${r.kleur})"/>`;
  }).join('');

  // Eindpunt met waarde. Liggen twee eindlabels te dicht bij elkaar, dan dragen legenda en tooltip het.
  const einden = reeksen.map(r => {
    const i = r.waarden.findLastIndex(v => v != null);
    return i < 0 ? null : { r, i, v: r.waarden[i] };
  }).filter(Boolean);
  const botsen = einden.some((a, k) => einden.some((b, m) => m > k && Math.abs(y(a.v) - y(b.v)) < 14));
  const eind = einden.map(({ r, i, v }) => `<circle class="eindpunt" cx="${f(x(i))}" cy="${f(y(v))}" r="4" style="fill:var(--${r.kleur})"/>
    ${botsen ? '' : `<text class="eindlabel" x="${f(x(i) + 9)}" y="${f(y(v) + 4)}">${esc(getal(v, decimalen))}</text>`}`).join('');

  const punten = labels.map((_, i) => reeksen.map(r => (r.waarden[i] == null ? ''
    : `<circle class="punt" data-i="${i}" cx="${f(x(i))}" cy="${f(y(r.waarden[i]))}" r="4.5" style="fill:var(--${r.kleur})"/>`)).join('')).join('');

  const stap = n > 1 ? plot / (n - 1) : plot;
  const raak = labels.map((l, i) => {
    const rijen = reeksen.map(r => ({ naam: r.naam, kleur: r.kleur, waarde: getal(r.waarden[i], decimalen) }));
    const links = Math.max(L - 6, x(i) - stap / 2);
    const rechts = Math.min(breedte - R + 6, x(i) + stap / 2);
    return `<rect class="raak" data-i="${i}" data-x="${f(x(i))}" x="${f(links)}" y="${T}" width="${f(rechts - links)}" height="${hoogte - T - O}"
      tabindex="0" aria-label="${esc(`${l}: ${rijen.map(r => `${r.naam} ${r.waarde}`).join(', ')}`)}" ${tipAttr(l, rijen)}/>`;
  }).join('');

  return `<svg width="${breedte}" height="${hoogte}" viewBox="0 0 ${breedte} ${hoogte}" aria-hidden="true" focusable="false">
    ${raster}${asLabels}${lijnen}
    <line class="kruis" x1="0" x2="0" y1="${T}" y2="${hoogte - O}"/>
    ${eind}${punten}${raak}</svg>`;
}

export function tekenGrafieken(root = document) {
  for (const figuur of root.querySelectorAll('figure.grafiek')) {
    const spec = specs.get(figuur.id);
    const vlak = figuur.querySelector('.grafiek-vlak');
    if (!spec || !vlak) continue;
    const breedte = Math.max(240, Math.floor(vlak.clientWidth));
    if (vlak.dataset.breedte === String(breedte)) continue;
    vlak.dataset.breedte = String(breedte);
    vlak.innerHTML = svgLijn(spec, breedte);
  }
}

// ---------------------------------------------------------------------------
// Kleine vormen: cijfertegel met verloop, staafjes per categorie.

export function vonkje(waarden, { breedte = 112, hoogte = 30 } = {}) {
  const punten = waarden.map((v, i) => [i, v]).filter(([, v]) => v != null);
  if (punten.length < 2) return '';
  const min = Math.min(...punten.map(p => p[1]));
  const max = Math.max(...punten.map(p => p[1]));
  const x = i => 3 + (i / (waarden.length - 1)) * (breedte - 6);
  const y = v => hoogte - 4 - ((v - min) / (max - min || 1)) * (hoogte - 8);
  const [li, lv] = punten.at(-1);
  return `<svg class="vonkje" width="${breedte}" height="${hoogte}" viewBox="0 0 ${breedte} ${hoogte}" aria-hidden="true">
    <polyline points="${punten.map(([i, v]) => `${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' ')}"/>
    <circle cx="${x(li).toFixed(1)}" cy="${y(lv).toFixed(1)}" r="3.5"/>
  </svg>`;
}

const PIJL = {
  omhoog: '<svg width="11" height="11" viewBox="0 0 12 12" aria-hidden="true"><path d="M6 2 10.5 8.5h-9z" fill="currentColor"/></svg>',
  omlaag: '<svg width="11" height="11" viewBox="0 0 12 12" aria-hidden="true"><path d="M6 10 1.5 3.5h9z" fill="currentColor"/></svg>',
  gelijk: '<svg width="11" height="11" viewBox="0 0 12 12" aria-hidden="true"><path d="M2 6h8" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>',
};

// delta weglaten: geen vergelijkingsregel. delta null: er is nog niets om mee te vergelijken.
export function statTegel({ label, waarde, decimalen = 0, delta, deltaTekst = '', omhoogGoed = true, reeks = [], voet = '', href = '' }) {
  const richting = delta == null || delta === 0 ? 'gelijk' : delta > 0 ? 'omhoog' : 'omlaag';
  const oordeel = richting === 'gelijk' ? '' : (delta > 0) === omhoogGoed ? ' goed' : ' slecht';
  const deltaHtml = delta === undefined ? ''
    : delta === null ? '<span class="delta">nog geen vergelijking</span>'
      : `<span class="delta${oordeel}">${PIJL[richting]}<b>${delta > 0 ? '+' : ''}${esc(getal(delta, decimalen))}</b><span>${esc(deltaTekst)}</span></span>`;
  const binnen = `
    <span class="stat-label">${esc(label)}</span>
    <span class="stat-waarde">${waarde == null ? '–' : esc(getal(waarde, decimalen))}</span>
    ${deltaHtml}
    <span class="stat-onder">${vonkje(reeks)}${voet ? `<span class="stat-voet">${esc(voet)}</span>` : ''}</span>`;
  return href
    ? `<a class="stat klik" href="${esc(href)}">${binnen}</a>`
    : `<div class="stat">${binnen}</div>`;
}

export function staafLijst({ rijen, decimalen = 0, kleur = 'g1', naam = 'Aantal' }) {
  if (!rijen.length) return '<p class="leeg">Nog niets om te tonen.</p>';
  const max = Math.max(1e-9, ...rijen.map(r => Number(r.waarde) || 0));
  return `<div class="staven">${rijen.map(r => {
    const breedte = r.waarde == null ? 0 : (Math.max(0, Number(r.waarde)) / max) * 100;
    return `<div class="staaf-rij" tabindex="0" ${tipAttr(r.label, [{ naam: r.naam || naam, kleur, waarde: getal(r.waarde, decimalen) }])}>
      <span class="staaf-label">${esc(r.label)}</span>
      <span class="staaf-spoor"><i style="width:${breedte.toFixed(1)}%;background:var(--${kleur})"></i></span>
      <span class="staaf-waarde">${esc(getal(r.waarde, decimalen))}</span>
    </div>`;
  }).join('')}</div>`;
}

// ---------------------------------------------------------------------------
// Tooltip: één voor de hele pagina, met tekst via textContent.

let tip = null;
let huidig = null;

function doelVan(el) {
  return el && el.closest ? el.closest('[data-tip-titel]') : null;
}

function markeer(el) {
  document.querySelectorAll('.grafiek .actief').forEach(n => n.classList.remove('actief'));
  const svg = el.closest('svg');
  if (!svg) return;
  svg.querySelectorAll(`.punt[data-i="${el.dataset.i}"]`).forEach(p => p.classList.add('actief'));
  const kruis = svg.querySelector('.kruis');
  if (kruis) {
    kruis.setAttribute('x1', el.dataset.x);
    kruis.setAttribute('x2', el.dataset.x);
    kruis.classList.add('actief');
  }
}

function toon(el, x, y) {
  if (el !== huidig) {
    huidig = el;
    tip.replaceChildren();
    const kop = document.createElement('div');
    kop.className = 'tip-kop';
    kop.textContent = el.dataset.tipTitel;
    tip.append(kop);
    let rijen = [];
    try { rijen = JSON.parse(el.dataset.tipRijen || '[]'); } catch { rijen = []; }
    for (const r of rijen) {
      const rij = document.createElement('div');
      rij.className = 'tip-rij';
      if (r.kleur) {
        const sleutel = document.createElement('i');
        sleutel.className = 'tip-sleutel';
        sleutel.style.background = `var(--${r.kleur})`;
        rij.append(sleutel);
      }
      const waarde = document.createElement('b');
      waarde.textContent = r.waarde;
      const naam = document.createElement('span');
      naam.textContent = r.naam;
      rij.append(waarde, naam);
      tip.append(rij);
    }
    markeer(el);
    tip.hidden = false;
  }
  const { width: b, height: h } = tip.getBoundingClientRect();
  let links = x + 14;
  if (links + b > window.innerWidth - 8) links = x - b - 14;
  let boven = y - h - 12;
  if (boven < 8) boven = y + 18;
  tip.style.transform = `translate(${Math.round(Math.max(8, links))}px, ${Math.round(boven)}px)`;
}

export function verbergTip() {
  if (!tip || tip.hidden) return;
  tip.hidden = true;
  huidig = null;
  document.querySelectorAll('.grafiek .actief').forEach(n => n.classList.remove('actief'));
}

export function installeerGrafieken() {
  if (tip) return;
  tip = document.createElement('div');
  tip.className = 'tip';
  tip.setAttribute('role', 'status');
  tip.hidden = true;
  document.body.append(tip);
  document.addEventListener('pointermove', e => {
    const el = doelVan(e.target);
    if (el) toon(el, e.clientX, e.clientY);
    else verbergTip();
  });
  document.addEventListener('focusin', e => {
    const el = doelVan(e.target);
    if (!el) return;
    const r = el.getBoundingClientRect();
    toon(el, r.left + r.width / 2, r.top);
  });
  document.addEventListener('focusout', verbergTip);
  document.addEventListener('click', verbergTip);
  window.addEventListener('scroll', verbergTip, { passive: true, capture: true });
  let wacht = 0;
  window.addEventListener('resize', () => {
    clearTimeout(wacht);
    wacht = setTimeout(() => tekenGrafieken(), 120);
  });
}
