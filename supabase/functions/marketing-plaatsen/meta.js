// Aanroepen bij Meta: Instagram via de Content Publishing API, Facebook via de Pages API.
// Het paginatoken gaat altijd in een header, nooit in een adres of in een melding.
// Meta haalt de foto's en video's zelf op via de tijdelijke link die de functie meegeeft.

export const VERSIE = 'v26.0';
const GRAPH = `https://graph.facebook.com/${VERSIE}`;
const GRAPH_VIDEO = `https://graph-video.facebook.com/${VERSIE}`;
const RUPLOAD = `https://rupload.facebook.com/video-upload/${VERSIE}`;

// Een melding van Meta in gewone taal. `opnieuw` betekent: begin bij Meta weer bij stap één.
export class MetaFout extends Error {
  constructor(bericht, { code = null, opnieuw = false } = {}) {
    super(bericht);
    this.code = code;
    this.opnieuw = opnieuw;
  }
}

function vertaal(fout = {}, status = 0) {
  const code = fout.code ?? status;
  const tekst = String(fout.error_user_msg || fout.message || 'onbekende fout').replace(/\s+/g, ' ').trim();
  if (code === 190) {
    return new MetaFout('Het Meta-token is verlopen of ingetrokken. Maak een nieuw paginatoken en vervang het geheim in GitHub.', { code });
  }
  if (code === 10 || (code >= 200 && code < 300)) {
    return new MetaFout(`Het Meta-token mist een recht (${code}): ${tekst}`, { code });
  }
  if ([4, 17, 32, 613].includes(code)) {
    return new MetaFout('Meta krijgt te veel aanvragen van de app. Probeer het over een uur opnieuw.', { code });
  }
  return new MetaFout(`Meta weigert (${code}): ${tekst}`, { code });
}

function formulier(velden) {
  const body = new URLSearchParams();
  for (const [k, v] of Object.entries(velden)) {
    if (v === undefined || v === null) continue;
    body.set(k, typeof v === 'object' ? JSON.stringify(v) : String(v));
  }
  return body;
}

async function vraag(ctx, pad, { methode = 'GET', velden = {}, host = GRAPH } = {}) {
  const adres = new URL(`${host}/${pad}`);
  const opties = { method: methode, headers: { Authorization: `Bearer ${ctx.token}` } };
  if (methode === 'GET') {
    for (const [k, v] of Object.entries(velden)) adres.searchParams.set(k, v);
  } else {
    opties.body = formulier(velden);
  }
  const antwoord = await ctx.fetch(adres, opties);
  const data = await antwoord.json().catch(() => ({}));
  if (!antwoord.ok || data.error) throw vertaal(data.error, antwoord.status);
  return data;
}

// De Facebook-pagina van het token en het Instagram-account dat eraan hangt.
export async function pagina(ctx) {
  const data = await vraag(ctx, 'me', { velden: { fields: 'id,name,instagram_business_account' } });
  return { paginaId: data.id, igId: data.instagram_business_account ? data.instagram_business_account.id : null };
}

// ---------------------------------------------------------------------------
// Instagram: container maken, wachten tot hij klaar is, publiceren
// ---------------------------------------------------------------------------

// Wat er in een Instagram-container gaat, per kanaal en per foto of video.
export function igVelden(kanaal, item, link, { tekst, kind = false } = {}) {
  const video = item.soort === 'video';
  if (kind) return video ? { media_type: 'VIDEO', video_url: link, is_carousel_item: true } : { image_url: link, is_carousel_item: true };
  if (kanaal === 'reel') return { media_type: 'REELS', video_url: link, caption: tekst, share_to_feed: true };
  if (kanaal === 'story') return video ? { media_type: 'STORIES', video_url: link } : { media_type: 'STORIES', image_url: link };
  return { image_url: link, caption: tekst };
}

export async function igContainer(ctx, igId, velden) {
  return (await vraag(ctx, `${igId}/media`, { methode: 'POST', velden })).id;
}

export async function igStatus(ctx, containerId) {
  return vraag(ctx, containerId, { velden: { fields: 'status_code,status' } });
}

