// Zet een goedgekeurde post op Instagram en de Facebook-pagina. Draait als Supabase Edge Function
// (index.ts) en werkt met de inlog van wie op Plaatsen drukt: de database beslist of het mag
// (migratie 003). Het paginatoken staat alleen in de geheimen van de functie.
//
// Elke aanroep doet zoveel als nu kan en bewaart de stand. Moet Meta een video nog verwerken, dan
// antwoordt de functie met `wachten` en roept de app hem een paar seconden later opnieuw aan.
import {
  MetaFout, fbFotos, fbReel, fbStory, fbVideo, igContainer, igLink, igPubliceer, igRuimte, igStatus, igVelden, pagina,
} from './meta.js';
import { PLATFORMS, bezwaren } from './regels.js';

// De live app, de Netlify-site en `npm run dev` op de eigen laptop (om te testen vóór het live staat).
const HERKOMSTEN = [
  'https://daandebrouwer873-crypto.github.io', 'https://pellens-marketing.netlify.app', 'http://localhost:4321',
];
const OPSLAG = 'marketing-plaatsen';
const LINK_GELDIG = 60 * 60;
const OPNIEUW_OVER = 10_000;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const zin = tekst => (/[.!?]$/.test(tekst) ? tekst : `${tekst}.`);

// Per merk het GitHub-geheim met het paginatoken, en of er een eigen Facebook-pagina is.
export const MERKEN = Object.freeze({
  pellens: { naam: 'Pellens', token: 'META_TOKEN_PELLENS', facebook: true },
  brouwerij: { naam: 'Brouwerij de Brouwer', token: 'META_TOKEN_BROUWERIJ', facebook: false },
});

class Weigering extends Error {
  constructor(status, bericht) {
    super(bericht);
    this.status = status;
  }
}

// ---------------------------------------------------------------------------
// Database en opslag, met de inlog van de gebruiker
// ---------------------------------------------------------------------------

function maakDb({ url, apikey, token, fetch }) {
  const headers = { apikey, Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };

  async function rpc(naam, args) {
    const antwoord = await fetch(`${url}/rest/v1/rpc/${naam}`, { method: 'POST', headers, body: JSON.stringify(args) });
    const data = await antwoord.json().catch(() => ({}));
    if (antwoord.ok) return data;
    if (antwoord.status === 401 || /JWT/i.test(data.message || '')) throw new Weigering(401, 'Je sessie is verlopen. Log opnieuw in.');
    if (data.code === 'P0001') throw new Weigering(409, data.message);
    if (data.code === '42501') throw new Weigering(403, 'Dit account mag dit niet.');
    throw new Weigering(502, `De database weigert (${antwoord.status}). Probeer het zo nog eens.`);
  }

  return {
    pak: (post, kanalen) => rpc('marketing_plaatsen_pak', { p_post: post, p_kanalen: kanalen }),
    bewaar: (post, velden) => rpc('marketing_plaatsen_bewaar', { p_post: post, ...velden }),
    async link(pad) {
      const deel = pad.split('/').map(encodeURIComponent).join('/');
      const antwoord = await fetch(`${url}/storage/v1/object/sign/${OPSLAG}/${deel}`, {
        method: 'POST', headers, body: JSON.stringify({ expiresIn: LINK_GELDIG }),
      });
      const data = await antwoord.json().catch(() => ({}));
      if (!antwoord.ok || !data.signedURL) throw new Weigering(400, `Een bestand is niet te vinden in de opslag (${antwoord.status}). Zet het opnieuw klaar.`);
      return `${url}/storage/v1${data.signedURL}`;
    },
  };
}

// ---------------------------------------------------------------------------
// Instagram en Facebook, elk een stap verder
// ---------------------------------------------------------------------------

const klaarOp = (post, stand, platform) => (platform === 'instagram'
  ? Boolean(post.ig_media_id || (stand.instagram && stand.instagram.geplaatst))
  : Boolean(post.fb_post_id));

