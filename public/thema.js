// Weergave (donker, licht of groen), dezelfde drie als de team-app van Pellens.
// Wordt in de <head> geladen, zodat de pagina meteen in de goede kleuren opent.
export const THEMAS = Object.freeze({ donker: 'Donker', licht: 'Licht', groen: 'Groen' });
const SLEUTEL = 'pellens-marketing-thema';

export function huidigThema() {
  const gekozen = document.documentElement.dataset.thema;
  return THEMAS[gekozen] ? gekozen : 'donker';
}

export function kiesThema(thema) {
  const naam = THEMAS[thema] ? thema : 'donker';
  document.documentElement.dataset.thema = naam;
  const kleur = getComputedStyle(document.documentElement).getPropertyValue('--bg').trim();
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta && kleur) meta.setAttribute('content', kleur);
  try { localStorage.setItem(SLEUTEL, naam); } catch { /* privémodus */ }
}

let bewaard = null;
try { bewaard = localStorage.getItem(SLEUTEL); } catch { /* privémodus */ }
kiesThema(bewaard || 'donker');
