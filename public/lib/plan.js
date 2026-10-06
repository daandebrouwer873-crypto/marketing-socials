// De inhoud van het marketingplan (oktober 2026 – maart 2027) zoals de app hem gebruikt.

// Looptijd van het plan: de doelen gelden van 1 oktober tot en met 31 maart, met een tussenstand eind december.
export const PLAN_START = '2026-10-01';
export const PLAN_DECEMBER = '2026-12-31';
export const PLAN_EIND = '2027-03-31';

export const ROLLEN = Object.freeze({
  eigenaar: { label: 'Eigenaar', taak: 'Verhaal, teksten en maandthema' },
  social: { label: 'Social media manager', taak: 'Content maken, plaatsen en cijfers' },
  manager: { label: 'Restaurantmanager', taak: 'Reviews en wat er in de zaal gebeurt' },
});

export const SPELREGELS = Object.freeze([
  'Maximaal drie marketingtaken per week naast de vaste routine. Niets nieuws zolang er één openstaat.',
  'Elke taak heeft één eigenaar met naam. "Wij" doet niets.',
  'Iedereen levert beeld aan via de app, Mila kiest en plaatst.',
  'Daan schrijft alle teksten zelf en spreekt ze in. Er gaat geen AI-tekst online.',
]);

export const MERKEN = Object.freeze({
  pellens: { label: 'Pellens', kort: 'Pellens' },
  brouwerij: { label: 'Brouwerij de Brouwer', kort: 'Brouwerij' },
});

export const KANALEN = Object.freeze({
  reel: { label: 'Reel' },
  carrousel: { label: 'Carrousel' },
  foto: { label: 'Fotopost' },
  story: { label: 'Story' },
  tiktok: { label: 'TikTok' },
  google: { label: 'Google-post' },
  facebook: { label: 'Facebook' },
  linkedin: { label: 'LinkedIn' },
  mail: { label: 'Mail aan gasten' },
});

export const THEMAS = Object.freeze({
  land: { label: 'Van het land', uitleg: 'De Vloeiweide, de oogst, wat er vandaag binnenkwam' },
  vuur: { label: 'Op het vuur', uitleg: 'De houtgrill en de keuken aan het werk' },
  tafel: { label: 'Aan tafel', uitleg: 'Gerechten van het seizoensmenu, de zaal, gasten' },
  mensen: { label: 'De mensen', uitleg: 'Jonas, Stijn, Frits, Beau en wie er vanavond staat' },
  boeken: { label: 'Boeken', uitleg: 'Een concrete uitnodiging: lunch, Formule du jour, cadeaubon, kerst. Hooguit één op de vijf posts' },
});

export const POST_STATUS = Object.freeze({
  idee: { label: 'Idee', kleur: 'stil' },
  tekst_nodig: { label: 'Tekst nodig', kleur: 'vuur' },
  tekst_klaar: { label: 'Tekst klaar', kleur: 'land' },
  ingepland: { label: 'Ingepland', kleur: 'bubbel' },
  geplaatst: { label: 'Geplaatst', kleur: 'goud' },
});

export const MAANDEN = Object.freeze([
  {
    maand: '2026-10', naam: 'Oktober', thema: 'Op orde en december verkopen', accent: true,
    momenten: ['Nulmeting en profielen op orde', 'Lunch op alle kanalen', 'Eerste reels uit de shoot', '31 okt: kerstaanbod verstuurd'],
  },
  {
    maand: '2026-11', naam: 'November', thema: 'Winterseizoen',
    momenten: ['Winterconcept in beeld', 'Groepen en kerstdiners bellen', 'LinkedIn: groepen en zakelijk', '15 nov: cadeaubonnen online'],
  },
  {
    maand: '2026-12', naam: 'December', thema: 'Feestmaand, elke tafel vol',
    momenten: ['5 dec: bonnen voor Sinterklaas', '24 tot 26 dec: kerst', 'Elke vrije tafel een story', '31 dec: kwartaalmeting'],
  },
  {
    maand: '2027-01', naam: 'Januari', thema: 'Gasten laten terugkomen',
    momenten: ['Eerste mail aan de gastenlijst', 'Cadeaubonnen laten verzilveren', 'Dry January: Brouwerij-dranken'],
  },
  {
    maand: '2027-02', naam: 'Februari', thema: 'Drie jaar Pellens',
    momenten: ['Drie jaar sinds de heropening', '6 tot 9 feb: carnaval in Breda', '14 feb: Valentijn (zondag)'],
  },
  {
    maand: '2027-03', naam: 'Maart', thema: 'Lente op het land',
    momenten: ['Zaaien en de eerste oogst', 'Lentemenu aankondigen', '31 mrt: evaluatie van het plan'],
  },
]);

