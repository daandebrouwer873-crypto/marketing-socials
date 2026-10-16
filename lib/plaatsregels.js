// Wat Instagram en Facebook per soort post accepteren (Meta-documentatie, Graph API v26.0).
// De serverfunctie controleert hiermee vóór er iets online gaat. De app gebruikt hetzelfde bestand:
// scripts/build-static.mjs kopieert het naar dist/lib/plaatsregels.js.

export const PLAATSBAAR = Object.freeze(['foto', 'carrousel', 'reel', 'story', 'facebook']);

export const PLATFORMS = Object.freeze({ instagram: 'Instagram', facebook: 'Facebook' });

const MB = 1024 * 1024;

export const LIMIETEN = Object.freeze({
  // Instagram-foto: alleen JPEG, max 8 MB, van 4:5 (staand) tot 1,91:1 (liggend), max 1440 breed.
  igFotoMb: 8,
  fbFotoMb: 10,
  ratioMin: 4 / 5,
  ratioMax: 1.91,
  fotoBreedte: 1440,
  carrousel: { min: 2, max: 10 },
  facebookFotos: 10,
  // Seconden en megabytes.
  igReel: { min: 3, max: 15 * 60, mb: 300 },
  fbReel: { min: 3, max: 90 },
  story: { min: 3, max: 60, mb: 100 },
  hashtags: 30,
  vermeldingen: 20,
});

export const VIDEO_MIME = Object.freeze(['video/mp4', 'video/quicktime']);

export function soortVan(mime) {
  if (/^image\//.test(mime || '')) return 'foto';
  if (/^video\//.test(mime || '')) return 'video';
  return null;
}

// Welke platforms standaard aan staan bij een kanaal.
export function platformsVoor(kanaal) {
  if (kanaal === 'facebook') return ['facebook'];
  return PLAATSBAAR.includes(kanaal) ? ['instagram', 'facebook'] : [];
}

const tel = (tekst, teken) => (String(tekst || '').match(new RegExp(`(^|\\s)${teken}[\\p{L}\\p{N}_.]+`, 'gu')) || []).length;
const seconden = s => `${Math.round(s)} seconden`;

function fotoBezwaren(m, platform, { ratio = true } = {}) {
  const uit = [];
  if (platform === 'instagram') {
    if (m.mime && m.mime !== 'image/jpeg') uit.push('Instagram neemt alleen JPEG-foto\'s.');
    if (m.grootte > LIMIETEN.igFotoMb * MB) uit.push(`Een foto mag op Instagram maximaal ${LIMIETEN.igFotoMb} MB zijn.`);
    if (ratio && m.breedte && m.hoogte) {
      const r = m.breedte / m.hoogte;
      if (r < LIMIETEN.ratioMin - 0.01 || r > LIMIETEN.ratioMax + 0.01) {
        uit.push('Een foto moet op Instagram tussen 4:5 (staand) en 1,91:1 (liggend) zijn.');
      }
    }
  } else if (m.grootte > LIMIETEN.fbFotoMb * MB) {
    uit.push(`Een foto mag op Facebook maximaal ${LIMIETEN.fbFotoMb} MB zijn.`);
  }
  return uit;
}

function videoBezwaren(m, { min, max, mb }) {
  const uit = [];
  if (m.mime && !VIDEO_MIME.includes(m.mime)) uit.push('Een video moet MP4 of MOV zijn.');
  if (mb && m.grootte > mb * MB) uit.push(`De video mag maximaal ${mb} MB zijn.`);
  if (Number.isFinite(m.duur) && m.duur > 0) {
    if (m.duur < min) uit.push(`De video moet minstens ${seconden(min)} duren.`);
    if (max && m.duur > max + 0.5) {
      uit.push(max >= 120 ? `De video mag maximaal ${max / 60} minuten duren.` : `De video mag maximaal ${seconden(max)} duren.`);
    }
  }
  return uit;
}

// Wat er niet klopt om deze post op dit platform te zetten. Een lege lijst betekent: kan.
export function bezwaren(post, platform) {
  const media = Array.isArray(post.media) ? post.media : [];
  const fotos = media.filter(m => m.soort === 'foto');
  const videos = media.filter(m => m.soort === 'video');
  const uit = [];

  if (!PLAATSBAAR.includes(post.kanaal)) return ['Dit kanaal plaatst de app niet zelf.'];
  if (!PLATFORMS[platform]) return ['Onbekend platform.'];
  if (!media.length) return ['Zet eerst de foto\'s of de video klaar.'];

  if (platform === 'instagram' && post.kanaal !== 'story') {
    if (tel(post.tekst, '#') > LIMIETEN.hashtags) uit.push(`Instagram staat maximaal ${LIMIETEN.hashtags} hashtags toe.`);
    if (tel(post.tekst, '@') > LIMIETEN.vermeldingen) uit.push(`Instagram staat maximaal ${LIMIETEN.vermeldingen} vermeldingen toe.`);
  }

  switch (post.kanaal) {
    case 'foto':
      if (media.length !== 1 || fotos.length !== 1) return ['Een fotopost heeft precies één foto.'];
      uit.push(...fotoBezwaren(fotos[0], platform));
      break;
    case 'carrousel': {
      const { min, max } = LIMIETEN.carrousel;
      if (media.length < min || media.length > max) return [`Een carrousel heeft ${min} tot ${max} foto's of video's.`];
      if (platform === 'facebook' && videos.length) return ['Een carrousel met video kan de app niet op Facebook zetten.'];
      for (const m of fotos) uit.push(...fotoBezwaren(m, platform));
      for (const m of videos) uit.push(...videoBezwaren(m, LIMIETEN.igReel));
      break;
    }
    case 'reel':
      if (media.length !== 1 || videos.length !== 1) return ['Een reel is precies één video.'];
      uit.push(...videoBezwaren(videos[0], platform === 'instagram' ? LIMIETEN.igReel : LIMIETEN.fbReel));
      break;
    case 'story':
      if (media.length !== 1) return ['Een story is één foto of één video.'];
      if (fotos.length) uit.push(...fotoBezwaren(fotos[0], platform, { ratio: false }));
      else uit.push(...videoBezwaren(videos[0], LIMIETEN.story));
      break;
    case 'facebook':
      if (platform === 'instagram') return ['Dit kanaal is alleen Facebook.'];
      if (videos.length && media.length > 1) return ['Op Facebook gaat één video of een rij foto\'s, niet allebei.'];
      if (fotos.length > LIMIETEN.facebookFotos) return [`Op Facebook gaan maximaal ${LIMIETEN.facebookFotos} foto's in één post.`];
      for (const m of fotos) uit.push(...fotoBezwaren(m, platform));
      for (const m of videos) uit.push(...videoBezwaren(m, { min: 1 }));
      break;
    default:
      break;
  }
  return [...new Set(uit)];
}