async function stapInstagram({ meta, igId, post, links, stand, bewaarStand }) {
  const s = stand.instagram || (stand.instagram = {});
  const tekst = post.kanaal === 'story' ? undefined : post.tekst;

  if (post.kanaal === 'carrousel' && !s.container) {
    if (!s.kinderen) {
      const kinderen = [];
      for (const [i, item] of post.media.entries()) kinderen.push(await igContainer(meta, igId, igVelden(post.kanaal, item, links[i], { kind: true })));
      s.kinderen = kinderen;
      await bewaarStand();
    }
    const standen = await Promise.all(s.kinderen.map(id => igStatus(meta, id)));
    const mis = standen.find(x => x.status_code === 'ERROR' || x.status_code === 'EXPIRED');
    if (mis) throw new MetaFout(`Instagram kon een deel van de carrousel niet verwerken (${mis.status_code}${mis.status ? `: ${mis.status}` : ''}).`, { opnieuw: true });
    if (standen.some(x => x.status_code !== 'FINISHED')) return { wachten: true };
    s.container = await igContainer(meta, igId, { media_type: 'CAROUSEL', children: s.kinderen.join(','), caption: tekst });
    await bewaarStand();
  } else if (!s.container) {
    s.container = await igContainer(meta, igId, igVelden(post.kanaal, post.media[0], links[0], { tekst }));
    await bewaarStand();
  }

  const status = await igStatus(meta, s.container);
  if (status.status_code === 'IN_PROGRESS') return { wachten: true };
  // Al gepubliceerd bij een eerdere poging die daarna haperde: niet nog een keer.
  if (status.status_code === 'PUBLISHED') {
    s.geplaatst = true;
    return {};
  }
  if (status.status_code !== 'FINISHED') {
    throw new MetaFout(`Instagram kon het beeld niet verwerken (${status.status_code}${status.status ? `: ${status.status}` : ''}).`, { opnieuw: true });
  }

  // Lukt het opvragen van de limiet niet, dan zegt media_publish het zelf wel.
  const ruimte = await igRuimte(meta, igId).catch(() => null);
  if (ruimte && ruimte.gebruikt >= ruimte.totaal) throw new MetaFout(`De limiet van ${ruimte.totaal} posts per 24 uur is bereikt. Probeer het morgen opnieuw.`);
  const mediaId = await igPubliceer(meta, igId, s.container);
  s.geplaatst = true;
  return { ig_media_id: mediaId, ig_link: await igLink(meta, mediaId) };
}

async function stapFacebook({ meta, paginaId, post, links }) {
  const tekst = post.tekst || undefined;
  const [eerste] = post.media;
  let id;
  if (post.kanaal === 'reel') id = await fbReel(meta, paginaId, links[0], tekst);
  else if (post.kanaal === 'story') id = await fbStory(meta, paginaId, eerste, links[0]);
  else if (eerste.soort === 'video') id = await fbVideo(meta, paginaId, links[0], tekst);
  else id = await fbFotos(meta, paginaId, links, tekst);
  return { fb_post_id: String(id) };
}

// ---------------------------------------------------------------------------
// De aanvraag
// ---------------------------------------------------------------------------

// Supabase geeft de publieke sleutels mee als JSON; de app stuurt hem ook zelf mee als apikey.
function publiekeSleutel(env) {
  try {
    return Object.values(JSON.parse(env.SUPABASE_PUBLISHABLE_KEYS || '{}'))[0] || '';
  } catch {
    return '';
  }
}

function herkomsten(env) {
  return [...HERKOMSTEN, ...String(env.APP_ORIGINS || '').split(',').map(v => v.trim().replace(/\/$/, '')).filter(Boolean)];
}