export const RITME = Object.freeze([
  { wanneer: 'Elke openingsdag', wat: 'Minstens één story, berichten binnen 24 uur beantwoord', wie: 'Mila' },
  { wanneer: 'Vrijdag en zaterdag', wat: 'Tafel vrij? Direct een story: "Vanavond één tafel vrij. Wie pakt hem?"', wie: 'Beau en Mila' },
  { wanneer: 'Elke dienst', wat: 'Reviewvraag bij de koffie, alleen bij enthousiaste tafels', wie: 'Beau en Frits' },
  { wanneer: 'Maandag', wat: 'Vijf minuten cijfers met het team, daarna de weekplanning', wie: 'Iedereen' },
  { wanneer: 'Uiterlijk dinsdag', wat: 'Teksten inspreken voor de posts van die week', wie: 'Daan' },
  { wanneer: 'Wekelijks', wat: 'Contentblok op locatie en één Google-post', wie: 'Mila' },
  { wanneer: 'Eerste maandag', wat: 'Maandcijfers en het thema van volgende maand', wie: 'Mila en Daan' },
]);

// Open: woensdag tot en met zondag. Weekdagen: 0 = zondag ... 6 = zaterdag.
const OPEN = new Set([3, 4, 5, 6, 0]);
const isOpen = c => OPEN.has(c.weekdag);
const op = (...dagen) => c => dagen.includes(c.weekdag);
const ALLE = ['eigenaar', 'social', 'manager'];

export const ROUTINES = Object.freeze([
  { key: 'cijfers-team', rollen: ALLE, label: 'Vijf minuten staand de cijfers van de week', wanneer: op(1) },

  { key: 'story', rollen: ['social'], label: 'Minstens één story plaatsen', wanneer: isOpen },
  { key: 'reageren', rollen: ['social'], label: 'Berichten en reacties beantwoorden', hint: '15 tot 20 minuten', wanneer: isOpen },
  { key: 'weekplanning', rollen: ['social'], label: 'Posts van deze week vastzetten', hint: 'Zeg erbij welk beeld en welke tekst nodig is', wanneer: op(1), link: '#posts' },
  { key: 'volgers', rollen: ['social'], label: 'Volgers van vorige week invullen', wanneer: op(1), link: '#cijfers' },
  { key: 'contentblok', rollen: ['social'], label: 'Contentblok op locatie', hint: 'Filmen en fotograferen, ongeveer 3 uur', wanneer: op(4) },
  { key: 'inplannen', rollen: ['social'], label: 'Monteren en posts inplannen', wanneer: op(5) },
  { key: 'google-post', rollen: ['social'], label: 'Google-post plaatsen', wanneer: op(5) },
  { key: 'beeldbank', rollen: ['social'], label: 'Map "Nieuw" in de beeldbank sorteren', wanneer: op(5) },
  { key: 'maandcijfers', rollen: ['social'], label: 'Maandcijfers invullen', wanneer: c => c.eersteMaandag, link: '#cijfers' },
  { key: 'maandthema', rollen: ['social', 'eigenaar'], label: 'Thema voor volgende maand vastzetten', hint: '30 minuten, Mila en Daan', wanneer: c => c.eersteMaandag, link: '#plan' },

  { key: 'reviewvraag', rollen: ['manager'], label: 'Reviewvraag bij enthousiaste tafels', hint: 'Bij de koffie, nooit bij de rekening', wanneer: isOpen },
  { key: 'tafel-vrij', rollen: ['manager'], label: 'Tafel vrij? Direct doorgeven voor een story', wanneer: op(5, 6) },
  { key: 'reviews-beantwoorden', rollen: ['manager'], label: 'Nieuwe Google-reviews beantwoorden', wanneer: op(3) },
  { key: 'gasten', rollen: ['manager'], label: 'Gasten van vorige week invullen', wanneer: op(3), link: '#cijfers' },
  { key: 'reserveringen', rollen: ['manager'], label: 'Reserveringen per bron van vorige maand invullen', wanneer: c => c.weekdag === 3 && c.dagVanMaand <= 7, link: '#cijfers' },

  { key: 'weekplanning-daan', rollen: ['eigenaar'], label: '10 minuten weekplanning met Mila', wanneer: op(1), link: '#week' },
  { key: 'teksten', rollen: ['eigenaar'], label: 'Teksten inspreken voor deze week', wanneer: op(2), link: '#posts' },
  { key: 'linkedin', rollen: ['eigenaar'], label: 'LinkedIn-post: wat je deze maand van het land leerde', wanneer: c => c.weekdag === 2 && (c.dagVanMaand <= 7 || (c.dagVanMaand >= 15 && c.dagVanMaand <= 21)) },
]);

