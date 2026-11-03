// De inhoud van het marketingplan (oktober 2026 – maart 2027) zoals de app hem gebruikt.
// Sinds 2 november 2026 met Bar Brioche erbij en een plan per week tot en met 3 januari
// (docs/plan-tot-januari.md).

// Looptijd van het plan: de doelen gelden van 1 oktober tot en met 31 maart, met een tussenstand eind december.
export const PLAN_START = '2026-10-01';
export const PLAN_DECEMBER = '2026-12-31';
export const PLAN_EIND = '2027-03-31';
// Vanaf deze maandag gelden de routines en het weekplan van het plan tot januari.
export const PLAN_NIEUW = '2026-11-02';
// Bar Brioche: openingsavond dinsdag 1 december, eerste winkeldag woensdag 2 december.
export const BAR_BRIOCHE_OPEN = '2026-12-02';

export const ROLLEN = Object.freeze({
  eigenaar: { label: 'Eigenaar', taak: 'Goedkeuren, verhaal en nieuwsbrieven' },
  social: { label: 'Social media manager', taak: 'Content maken, teksten, plaatsen en reageren' },
  manager: { label: 'Restaurantmanager', taak: 'Reviews, Google-profielen en weekcijfers' },
});

export const SPELREGELS = Object.freeze([
  'Maximaal drie marketingtaken per week naast de vaste routine. Niets nieuws zolang er één openstaat.',
  'Elke taak heeft één eigenaar met naam. "Wij" doet niets.',
  'Iedereen levert beeld aan via de app, Mila kiest en plaatst.',
  'Teksten schrijft soms Daan, soms Mila. Wat Mila schrijft, keurt Daan goed voordat het online gaat. Nooit AI-teksten.',
  'Pellens zit in het verhaal van Bar Brioche, niet op het logo of het drukwerk.',
  'Reviews: iedereen op dezelfde manier vragen en er nooit iets voor teruggeven. Geen reviews van gasten van de openingsavond, personeel, familie, vrienden of leveranciers.',
  'Nooit een rekening van een gast online zetten.',
]);

// De twee zaken. Brouwerij de Brouwer hoort bij Bar Brioche.
export const ZAKEN = Object.freeze({
  pellens: { label: 'Pellens', adres: 'Boschstraat 24' },
  barbrioche: { label: 'Bar Brioche', adres: 'Boschstraat 45' },
});

export const MERKEN = Object.freeze({
  pellens: { label: 'Pellens', kort: 'Pellens', zaak: 'pellens' },
  barbrioche: { label: 'Bar Brioche', kort: 'Bar Brioche', zaak: 'barbrioche' },
  brouwerij: { label: 'Brouwerij de Brouwer', kort: 'Brouwerij', zaak: 'barbrioche' },
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
  tafel: { label: 'Aan tafel', uitleg: 'Gerechten van het seizoensmenu, de zaal, de toonbank, gasten' },
  mensen: { label: 'De mensen', uitleg: 'Wie er vandaag staat, in de keuken, de zaal of achter de toonbank, met naam' },
  boeken: { label: 'Boeken', uitleg: 'Een concrete uitnodiging: lunch, cadeaubon, kerstpakket, kerst. Hooguit één op de vijf posts' },
});

// Waar de posts over gaan, per zaak.
export const POST_ONDERWERPEN = Object.freeze({
  pellens: ['Gerechten', 'Kerst', 'Sfeer', 'Het team en de mensen', 'Open vuur'],
  barbrioche: ['De toonbank', 'Een kaas van dichtbij', 'De maaltijden uit de keuken van Pellens', 'De brioche van Echt Brood', 'De Brouwer aan de bar', 'De mensen achter de toonbank, met naam', 'De Boschstraat'],
});

