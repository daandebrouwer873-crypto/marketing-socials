// Onderwerpen van de beeldbank. Gedeeld door de app en de uploadfunctie;
// de bijbehorende Drive-mappen staan alleen aan de serverkant.

export const ONDERWERPEN = Object.freeze([
  { key: 'gerechten', label: 'Gerechten' },
  { key: 'vuur', label: 'Vuur en grill' },
  { key: 'akker', label: 'Boerderij en akker' },
  { key: 'keuken', label: 'Keuken' },
  { key: 'mensen', label: 'Mensen' },
  { key: 'zaal', label: 'Zaal en interieur' },
  { key: 'producten', label: 'Producten' },
  { key: 'dranken', label: 'Dranken' },
  { key: 'pand', label: 'Pand en buiten' },
  { key: 'huisstijl', label: 'Huisstijl en drukwerk' },
  { key: 'evenementen', label: 'Evenementen' },
  { key: 'brouwerij', label: 'Brouwerij de Brouwer' },
  { key: 'overig', label: 'Overig' },
  { key: 'nieuw', label: 'Nieuw, nog sorteren' },
]);

export function onderwerp(key) {
  return ONDERWERPEN.find(o => o.key === key) || null;
}
