// Upload naar de beeldbank: de server opent een hervatbare sessie bij Google Drive,
// de browser stuurt het bestand er rechtstreeks heen en hervat na een haperende verbinding.

const EXTENSIES = {
  jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', heic: 'image/heic', heif: 'image/heif',
  webp: 'image/webp', gif: 'image/gif', mov: 'video/quicktime', mp4: 'video/mp4', m4v: 'video/x-m4v',
  webm: 'video/webm', avi: 'video/x-msvideo',
};

export function mimeVan(bestand) {
  if (bestand.type) return bestand.type;
  const ext = String(bestand.name || '').split('.').pop().toLowerCase();
  return EXTENSIES[ext] || '';
}

function verstuur(url, bestand, { start = 0, mime, opVoortgang }) {
  return new Promise((ok, fout) => {
    const xhr = new XMLHttpRequest();
    xhr.open('PUT', url);
    xhr.setRequestHeader('Content-Type', mime);
    if (start > 0) xhr.setRequestHeader('Content-Range', `bytes ${start}-${bestand.size - 1}/${bestand.size}`);
    xhr.upload.onprogress = e => opVoortgang && opVoortgang((start + e.loaded) / bestand.size);
    xhr.onload = () => {
      if (xhr.status === 200 || xhr.status === 201) {
        try { ok(JSON.parse(xhr.responseText)); } catch { ok({}); }
      } else {
        fout(Object.assign(new Error(`Upload mislukt (${xhr.status}).`), { status: xhr.status }));
      }
    };
    xhr.onerror = () => fout(Object.assign(new Error('Verbinding weggevallen.'), { netwerk: true }));
    xhr.send(start > 0 ? bestand.slice(start) : bestand);
  });
}

// Vraagt Google hoeveel er al binnen is (308 = deels binnen, met Range-header).
function vraagStand(url, bestand) {
  return new Promise(ok => {
    const xhr = new XMLHttpRequest();
    xhr.open('PUT', url);
    xhr.setRequestHeader('Content-Range', `bytes */${bestand.size}`);
    xhr.onload = () => {
      if (xhr.status === 200 || xhr.status === 201) return ok({ klaar: JSON.parse(xhr.responseText || '{}') });
      const range = xhr.getResponseHeader('Range');
      const match = range && /bytes=0-(\d+)/.exec(range);
      ok({ start: match ? Number(match[1]) + 1 : 0 });
    };
    xhr.onerror = () => ok({ start: 0 });
    xhr.send();
  });
}

const wacht = ms => new Promise(r => setTimeout(r, ms));

async function demoUpload(opVoortgang) {
  for (let i = 1; i <= 20; i += 1) {
    await wacht(60 + Math.random() * 80);
    opVoortgang(i / 20);
  }
  return { id: 'demo', webViewLink: null };
}

export async function uploadNaarBeeldbank(opslag, bestand, onderwerp, opVoortgang = () => {}) {
  const mime = mimeVan(bestand);
  if (!/^(image|video)\//.test(mime)) throw new Error(`${bestand.name}: alleen foto's en video's.`);

  const { uploadUrl, bestandsnaam } = await opslag.startUpload({
    onderwerp, naam: bestand.name, mime, grootte: bestand.size,
  });

  let resultaat;
  if (opslag.demo) {
    resultaat = await demoUpload(opVoortgang);
  } else {
    let start = 0;
    for (let poging = 0; ; poging += 1) {
      try {
        resultaat = await verstuur(uploadUrl, bestand, { start, mime, opVoortgang });
        break;
      } catch (fout) {
        if (poging >= 4 || !(fout.netwerk || fout.status >= 500)) throw fout;
        await wacht(1000 * 2 ** poging);
        const stand = await vraagStand(uploadUrl, bestand);
        if (stand.klaar) { resultaat = stand.klaar; break; }
        start = stand.start;
      }
    }
  }

  opVoortgang(1);
  return opslag.uploadVastleggen({
    drive_file_id: resultaat.id || 'onbekend',
    naam: resultaat.name || bestandsnaam || bestand.name,
    onderwerp,
    mime,
    grootte: bestand.size,
    link: resultaat.webViewLink || null,
  });
}