// Cijfers: per week (maandag van de gemeten week) of per maand (eerste dag van de gemeten maand).
export const METRICS = Object.freeze([
  { key: 'gasten_diner', label: 'Gasten per diner (gemiddeld)', periode: 'week', rol: 'manager', decimalen: 1 },
  { key: 'gasten_lunch', label: 'Gasten per lunch (gemiddeld)', periode: 'week', rol: 'manager', decimalen: 1 },
  { key: 'ig_volgers_pellens', label: 'Instagram-volgers Pellens', periode: 'week', rol: 'social' },
  { key: 'ig_volgers_brouwerij', label: 'Instagram-volgers Brouwerij', periode: 'week', rol: 'social' },

  { key: 'ig_linkklikken', label: 'Klikken op de link in bio', periode: 'maand', rol: 'social' },
  { key: 'gbp_weergaven', label: 'Google-profiel: weergaven', periode: 'maand', rol: 'social' },
  { key: 'gbp_route', label: 'Google-profiel: routeverzoeken', periode: 'maand', rol: 'social' },
  { key: 'gbp_bellen', label: 'Google-profiel: belklikken', periode: 'maand', rol: 'social' },
  { key: 'gbp_website', label: 'Google-profiel: websiteklikken', periode: 'maand', rol: 'social' },
  { key: 'google_reviews', label: 'Google-reviews (totaal)', periode: 'maand', rol: 'social' },
  { key: 'google_score', label: 'Google-score', periode: 'maand', rol: 'social', decimalen: 1 },
  { key: 'tripadvisor_reviews', label: 'Tripadvisor-reviews (totaal)', periode: 'maand', rol: 'social' },
  { key: 'emailadressen', label: 'E-mailadressen van gasten', periode: 'maand', rol: 'social' },
  { key: 'res_instagram', label: 'Reserveringen via Instagram', periode: 'maand', rol: 'manager' },
  { key: 'res_google', label: 'Reserveringen via Google', periode: 'maand', rol: 'manager' },
  { key: 'res_website', label: 'Reserveringen via de website', periode: 'maand', rol: 'manager' },
  { key: 'res_telefoon', label: 'Reserveringen via telefoon', periode: 'maand', rol: 'manager' },
]);

export function metric(key) {
  return METRICS.find(m => m.key === key) || null;
}