// Wat er per zaak elke week minimaal online gaat. Posts zijn reels, carrousels en fotoposts.
const POSTS = ['reel', 'carrousel', 'foto'];
export const MINIMUM = Object.freeze([
  { zaak: 'pellens', label: 'posts', kanalen: POSTS, aantal: 3 },
  { zaak: 'pellens', label: 'reel', kanalen: ['reel'], aantal: 1 },
  { zaak: 'pellens', label: 'Google-post', kanalen: ['google'], aantal: 1 },
  // In de openingsweek vijf posts voor Bar Brioche.
  { zaak: 'barbrioche', label: 'posts', kanalen: POSTS, aantal: 3, weken: { '2026-11-30': 5 } },
  { zaak: 'barbrioche', label: 'Google-post', kanalen: ['google'], aantal: 1, vanaf: '2026-11-09' },
  { zaak: 'barbrioche', label: 'TikTok', kanalen: ['tiktok'], aantal: 1, vanaf: '2026-11-09' },
]);

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
    maand: '2026-11', naam: 'November', thema: 'Bar Brioche komt eraan, kerst verkopen',
    momenten: ['Persbericht Bar Brioche', '15 nov: cadeaubonnen online', '19 nov: nieuwsbrief, kerstpakketten', '27 tot 29 nov: Black Friday'],
  },
  {
    maand: '2026-12', naam: 'December', thema: 'Bar Brioche open, elke tafel vol',
    momenten: ['1 dec: openingsavond Bar Brioche', '5 dec: Sinterklaas, bonnen', '23 en 24 dec: kerstpakketten afhalen', '24 tot 26 dec: kerst bij Pellens', '31 dec: kwartaalmeting'],
  },
  {
    maand: '2027-01', naam: 'Januari', thema: 'Gasten laten terugkomen',
    momenten: ['Tweede nieuwtje van Bar Brioche', 'Cadeaubonnen laten verzilveren', 'Dry January: Brouwerij-dranken'],
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

// Het plan tot en met 3 januari, per week. Taken per rol; "samen" is voor iedereen.
export const WEKEN = Object.freeze([
  {
    maandag: '2026-11-02', titel: 'Opstarten',
    momenten: ['Wo 4 nov: Pier15'],
    taken: {
      eigenaar: [
        'Dit plan bespreken met Mila',
        'Persbericht 1 Bar Brioche schrijven en versturen: kop begint met Pellens, Boschstraat 45, open woensdag 2 december, de toonbank, kerstpakketten, webshop. Medialijst staat in het Ora-rapport',
      ],
      social: [
        'Wo 4 nov: Pier15 in stories en een reel',
        'Met Beau de Instagram van Bar Brioche op orde: naam "Bar Brioche · Delicatessen Breda", profielfoto uit het merkpakket',
        'Eerste negen posts voor Bar Brioche (deze week en volgende week)',
        '3 tot 5 foto\'s voor het persbericht: winkel in aanbouw, mensen, producten',
      ],
      manager: ['Google-profiel Bar Brioche compleet: categorie, openingstijden vanaf 2 december, foto\'s, producten'],
    },
  },
  {
    maandag: '2026-11-09', titel: 'Bar Brioche komt eraan',
    momenten: ['Ma 9 nov: eerste "Last week:"', 'Zo 15 nov: cadeaubonnen online'],
    taken: {
      eigenaar: ['Zakelijke gasten van Pellens benaderen voor kerstpakketten', 'Eerste TikTok: de verbouwing'],
      social: [
        'Ma 9 nov: eerste carrousel "Last week:" voor beide zaken',
        'Pellens: de winterkaart en de gerechten',
        'Bar Brioche: achter de schermen',
        'Zo 15 nov: cadeaubonnen online, post en Google-post',
      ],
      manager: [
        'Oude naam "Dames Pellens" opruimen: Restaurant Guru, Restaurants.nl, Cylex, Stappen & Shoppen, Facebook, TripAligner, Trip.com',
        'Explore Breda: Pellens en Bar Brioche aanmelden',
      ],
    },
  },
  {
    maandag: '2026-11-16', titel: 'Kerst bestellen',
    momenten: ['Do 19 nov: nieuwsbrief 1'],
    taken: {
      eigenaar: [
        'Do 19 nov: nieuwsbrief 1. Bar Brioche opent 2 december, kerstpakketten zijn nu te bestellen',
        'Uitnodigingen voor de openingsavond: buren en de Boschstraat, vaste gasten van Pellens, foodaccounts',
      ],
      social: ['Blok over Bar Brioche in de Instagram-bio van Pellens', 'Pellens: kerstdiner reserveren', 'Bar Brioche: de kerstpakketten en De Brouwer'],
    },
  },
  {
    maandag: '2026-11-23', titel: 'Black Friday en proefdraaien',
    momenten: ['Ma 23 nov: extraatje bij de bon kiezen', 'Wo 25 nov: nieuwsbrief 2', 'Vr 27 tot zo 29 nov: Black Friday'],
    taken: {
      eigenaar: ['Uiterlijk ma 23 nov: het extraatje bij de Black Friday-cadeaubon bepalen', 'Wo 25 nov: nieuwsbrief 2, Black Friday'],
      social: [
        'Black Friday-posts: Pellens cadeaubon met extra, Bar Brioche start de kerstpakketten (geen korting)',
        'Bar Brioche: aftellen in stories en het proefdraaien filmen',
        'Fotosessie van de ingerichte winkel',
      ],
      manager: ['Een of twee dagen proefdraaien in de winkel, na elke dag kort nabespreken', 'Amí daily gaat open: even gaan kijken'],
    },
  },
  {
    maandag: '2026-11-30', titel: 'Bar Brioche open',
    momenten: ['Di 1 dec: openingsavond', 'Wo 2 dec: eerste winkeldag', 'Do 3 dec: persbericht 2 en nieuwsbrief 3', 'Za 5 dec: Sinterklaas'],
    taken: {
      eigenaar: [
        'Di 1 dec, openingsavond: gasten vragen iets te delen op Instagram, niet om een review',
        'Do 3 dec: persbericht 2 met foto\'s van de avond',
        'Do 3 dec: nieuwsbrief 3, Sinterklaas-bonnen en Bar Brioche is open',
      ],
      social: [
        'Di 1 dec: live in stories, foto\'s en video van de openingsavond',
        'Vanaf wo 2 dec elke winkeldag een story met de toonbank',
        'Bar Brioche deze week vijf posts',
        'Za 5 dec: Sinterklaas, laatste oproep cadeaubonnen',
      ],
      manager: ['Vanaf wo 2 dec krijgt elke klant van Bar Brioche het QR-kaartje'],
      samen: ['Iedereen achter de toonbank stelt zich voor met naam', 'De nieuwe gastheer begint bij Pellens'],
    },
  },
  {
    maandag: '2026-12-07', titel: 'Vaste gasten en kerstdrukte',
    momenten: ['Do 10 dec: nieuwsbrief 4'],
    taken: {
      eigenaar: [
        'Do 10 dec: nieuwsbrief 4. Laatste plekken kerstdiner Pellens, kerstmenu en pakketten afhalen bij Bar Brioche, bonnen',
        'Elke review binnen een week beantwoorden, ook bij Bar Brioche',
      ],
      social: ['Pellens: elke vrije tafel op vrijdag en zaterdag direct een story', 'Pellens: kerstmenu, sfeer en het team', 'Bar Brioche: vaste klanten en de buurt, de mensen achter de toonbank met naam'],
      manager: ['Bar Brioche: na sluiting 10 minuten nabespreken'],
    },
  },
  {
    maandag: '2026-12-14', titel: 'Vaste gasten en kerstdrukte',
    momenten: [],
    taken: {
      eigenaar: ['Elke review binnen een week beantwoorden, ook bij Bar Brioche'],
      social: ['Pellens: elke vrije tafel op vrijdag en zaterdag direct een story', 'Pellens: kerstmenu, sfeer en het team', 'Bar Brioche: vaste klanten en de buurt, de mensen achter de toonbank met naam'],
      manager: ['Bar Brioche: na sluiting 10 minuten nabespreken'],
    },
  },
  {
    maandag: '2026-12-21', titel: 'Kerst',
    momenten: ['Wo 23 en do 24 dec: kerstpakketten afhalen', '24 tot 26 dec: kerst bij Pellens'],
    taken: {
      social: ['Het afhalen van kerstpakketten en kerstmenu in beeld', 'Pellens: kerst 24 tot 26 december'],
      samen: ['In elk kerstpakket een kaartje met Instagram en webshop', 'Alle kopers krijgen na het afhalen een mail met reviewlink, niet alleen de tevreden'],
    },
  },
  {
    maandag: '2026-12-28', titel: 'Afsluiten',
    momenten: ['Ma 28 dec: nieuwsbrief 5', 'Do 31 dec: kwartaalmeting'],
    taken: {
      eigenaar: ['Ma 28 dec: nieuwsbrief 5. Oud en nieuw, bonnen verzilveren, wat er in januari komt', 'Het tweede nieuwtje van Bar Brioche voor januari kiezen'],
      social: ['Do 31 dec: kwartaalmeting, alle doelen naast elkaar'],
    },
  },
]);

export const RITME = Object.freeze([
  { wanneer: 'Elke ochtend', wat: 'Vijf minuten: goedkeuren wat klaarstaat, wat gisteren online ging, nieuwe reviews en berichten, stand van de doelen', wie: 'Daan' },
  { wanneer: 'Maandag', wat: 'Bijhouden, 1,5 uur: carrousel "Last week:" voor Pellens en Bar Brioche, cijfers bijwerken, 10 minuten weekplanning met Daan, posts van de week vastzetten', wie: 'Mila' },
  { wanneer: 'Donderdag', wat: 'Content maken, 3 uur: filmen en fotograferen bij Pellens en Bar Brioche. Daan 15 minuten in beeld', wie: 'Mila' },
  { wanneer: 'Vrijdag', wat: 'Plaatsen, 2 uur: monteren, teksten in de app ter goedkeuring, inplannen, Google-post voor beide zaken', wie: 'Mila' },
  { wanneer: 'Elke dag', wat: 'Reageren, 15 tot 20 minuten: berichten en reacties op beide accounts, de dagelijkse story', wie: 'Mila' },
  { wanneer: 'Elke week', wat: 'Stories van het vuur en het land filmen, één TikTok voor Bar Brioche, elke review beantwoorden met je naam', wie: 'Daan' },
  { wanneer: 'Elke dienst', wat: 'QR-kaartje bij elke tafel, en vanaf 2 december bij elke klant van Bar Brioche. Iedereen op dezelfde manier om een review vragen', wie: 'Beau' },
  { wanneer: 'Vrijdag en zaterdag', wat: 'Tafel vrij? Direct een story: "Vanavond één tafel vrij. Wie pakt hem?"', wie: 'Beau en Mila' },
  { wanneer: 'Woensdag', wat: 'Weekcijfers invullen: gasten, reviews, kerstpakketten, en vanaf december maaltijden en aanmeldingen van Bar Brioche', wie: 'Beau' },
  { wanneer: 'Eerste maandag', wat: 'Maandcijfers en het thema van volgende maand', wie: 'Mila en Daan' },
]);

// Open: woensdag tot en met zondag. Weekdagen: 0 = zondag ... 6 = zaterdag.
const OPEN = new Set([3, 4, 5, 6, 0]);
// Bar Brioche: dinsdag tot en met zaterdag.
const WINKEL = new Set([2, 3, 4, 5, 6]);
const isOpen = c => OPEN.has(c.weekdag);
const winkelOpen = c => c.datum >= BAR_BRIOCHE_OPEN && WINKEL.has(c.weekdag);
const op = (...dagen) => c => dagen.includes(c.weekdag);
const elkeDag = () => true;
const ALLE = ['eigenaar', 'social', 'manager'];
// Routines van het eerste plan die met het plan tot januari stopten. Zo blijven oude reeksen kloppen.
const OUD = '2026-11-01';

// vanaf en tot: de routine geldt alleen tussen die datums (beide inbegrepen).
export const ROUTINES = Object.freeze([
  { key: 'cijfers-team', rollen: ALLE, label: 'Vijf minuten staand de cijfers van de week', wanneer: op(1), tot: OUD },

  { key: 'story', rollen: ['social'], label: 'Minstens één story Pellens', wanneer: isOpen },
  { key: 'story-barbrioche', rollen: ['social'], label: 'Story Bar Brioche: wat er vandaag ligt en wat op is', wanneer: winkelOpen },
  { key: 'reageren', rollen: ['social'], label: 'Reageren: berichten en reacties op beide accounts', hint: '15 tot 20 minuten', wanneer: c => isOpen(c) || c.datum >= PLAN_NIEUW },
  { key: 'last-week', rollen: ['social'], label: 'Carrousel "Last week:" voor Pellens en Bar Brioche', hint: 'Beelden van de afgelopen week', wanneer: op(1), vanaf: PLAN_NIEUW, link: '#posts' },
  { key: 'weekplanning', rollen: ['social'], label: '10 minuten weekplanning met Daan, posts van de week vastzetten', hint: 'Zeg erbij welk beeld en welke tekst nodig is', wanneer: op(1), link: '#posts' },
  { key: 'volgers', rollen: ['social'], label: 'Volgers van vorige week invullen', wanneer: op(1), link: '#cijfers' },
  { key: 'contentblok', rollen: ['social'], label: 'Content maken bij Pellens en Bar Brioche', hint: 'Ongeveer 3 uur. Daan 15 minuten in beeld', wanneer: op(4) },
  { key: 'inplannen', rollen: ['social'], label: 'Plaatsen: monteren, teksten ter goedkeuring, inplannen', hint: 'Ongeveer 2 uur', wanneer: op(5), link: '#posts' },
  { key: 'google-post', rollen: ['social'], label: 'Google-post voor Pellens en Bar Brioche', wanneer: op(5) },
  { key: 'beeldbank', rollen: ['social'], label: 'Map "Nieuw" in de beeldbank sorteren', wanneer: op(5) },
  { key: 'maandcijfers', rollen: ['social'], label: 'Maandcijfers invullen', wanneer: c => c.eersteMaandag, link: '#cijfers' },
  { key: 'maandthema', rollen: ['social', 'eigenaar'], label: 'Thema voor volgende maand vastzetten', hint: '30 minuten, Mila en Daan', wanneer: c => c.eersteMaandag, link: '#plan' },

  { key: 'reviewvraag', rollen: ['manager'], label: 'QR-kaartje bij elke tafel en om een review vragen', hint: 'Iedereen op dezelfde manier, nooit iets ervoor teruggeven', wanneer: isOpen },
  { key: 'reviewvraag-barbrioche', rollen: ['manager'], label: 'QR-kaartje bij elke klant van Bar Brioche', wanneer: winkelOpen },
  { key: 'tafel-vrij', rollen: ['manager'], label: 'Tafel vrij? Direct doorgeven voor een story', wanneer: op(5, 6) },
  { key: 'reviews-beantwoorden', rollen: ['manager'], label: 'Nieuwe Google-reviews beantwoorden', wanneer: op(3), tot: OUD },
  { key: 'gasten', rollen: ['manager'], label: 'Weekcijfers van vorige week invullen', hint: 'Gasten, reviews en kerstpakketten, vanaf december ook Bar Brioche', wanneer: op(3), link: '#cijfers' },
  { key: 'reserveringen', rollen: ['manager'], label: 'Reserveringen per bron van vorige maand invullen', wanneer: c => c.weekdag === 3 && c.dagVanMaand <= 7, link: '#cijfers' },

  { key: 'ochtendcheck', rollen: ['eigenaar'], label: 'Ochtendcheck: goedkeuren, gisteren, reviews en berichten, doelen', hint: '5 minuten', wanneer: elkeDag, vanaf: PLAN_NIEUW },
  { key: 'weekplanning-daan', rollen: ['eigenaar'], label: '10 minuten weekplanning met Mila', wanneer: op(1), link: '#week' },
  { key: 'teksten', rollen: ['eigenaar'], label: 'Teksten inspreken voor deze week', wanneer: op(2), tot: OUD, link: '#posts' },
  { key: 'linkedin', rollen: ['eigenaar'], label: 'LinkedIn-post: wat je deze maand van het land leerde', wanneer: c => c.weekdag === 2 && (c.dagVanMaand <= 7 || (c.dagVanMaand >= 15 && c.dagVanMaand <= 21)), tot: OUD },
  { key: 'reviews-daan', rollen: ['eigenaar'], label: 'Nieuwe reviews beantwoorden, kort en met je naam', hint: 'Pellens en Bar Brioche', wanneer: op(2), vanaf: PLAN_NIEUW },
  { key: 'tiktok', rollen: ['eigenaar'], label: 'TikTok-video voor Bar Brioche', wanneer: op(3), vanaf: '2026-11-09' },
  { key: 'in-beeld', rollen: ['eigenaar'], label: '15 minuten in beeld bij het contentblok van Mila', wanneer: op(4), vanaf: PLAN_NIEUW },
  { key: 'stories-vuur', rollen: ['eigenaar'], label: 'Stories van het vuur en het land filmen', hint: 'Mila plaatst ze', wanneer: op(5), vanaf: PLAN_NIEUW },
]);

// Cijfers: per week (maandag van de gemeten week) of per maand (eerste dag van de gemeten maand).
// zaak: bij welke zaak het cijfer hoort. vanaf en tot: in welke weken het wordt ingevuld.
// doelVan en doelTot: waar de lijn naar het decemberdoel begint en eindigt (anders 1 oktober tot 31 december).
// weekdoel: een doel per week in plaats van een stand.
export const METRICS = Object.freeze([
  { key: 'gasten_diner', label: 'Gasten per diner (gemiddeld)', periode: 'week', rol: 'manager', decimalen: 1, zaak: 'pellens' },
  { key: 'gasten_lunch', label: 'Gasten per lunch (gemiddeld)', periode: 'week', rol: 'manager', decimalen: 1, zaak: 'pellens' },
  // bron: waar scripts/meta-cijfers.mjs en scripts/google-cijfers.mjs het cijfer vandaan halen.
  { key: 'ig_volgers_pellens', label: 'Instagram-volgers Pellens', periode: 'week', rol: 'social', bron: 'Meta', zaak: 'pellens' },
  { key: 'ig_volgers_barbrioche', label: 'Instagram-volgers Bar Brioche', periode: 'week', rol: 'social', zaak: 'barbrioche', vanaf: '2026-10-26', doelVan: PLAN_NIEUW },
  { key: 'ig_volgers_brouwerij', label: 'Instagram-volgers Brouwerij', periode: 'week', rol: 'social', bron: 'Meta', zaak: 'barbrioche' },
  { key: 'fb_volgers_pellens', label: 'Facebook-volgers Pellens', periode: 'week', rol: 'social', bron: 'Meta', zaak: 'pellens' },
  { key: 'reviews_pellens_week', label: 'Nieuwe Google-reviews Pellens', periode: 'week', rol: 'manager', zaak: 'pellens', vanaf: PLAN_NIEUW, weekdoel: { meerDan: 5, tekst: 'meer dan 5 per week' } },
  { key: 'google_reviews_barbrioche', label: 'Google-reviews Bar Brioche (totaal)', periode: 'week', rol: 'manager', zaak: 'barbrioche', vanaf: '2026-11-30', doelVan: BAR_BRIOCHE_OPEN, doelTot: '2026-12-29' },
  { key: 'kerstpakketten', label: 'Kerstpakketten verkocht (totaal)', periode: 'week', rol: 'manager', zaak: 'barbrioche', vanaf: PLAN_NIEUW, tot: '2026-12-21', doelVan: PLAN_NIEUW, doelTot: '2026-12-24' },
  { key: 'maaltijden_barbrioche', label: 'Maaltijden verkocht bij Bar Brioche', periode: 'week', rol: 'manager', zaak: 'barbrioche', vanaf: '2026-11-30' },
  { key: 'nieuwsbrief_barbrioche', label: 'Nieuwsbriefaanmeldingen Bar Brioche', periode: 'week', rol: 'manager', zaak: 'barbrioche', vanaf: '2026-11-30' },

  { key: 'ig_linkklikken', label: 'Klikken op de link in bio', periode: 'maand', rol: 'social', zaak: 'pellens' },
  { key: 'gbp_weergaven', label: 'Google-profiel: weergaven', periode: 'maand', rol: 'social', bron: 'Google', zaak: 'pellens' },
  { key: 'gbp_route', label: 'Google-profiel: routeverzoeken', periode: 'maand', rol: 'social', bron: 'Google', zaak: 'pellens' },
  { key: 'gbp_bellen', label: 'Google-profiel: belklikken', periode: 'maand', rol: 'social', bron: 'Google', zaak: 'pellens' },
  { key: 'gbp_website', label: 'Google-profiel: websiteklikken', periode: 'maand', rol: 'social', bron: 'Google', zaak: 'pellens' },
  { key: 'google_reviews', label: 'Google-reviews Pellens (totaal)', periode: 'maand', rol: 'social', bron: 'Google', zaak: 'pellens' },
  { key: 'google_score', label: 'Google-score Pellens', periode: 'maand', rol: 'social', decimalen: 1, bron: 'Google', zaak: 'pellens' },
  { key: 'tripadvisor_reviews', label: 'Tripadvisor-reviews (totaal)', periode: 'maand', rol: 'social', zaak: 'pellens' },
  { key: 'emailadressen', label: 'E-mailadressen van gasten', periode: 'maand', rol: 'social', zaak: 'pellens' },
  { key: 'res_instagram', label: 'Reserveringen via Instagram', periode: 'maand', rol: 'manager', zaak: 'pellens' },
  { key: 'res_google', label: 'Reserveringen via Google', periode: 'maand', rol: 'manager', zaak: 'pellens' },
  { key: 'res_website', label: 'Reserveringen via de website', periode: 'maand', rol: 'manager', zaak: 'pellens' },
  { key: 'res_telefoon', label: 'Reserveringen via telefoon', periode: 'maand', rol: 'manager', zaak: 'pellens' },
]);

export function metric(key) {
  return METRICS.find(m => m.key === key) || null;
}
