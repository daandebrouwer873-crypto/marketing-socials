// Onderwerpen van de beeldbank. Gedeeld door de app en de uploadfunctie;
// de bijbehorende Drive-mappen staan alleen aan de serverkant.

export const ONDERWERPEN = Object.freeze([
  { key: 'gerechten', label: 'Gerechten', emoji: '🍽️' },
  { key: 'vuur', label: 'Vuur en grill', emoji: '🔥' },
  { key: 'akker', label: 'Boerderij en akker', emoji: '🌱' },
  { key: 'keuken', label: 'Keuken', emoji: '🔪' },
  { key: 'mensen', label: 'Mensen', emoji: '🧑‍🍳' },
  { key: 'zaal', label: 'Zaal en interieur', emoji: '🕯️' },
  { key: 'producten', label: 'Producten', emoji: '🥕' },
  { key: 'dranken', label: 'Dranken', emoji: '🍷' },
  { key: 'pand', label: 'Pand en buiten', emoji: '🏛️' },
  { key: 'huisstijl', label: 'Huisstijl en drukwerk', emoji: '🎨' },
  { key: 'evenementen', label: 'Evenementen', emoji: '🎉' },
  { key: 'brouwerij', label: 'Brouwerij de Brouwer', emoji: '🫧' },
  { key: 'overig', label: 'Overig', emoji: '📦' },
  { key: 'nieuw', label: 'Nieuw – te sorteren', emoji: '✨' },
]);

export function onderwerp(key) {
  return ONDERWERPEN.find(o => o.key === key) || null;
}