export async function behandel(verzoek, env = {}, fetch = globalThis.fetch) {
  const herkomst = verzoek.headers.get('origin') || '';
  const toegestaan = herkomsten(env).includes(herkomst);
  const kop = { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', Vary: 'Origin' };
  if (toegestaan) {
    Object.assign(kop, {
      'Access-Control-Allow-Origin': herkomst,
      'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
    });
  }
  const antwoord = (status, body) => new Response(status === 204 ? null : JSON.stringify(body), { status, headers: kop });

  if (!toegestaan) return antwoord(403, { error: 'Herkomst niet toegestaan.' });
  if (verzoek.method === 'OPTIONS') return antwoord(204);
  if (verzoek.method !== 'POST') return antwoord(405, { error: 'Alleen POST.' });

  const token = (/^Bearer\s+(\S+)$/i.exec(verzoek.headers.get('authorization') || '') || [])[1];
  if (!token) return antwoord(401, { error: 'Log eerst in.' });
  const apikey = verzoek.headers.get('apikey') || env.SUPABASE_ANON_KEY || publiekeSleutel(env);
  if (!env.SUPABASE_URL || !apikey) return antwoord(500, { error: 'De functie mist de Supabase-instellingen.' });

  let invoer;
  try {
    invoer = await verzoek.json();
  } catch {
    return antwoord(400, { error: 'Ongeldige aanvraag.' });
  }
  const postId = String(invoer.post || '');
  const gevraagd = Array.isArray(invoer.kanalen) ? [...new Set(invoer.kanalen.map(String))] : [];
  if (!UUID.test(postId)) return antwoord(400, { error: 'Ongeldige aanvraag.' });

  const db = maakDb({ url: env.SUPABASE_URL, apikey, token, fetch });
  let post;
  try {
    post = await db.pak(postId, gevraagd);
  } catch (fout) {
    return antwoord(fout.status || 502, { error: fout.message });
  }

  // Vanaf hier houdt deze aanroep de post vast. Elke uitweg laat hem weer los.
  const stand = structuredClone(post.plaatsen_stand || {});
  const kanalen = (stand.kanalen || gevraagd).filter(k => PLATFORMS[k]);
  const uitkomst = {};
  const fouten = [];
  let wachten = false;
  const bewaarStand = async () => { post = await db.bewaar(postId, { p_stand: stand }); };
  const loslaten = async (status, bericht) => {
    try {
      post = await db.bewaar(postId, { p_stand: stand, ...uitkomst, p_fout: bericht, p_loslaten: true });
    } catch (fout) {
      console.error('Loslaten mislukt:', fout.message);
    }
    return antwoord(status, { error: bericht, post });
  };

  try {
    const merk = MERKEN[post.merk];
    const paginaToken = String((merk && env[merk.token]) || '').trim();
    if (!merk || !paginaToken) return await loslaten(400, `Voor ${merk ? merk.naam : 'dit merk'} is nog geen koppeling met Meta.`);

    const nog = kanalen.filter(k => !klaarOp(post, stand, k));
    const vooraf = [];
    if (nog.includes('facebook') && !merk.facebook) vooraf.push(`Facebook: ${merk.naam} heeft geen eigen Facebook-pagina in de app.`);
    for (const k of nog) for (const b of bezwaren(post, k)) vooraf.push(`${PLATFORMS[k]}: ${b}`);
    if (post.media.some(m => !String(m.pad || '').startsWith(`${postId}/`) || String(m.pad).includes('..'))) {
      vooraf.push('Een bestand hoort niet bij deze post. Zet de beelden opnieuw klaar.');
    }
    if (vooraf.length) return await loslaten(400, [...new Set(vooraf)].join(' '));

    const links = await Promise.all(post.media.map(m => db.link(m.pad)));
    const meta = { token: paginaToken, fetch };
    const { paginaId, igId } = await pagina(meta);

    if (nog.includes('instagram')) {
      try {
        if (!igId) throw new MetaFout('Aan deze Facebook-pagina hangt geen zakelijk Instagram-account.');
        const stap = await stapInstagram({ meta, igId, post, links, stand, bewaarStand });
        if (stap.wachten) wachten = true;
        if (stap.ig_media_id) {
          Object.assign(uitkomst, { p_ig_media_id: stap.ig_media_id, p_ig_link: stap.ig_link });
          // Direct vastleggen: zo gaat hij bij een hapering daarna nooit twee keer online.
          post = await db.bewaar(postId, { p_stand: stand, ...uitkomst });
        }
      } catch (fout) {
        if (fout instanceof Weigering) throw fout;
        if (fout.opnieuw) delete stand.instagram;
        fouten.push(`Instagram: ${zin(fout.message)}`);
      }
    }

    if (nog.includes('facebook')) {
      try {
        const stap = await stapFacebook({ meta, paginaId, post, links });
        uitkomst.p_fb_post_id = stap.fb_post_id;
        post = await db.bewaar(postId, { p_stand: stand, ...uitkomst });
      } catch (fout) {
        if (fout instanceof Weigering) throw fout;
        fouten.push(`Facebook: ${zin(fout.message)}`);
      }
    }

    if (fouten.length) {
      const al = kanalen.filter(k => klaarOp(post, stand, k)).map(k => PLATFORMS[k]);
      const extra = al.length ? ` ${al.join(' en ')} staat al online; opnieuw proberen doet alleen de rest.` : '';
      return await loslaten(502, `${fouten.join(' ')}${extra}`);
    }

    if (kanalen.every(k => klaarOp(post, stand, k))) {
      post = await db.bewaar(postId, { p_stand: stand, ...uitkomst, p_klaar: true });
      return antwoord(200, { klaar: true, post });
    }

    post = await db.bewaar(postId, { p_stand: stand, ...uitkomst, p_loslaten: true });
    return antwoord(200, {
      klaar: false,
      wachten,
      opnieuwOver: OPNIEUW_OVER,
      melding: 'Instagram verwerkt het beeld nog. Even geduld.',
      post,
    });
  } catch (fout) {
    console.error('Plaatsen mislukt:', fout.message);
    return loslaten(fout.status || 502, fout instanceof Weigering || fout instanceof MetaFout
      ? fout.message
      : `Er ging iets mis: ${fout.message}`);
  }
}