// Instagram staat 100 posts per 24 uur toe via de API; een carrousel telt als één.
export async function igRuimte(ctx, igId) {
  const data = await vraag(ctx, `${igId}/content_publishing_limit`, { velden: { fields: 'quota_usage,config' } });
  const rij = (data.data && data.data[0]) || {};
  const totaal = rij.config && rij.config.quota_total;
  return { gebruikt: rij.quota_usage ?? 0, totaal: totaal ?? 100 };
}

export async function igPubliceer(ctx, igId, containerId) {
  return (await vraag(ctx, `${igId}/media_publish`, { methode: 'POST', velden: { creation_id: containerId } })).id;
}

export async function igLink(ctx, mediaId) {
  try {
    return (await vraag(ctx, mediaId, { velden: { fields: 'permalink' } })).permalink || null;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Facebook-pagina
// ---------------------------------------------------------------------------

export async function fbFoto(ctx, paginaId, link, { tekst, gepubliceerd = true } = {}) {
  return vraag(ctx, `${paginaId}/photos`, { methode: 'POST', velden: { url: link, caption: tekst, published: gepubliceerd } });
}

// Eén foto als gewone post, meer foto's als één post met alle foto's erin.
export async function fbFotos(ctx, paginaId, links, tekst) {
  if (links.length === 1) {
    const foto = await fbFoto(ctx, paginaId, links[0], { tekst });
    return foto.post_id || foto.id;
  }
  const velden = { message: tekst };
  for (const [i, link] of links.entries()) {
    const foto = await fbFoto(ctx, paginaId, link, { gepubliceerd: false });
    velden[`attached_media[${i}]`] = { media_fbid: foto.id };
  }
  return (await vraag(ctx, `${paginaId}/feed`, { methode: 'POST', velden })).id;
}

// Reels en video-stories: sessie openen, Meta de video laten ophalen, afronden.
async function fbVideoUpload(ctx, paginaId, rand, link) {
  const start = await vraag(ctx, `${paginaId}/${rand}`, { methode: 'POST', velden: { upload_phase: 'start' } });
  const antwoord = await ctx.fetch(start.upload_url || `${RUPLOAD}/${start.video_id}`, {
    method: 'POST',
    headers: { Authorization: `OAuth ${ctx.token}`, file_url: link },
  });
  const data = await antwoord.json().catch(() => ({}));
  if (!antwoord.ok || data.error || data.success === false) {
    const info = data.debug_info || {};
    throw data.error ? vertaal(data.error, antwoord.status)
      : new MetaFout(`Facebook kon de video niet ophalen (${antwoord.status}${info.message ? `: ${info.message}` : ''}).`);
  }
  return start.video_id;
}

export async function fbReel(ctx, paginaId, link, tekst) {
  const videoId = await fbVideoUpload(ctx, paginaId, 'video_reels', link);
  await vraag(ctx, `${paginaId}/video_reels`, {
    methode: 'POST',
    velden: { upload_phase: 'finish', video_id: videoId, video_state: 'PUBLISHED', description: tekst },
  });
  return videoId;
}

export async function fbStory(ctx, paginaId, item, link) {
  if (item.soort === 'video') {
    const videoId = await fbVideoUpload(ctx, paginaId, 'video_stories', link);
    const klaar = await vraag(ctx, `${paginaId}/video_stories`, { methode: 'POST', velden: { upload_phase: 'finish', video_id: videoId } });
    return klaar.post_id || videoId;
  }
  const foto = await fbFoto(ctx, paginaId, link, { gepubliceerd: false });
  return (await vraag(ctx, `${paginaId}/photo_stories`, { methode: 'POST', velden: { photo_id: foto.id } })).post_id;
}

// Een gewone video op de pagina (kanaal Facebook): Meta haalt hem zelf op via file_url.
export async function fbVideo(ctx, paginaId, link, tekst) {
  return (await vraag(ctx, `${paginaId}/videos`, { methode: 'POST', host: GRAPH_VIDEO, velden: { file_url: link, description: tekst } })).id;
}
