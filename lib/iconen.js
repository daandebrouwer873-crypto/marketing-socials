// Dunne lijn-iconen in de stijl van de Pellens-apps. Kleur volgt de tekst (currentColor).

const PADEN = {
  vlam: '<path d="M12 3c2 3.5 5 5.2 5 9.2A5 5 0 0 1 7 12.2c0-1.6.7-2.9 1.6-3.9.2 1.6 1 2.6 2 3 0-3 .4-5.5 1.4-8.3z"/><path d="M12 21a2.6 2.6 0 0 1-2.6-2.6c0-1.4 1.4-2.6 2.6-4.1 1.2 1.5 2.6 2.7 2.6 4.1A2.6 2.6 0 0 1 12 21z"/>',
  kiem: '<path d="M12 20v-8"/><path d="M12 12c0-3.5-2.6-6-6.5-6 0 3.6 2.7 6 6.5 6z"/><path d="M12 12c0-3 2.3-5.2 5.8-5.2 0 3.1-2.4 5.2-5.8 5.2z"/>',
  mic: '<rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5.5 11a6.5 6.5 0 0 0 13 0"/><path d="M12 17.5V21"/>',
  opname: '<circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="3.5" fill="currentColor"/>',
  camera: '<path d="M4 8.5A1.5 1.5 0 0 1 5.5 7h2l1.5-2h6l1.5 2h2A1.5 1.5 0 0 1 20 8.5v9a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 17.5z"/><circle cx="12" cy="13" r="3.5"/>',
  kalender: '<rect x="4" y="5" width="16" height="15" rx="2.5"/><path d="M4 10h16M9 3v4M15 3v4"/>',
  ster: '<path d="m12 4 2.4 5 5.4.6-4 3.7 1.1 5.4L12 16l-4.9 2.7 1.1-5.4-4-3.7 5.4-.6z"/>',
  doel: '<circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="4.5"/><circle cx="12" cy="12" r="1" fill="currentColor"/>',
  grafiek: '<path d="M4 19h16"/><path d="M6 15l4-4 3 3 5-6"/>',
  kaart: '<path d="M9 5 4 7v12l5-2 6 2 5-2V5l-5 2z"/><path d="M9 5v12M15 7v12"/>',
  klok: '<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/>',
  kopie: '<rect x="8" y="8" width="11" height="12" rx="2"/><path d="M5 15V6a2 2 0 0 1 2-2h8"/>',
  check: '<path d="m5 12.5 4.5 4.5L19 7.5"/>',
  beeld: '<rect x="4" y="5" width="16" height="14" rx="2.5"/><circle cx="9" cy="10" r="1.6"/><path d="m5 17 4.5-4.5 3 3 2.5-2.5L19 17"/>',
  geluid: '<path d="M5 10v4M9 7v10M13 9v6M17 6v12M21 11v2"/>',
  uploaden: '<path d="M12 16V5"/><path d="m7.5 9.5 4.5-4.5 4.5 4.5"/><path d="M5 19h14"/>',
  thema: '<circle cx="12" cy="12" r="8.5"/><path d="M12 3.5v17A8.5 8.5 0 0 0 12 3.5z" fill="currentColor"/>',
};

export function icoon(naam, maat = 18) {
  const pad = PADEN[naam];
  if (!pad) return '';
  return `<svg class="icoon" width="${maat}" height="${maat}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${pad}</svg>`;
}

// Het dP-monogram van Pellens (uit de huisstijl), in de kleur van de tekst of goud.
export function monogram(breedte = 26) {
  return `<img class="monogram" src="icons/monogram.svg" width="${breedte}" height="${Math.round(breedte * 0.8)}" alt="">`;
}
