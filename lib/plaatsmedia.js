// Maakt foto's en video's klaar voor Instagram en Facebook. Foto's worden JPEG (Instagram neemt
// niets anders), maximaal 1440 breed, en voor de feed bijgesneden tot tussen 4:5 en 1,91:1, zoals
// de Instagram-app zelf ook doet. Zo is wat je in de app ziet precies wat er online komt.
// plaatsregels.js is supabase/functions/marketing-plaatsen/regels.js; de build zet hem in lib/.
import { LIMIETEN, VIDEO_MIME, soortVan } from './plaatsregels.js';

const MB = 1024 * 1024;

async function laadBeeld(bestand) {
  try {
    return await createImageBitmap(bestand, { imageOrientation: 'from-image' });
  } catch {
    const url = URL.createObjectURL(bestand);
    try {
      const img = new Image();
      img.src = url;
      await img.decode();
      return img;
    } catch {
      throw new Error(`${bestand.name}: deze foto kan de browser niet openen. Bewaar hem eerst als JPEG.`);
    } finally {
      URL.revokeObjectURL(url);
    }
  }
}

const naarBlob = (canvas, kwaliteit) => new Promise(ok => canvas.toBlob(ok, 'image/jpeg', kwaliteit));

// Welke verhouding een foto krijgt: in de feed tussen 4:5 en 1,91:1, in een carrousel die van de
// eerste foto (Instagram snijdt de rest daar toch op bij), in een story en op Facebook ongewijzigd.
export function doelRatio(kanaal, breedte, hoogte, eersteRatio = null) {
  if (kanaal === 'story' || kanaal === 'facebook') return null;
  if (kanaal === 'carrousel' && eersteRatio) return eersteRatio;
  return Math.min(LIMIETEN.ratioMax, Math.max(LIMIETEN.ratioMin, breedte / hoogte));
}

export async function maakFoto(bestand, kanaal, eersteRatio = null) {
  const bron = await laadBeeld(bestand);
  const b = bron.width;
  const h = bron.height;
  const ratio = doelRatio(kanaal, b, h, eersteRatio) || b / h;
  const snijB = b / h > ratio ? h * ratio : b;
  const snijH = b / h > ratio ? h : b / ratio;
  const schaal = Math.min(1, LIMIETEN.fotoBreedte / snijB);
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(snijB * schaal);
  canvas.height = Math.round(snijH * schaal);
  canvas.getContext('2d').drawImage(bron, (b - snijB) / 2, (h - snijH) / 2, snijB, snijH, 0, 0, canvas.width, canvas.height);
  if (bron.close) bron.close();

  let blob = await naarBlob(canvas, 0.9);
  if (blob && blob.size > LIMIETEN.igFotoMb * MB) blob = await naarBlob(canvas, 0.78);
  if (!blob) throw new Error(`${bestand.name}: omzetten naar JPEG lukte niet.`);
  return {
    blob,
    gegevens: { soort: 'foto', mime: 'image/jpeg', grootte: blob.size, breedte: canvas.width, hoogte: canvas.height },
  };
}

export function videoGegevens(bestand) {
  const mime = bestand.type || (/\.mov$/i.test(bestand.name) ? 'video/quicktime' : 'video/mp4');
  if (!VIDEO_MIME.includes(mime)) return Promise.reject(new Error(`${bestand.name}: een video moet MP4 of MOV zijn.`));
  return new Promise(ok => {
    const url = URL.createObjectURL(bestand);
    const video = document.createElement('video');
    const klaar = extra => {
      URL.revokeObjectURL(url);
      ok({ soort: 'video', mime, grootte: bestand.size, ...extra });
    };
    video.preload = 'metadata';
    video.muted = true;
    video.onloadedmetadata = () => klaar({
      duur: Number.isFinite(video.duration) ? Math.round(video.duration * 10) / 10 : null,
      breedte: video.videoWidth || null,
      hoogte: video.videoHeight || null,
    });
    // Kan de browser de video niet lezen, dan controleert Meta hem zelf.
    video.onerror = () => klaar({ duur: null, breedte: null, hoogte: null });
    video.src = url;
  });
}

// Zet een gekozen bestand klaar: foto omzetten, van video de lengte en maat lezen.
export async function maakKlaar(bestand, kanaal, eersteRatio = null) {
  const soort = soortVan(bestand.type) || (/\.(mov|mp4)$/i.test(bestand.name) ? 'video' : /\.(jpe?g|png|heic|heif|webp)$/i.test(bestand.name) ? 'foto' : null);
  if (soort === 'foto') return maakFoto(bestand, kanaal, eersteRatio);
  if (soort === 'video') return { blob: bestand, gegevens: await videoGegevens(bestand) };
  throw new Error(`${bestand.name}: alleen foto's en video's.`);
}

// Wat er bij dit kanaal klaar moet staan, in één zin.
export function uitlegVoor(kanaal) {
  return {
    foto: 'Eén foto. Een staande foto snijdt de app bij tot 4:5, zoals Instagram.',
    carrousel: '2 tot 10 foto\'s of video\'s, in de volgorde waarin je ze kiest.',
    reel: 'Eén video van 3 seconden tot 15 minuten, rechtop (9:16). Op Facebook tot 90 seconden.',
    story: 'Eén foto of een video tot 60 seconden, rechtop (9:16).',
    facebook: 'Een rij foto\'s of één video.',
  }[kanaal] || '';
}
