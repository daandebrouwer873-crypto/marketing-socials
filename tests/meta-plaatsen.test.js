import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { behandel } from '../supabase/functions/marketing-plaatsen/plaatsen.js';
import { bezwaren, platformsVoor } from '../supabase/functions/marketing-plaatsen/regels.js';

const POST_ID = '11111111-2222-4333-8444-555555555555';
const HERKOMST = 'https://daandebrouwer873-crypto.github.io';
const ENV = { SUPABASE_URL: 'https://proj.supabase.co', META_TOKEN_PELLENS: 'pagina-token' };
const GRAPH = 'https://graph.facebook.com/v26.0/';

let rij;
let aanroepen;
let meta;

const foto = (n, extra = {}) => ({ pad: `${POST_ID}/${n}.jpg`, soort: 'foto', mime: 'image/jpeg', grootte: 2_000_000, breedte: 1080, hoogte: 1350, ...extra });
const video = (extra = {}) => ({ pad: `${POST_ID}/reel.mp4`, soort: 'video', mime: 'video/mp4', grootte: 40_000_000, breedte: 1080, hoogte: 1920, duur: 24, ...extra });

function maakPost(velden = {}) {
  rij = {
    id: POST_ID, merk: 'pellens', kanaal: 'foto', status: 'tekst_klaar', tekst_goedgekeurd: true,
    tekst: 'Het najaarsmenu staat. Dit is waar het begint.', media: [foto(1)],
    ig_media_id: null, ig_link: null, fb_post_id: null, geplaatst_op: null, geplaatst_door: null,
    plaatsen_stand: null, plaatsen_fout: null, bezig: false, ...velden,
  };
}

beforeEach(() => {
  aanroepen = [];
  maakPost();
  meta = {
    containers: new Map(),
    volgende: 0,
    // Per container hoe vaak Meta nog IN_PROGRESS zegt.
    verwerken: 0,
    gebruikt: 3,
    fouten: {},
  };
  globalThis.fetch = nepFetch;
});

function antwoord(status, body) {
  return Response.json(body, { status });
}

function velden(opties) {
  return Object.fromEntries(new URLSearchParams(String(opties.body || '')));
}

async function nepFetch(url, opties = {}) {
  const adres = String(url);
  const kop = opties.headers || {};
  aanroepen.push({ adres, opties, velden: opties.body instanceof URLSearchParams ? velden(opties) : null });

  // --- Supabase: database-functies en opslag, met de inlog van de gebruiker ---
  if (adres.startsWith('https://proj.supabase.co/')) {
    assert.equal(kop.apikey, 'sb_publishable_test');
    const eigenaar = kop.Authorization === 'Bearer jwt-daan';
    const body = JSON.parse(opties.body || '{}');
    const weiger = message => antwoord(400, { code: 'P0001', message });

    if (adres.endsWith('/rest/v1/rpc/marketing_plaatsen_pak')) {
      if (!eigenaar) return weiger('Alleen de eigenaar plaatst posts.');
      if (rij.status === 'geplaatst') return weiger('Deze post staat al online.');
      if (rij.bezig) return weiger('Deze post wordt op dit moment al geplaatst. Even geduld.');
      Object.assign(rij, { bezig: true, plaatsen_fout: null, plaatsen_stand: { ...(rij.plaatsen_stand || {}), kanalen: body.p_kanalen } });
      return antwoord(200, structuredClone(rij));
    }
    if (adres.endsWith('/rest/v1/rpc/marketing_plaatsen_bewaar')) {
      if (!eigenaar) return weiger('Alleen de eigenaar plaatst posts.');
      if (!rij.bezig) return weiger('Deze post is niet aan het plaatsen. Druk opnieuw op Plaatsen.');
      rij.plaatsen_stand = body.p_stand ?? rij.plaatsen_stand;
      rij.ig_media_id ??= body.p_ig_media_id ?? null;
      rij.ig_link ??= body.p_ig_link ?? null;
      rij.fb_post_id ??= body.p_fb_post_id ?? null;
      rij.plaatsen_fout = body.p_fout ?? null;
      if (body.p_klaar) Object.assign(rij, { status: 'geplaatst', geplaatst_op: '2026-10-16T10:00:00Z', geplaatst_door: 'daan@test.nl' });
      if (body.p_klaar || body.p_loslaten) rij.bezig = false;
      return antwoord(200, structuredClone(rij));
    }
    const sign = /\/storage\/v1\/object\/sign\/marketing-plaatsen\/(.+)$/.exec(adres);
    if (sign) {
      assert.equal(body.expiresIn, 3600);
      return antwoord(200, { signedURL: `/object/sign/marketing-plaatsen/${sign[1]}?token=t${sign[1].split('/').pop()}` });
    }
    throw new Error(`onverwacht Supabase-adres ${adres}`);
  }

  // --- Meta ---
  assert.ok(!adres.includes('pagina-token'), 'het token staat nooit in een adres');
  if (adres.startsWith('https://rupload.facebook.com/')) {
    assert.equal(kop.Authorization, 'OAuth pagina-token');
    assert.match(kop.file_url, /^https:\/\/proj\.supabase\.co\/storage\/v1\/object\/sign\/marketing-plaatsen\//);
    return antwoord(200, { success: true });
  }
  assert.equal(kop.Authorization, 'Bearer pagina-token');
  const pad = adres.replace(GRAPH, '').replace('https://graph-video.facebook.com/v26.0/', '').split('?')[0];
  const v = velden(opties);
  const fout = meta.fouten[pad];
  if (fout) return antwoord(400, { error: fout });

  if (pad === 'me') return antwoord(200, { id: '168', name: 'Pellens', instagram_business_account: { id: '1784' } });
  if (pad === '1784/media') {
    const id = `c${++meta.volgende}`;
    meta.containers.set(id, { velden: v, nog: v.media_type === 'REELS' || v.media_type === 'VIDEO' ? meta.verwerken : 0, status: 'FINISHED' });
    return antwoord(200, { id });
  }
  if (meta.containers.has(pad)) {
    const c = meta.containers.get(pad);
    if (c.nog > 0) {
      c.nog -= 1;
      return antwoord(200, { status_code: 'IN_PROGRESS', id: pad });
    }
    return antwoord(200, { status_code: c.status, status: c.status === 'ERROR' ? 'Error: Media upload has failed with error code 2207026' : undefined, id: pad });
  }
  if (pad === '1784/content_publishing_limit') return antwoord(200, { data: [{ quota_usage: meta.gebruikt, config: { quota_total: 100 } }] });
  if (pad === '1784/media_publish') {
    meta.containers.get(v.creation_id).status = 'PUBLISHED';
    return antwoord(200, { id: '17900001' });
  }
  if (pad === '17900001') return antwoord(200, { permalink: 'https://www.instagram.com/p/DPellens/' });
  if (pad === '168/photos') return antwoord(200, v.published === 'false' ? { id: `ph${++meta.volgende}` } : { id: 'ph1', post_id: '168_901' });
  if (pad === '168/feed') return antwoord(200, { id: '168_902' });
  if (pad === '168/video_reels' || pad === '168/video_stories') {
    if (v.upload_phase === 'start') return antwoord(200, { video_id: 'vid7', upload_url: 'https://rupload.facebook.com/video-upload/v26.0/vid7' });
    return antwoord(200, pad.endsWith('stories') ? { success: true, post_id: '168_903' } : { success: true });
  }
  if (pad === '168/photo_stories') return antwoord(200, { success: true, post_id: '168_904' });
  if (pad === '168/videos') return antwoord(200, { id: 'vid8' });
  throw new Error(`onverwacht Meta-adres ${adres}`);
}

function verzoek({ body = { post: POST_ID, kanalen: ['instagram', 'facebook'] }, jwt = 'jwt-daan', herkomst = HERKOMST, methode = 'POST' } = {}) {
  const headers = { 'content-type': 'application/json', apikey: 'sb_publishable_test' };
  if (herkomst) headers.origin = herkomst;
  if (jwt) headers.authorization = `Bearer ${jwt}`;
  return new Request('https://proj.supabase.co/functions/v1/marketing-plaatsen', {
    method: methode, headers, body: methode === 'POST' ? JSON.stringify(body) : undefined,
  });
}

async function plaats(opties, env = ENV) {
  const res = await behandel(verzoek(opties), env, nepFetch);
  return { status: res.status, data: res.status === 204 ? null : await res.json(), headers: res.headers };
}

const metaAanroepen = () => aanroepen.filter(a => /facebook\.com/.test(a.adres));
const naar = deel => aanroepen.filter(a => a.adres.includes(deel));
const containers = () => aanroepen.filter(a => a.adres.endsWith('/1784/media'));

// ---------------------------------------------------------------------------

test('een andere herkomst of geen inlog komt er niet in', async () => {
  const vreemd = await plaats({ herkomst: 'https://kwaadaardig.example' });
  assert.equal(vreemd.status, 403);
  const zonder = await plaats({ jwt: null });
  assert.equal(zonder.status, 401);
  assert.equal(aanroepen.length, 0);

  const voorcontrole = await plaats({ methode: 'OPTIONS' });
  assert.equal(voorcontrole.status, 204);
  assert.equal(voorcontrole.headers.get('access-control-allow-origin'), HERKOMST);
  assert.match(voorcontrole.headers.get('access-control-allow-headers'), /apikey/);
});

test('alleen de eigenaar plaatst: de database weigert Mila', async () => {
  const { status, data } = await plaats({ jwt: 'jwt-mila' });
  assert.equal(status, 409);
  assert.match(data.error, /Alleen de eigenaar/);
  assert.equal(metaAanroepen().length, 0);
});

test('fotopost gaat op Instagram en Facebook, met de goedgekeurde tekst', async () => {
  const { status, data } = await plaats();
  assert.equal(status, 200);
  assert.equal(data.klaar, true);
  assert.equal(data.post.status, 'geplaatst');
  assert.equal(data.post.ig_media_id, '17900001');
  assert.equal(data.post.ig_link, 'https://www.instagram.com/p/DPellens/');
  assert.equal(data.post.fb_post_id, '168_901');
  assert.equal(rij.bezig, false, 'de post is weer losgelaten');

  const [container] = containers().map(a => a.velden);
  assert.equal(container.caption, rij.tekst);
  assert.equal(container.image_url, `https://proj.supabase.co/storage/v1/object/sign/marketing-plaatsen/${POST_ID}/1.jpg?token=t1.jpg`);
  assert.equal(naar('media_publish')[0].velden.creation_id, 'c1');
  const fb = naar('168/photos')[0].velden;
  assert.equal(fb.caption, rij.tekst);
  assert.equal(fb.url, container.image_url);
  for (const a of metaAanroepen()) assert.ok(!String(a.opties.body || '').includes('pagina-token'), 'het token staat niet in een formulier');
});

test('carrousel: losse onderdelen, dan één carrousel; op Facebook één post met alle foto\'s', async () => {
  maakPost({ kanaal: 'carrousel', media: [foto(1), foto(2), foto(3)] });
  const { data } = await plaats();
  assert.equal(data.klaar, true);

  const onderdelen = containers().map(a => a.velden);
  assert.deepEqual(onderdelen.slice(0, 3).map(v => v.is_carousel_item), ['true', 'true', 'true']);
  assert.ok(onderdelen.slice(0, 3).every(v => !v.caption), 'onderdelen hebben geen tekst');
  assert.deepEqual(onderdelen[3], { media_type: 'CAROUSEL', children: 'c1,c2,c3', caption: rij.tekst });
  assert.equal(naar('media_publish')[0].velden.creation_id, 'c4');

  const fotos = naar('168/photos').map(a => a.velden);
  assert.deepEqual(fotos.map(v => v.published), ['false', 'false', 'false']);
  const feed = naar('168/feed')[0].velden;
  assert.equal(feed.message, rij.tekst);
  assert.deepEqual(JSON.parse(feed['attached_media[2]']), { media_fbid: 'ph7' });
  assert.equal(data.post.fb_post_id, '168_902');
});

test('reel: Facebook direct, Instagram wacht tot de video verwerkt is', async () => {
  maakPost({ kanaal: 'reel', media: [video()] });
  meta.verwerken = 1;

  const eerst = await plaats();
  assert.equal(eerst.status, 200);
  assert.equal(eerst.data.klaar, false);
  assert.equal(eerst.data.wachten, true);
  assert.ok(eerst.data.opnieuwOver > 0);
  assert.equal(eerst.data.post.fb_post_id, 'vid7');
  assert.equal(eerst.data.post.ig_media_id, null);
  assert.equal(eerst.data.post.plaatsen_stand.instagram.container, 'c1');
  assert.equal(rij.bezig, false);

  const reel = containers()[0].velden;
  assert.equal(reel.media_type, 'REELS');
  assert.equal(reel.share_to_feed, 'true');
  assert.match(reel.video_url, /reel\.mp4\?token=/);
  const fasen = naar('168/video_reels').map(a => a.velden);
  assert.deepEqual(fasen.map(v => v.upload_phase), ['start', 'finish']);
  assert.equal(fasen[1].video_state, 'PUBLISHED');
  assert.equal(fasen[1].description, rij.tekst);
  assert.equal(naar('rupload.facebook.com').length, 1);
  assert.equal(naar('media_publish').length, 0);

  aanroepen = [];
  const daarna = await plaats();
  assert.equal(daarna.data.klaar, true);
  assert.equal(daarna.data.post.status, 'geplaatst');
  assert.equal(containers().length, 0, 'geen nieuwe container');
  assert.equal(naar('168/video_reels').length, 0, 'Facebook niet nog een keer');
  assert.equal(naar('media_publish')[0].velden.creation_id, 'c1');
});

test('story: zonder tekst, op Facebook als fotostory', async () => {
  maakPost({ kanaal: 'story', media: [foto(1, { breedte: 1080, hoogte: 1920 })] });
  const { data } = await plaats();
  assert.equal(data.klaar, true);
  const story = containers()[0].velden;
  assert.equal(story.media_type, 'STORIES');
  assert.equal(story.caption, undefined);
  assert.equal(naar('168/photos')[0].velden.published, 'false');
  assert.equal(naar('168/photo_stories')[0].velden.photo_id, 'ph2');
  assert.equal(data.post.fb_post_id, '168_904');
});

test('videostory gaat via start, ophalen en afronden', async () => {
  maakPost({ kanaal: 'story', media: [video({ duur: 15 })] });
  const { data } = await plaats({ body: { post: POST_ID, kanalen: ['facebook'] } });
  assert.equal(data.klaar, true);
  assert.deepEqual(naar('168/video_stories').map(a => a.velden.upload_phase), ['start', 'finish']);
  assert.equal(data.post.fb_post_id, '168_903');
  assert.equal(containers().length, 0, 'alleen Facebook gekozen');
});

test('kanaal Facebook met video: gewone video op de pagina', async () => {
  maakPost({ kanaal: 'facebook', media: [video({ duur: 300 })] });
  const { data } = await plaats({ body: { post: POST_ID, kanalen: ['facebook'] } });
  assert.equal(data.klaar, true);
  const v = naar('graph-video.facebook.com/v26.0/168/videos')[0].velden;
  assert.match(v.file_url, /reel\.mp4\?token=/);
  assert.equal(v.description, rij.tekst);
});

test('Instagram lukt, Facebook niet: opnieuw proberen doet alleen Facebook', async () => {
  meta.fouten['168/photos'] = { message: 'Unsupported post request', code: 100 };
  const eerst = await plaats();
  assert.equal(eerst.status, 502);
  assert.match(eerst.data.error, /^Facebook: Meta weigert \(100\): Unsupported post request\./);
  assert.match(eerst.data.error, /Instagram staat al online/);
  assert.equal(rij.ig_media_id, '17900001');
  assert.equal(rij.status, 'tekst_klaar');
  assert.equal(rij.bezig, false);
  assert.match(rij.plaatsen_fout, /^Facebook:/);

  delete meta.fouten['168/photos'];
  aanroepen = [];
  const daarna = await plaats();
  assert.equal(daarna.data.klaar, true);
  assert.equal(naar('1784/').length, 0, 'Instagram niet nog een keer');
  assert.equal(daarna.data.post.fb_post_id, '168_901');
  assert.equal(daarna.data.post.plaatsen_fout, null);
});

test('stopt vooraf als Meta het toch niet zou nemen, en roept Meta dan niet aan', async () => {
  maakPost({ kanaal: 'reel', media: [video({ duur: 120 })] });
  const { status, data } = await plaats();
  assert.equal(status, 400);
  assert.equal(data.error, 'Facebook: De video mag maximaal 90 seconden duren.');
  assert.equal(metaAanroepen().length, 0);
  assert.equal(rij.bezig, false);

  // Alleen Instagram kiezen mag wel: daar is 2 minuten goed.
  const alleenIg = await plaats({ body: { post: POST_ID, kanalen: ['instagram'] } });
  assert.equal(alleenIg.data.klaar, true);
});

test('een bestand van een andere post wordt niet doorgegeven', async () => {
  maakPost({ media: [foto(1, { pad: 'andere-post/1.jpg' })] });
  const { status, data } = await plaats();
  assert.equal(status, 400);
  assert.match(data.error, /hoort niet bij deze post/);
  assert.equal(naar('/storage/').length, 0);
});

test('Brouwerij zonder token: duidelijke melding', async () => {
  maakPost({ merk: 'brouwerij' });
  const { status, data } = await plaats();
  assert.equal(status, 400);
  assert.match(data.error, /Brouwerij de Brouwer is nog geen koppeling met Meta/);
  assert.equal(rij.bezig, false);
});

test('Instagram kan de video niet verwerken: volgende keer een nieuwe container', async () => {
  maakPost({ kanaal: 'reel', media: [video()] });
  const echteFetch = nepFetch;
  const zetFout = async (url, opties) => {
    const res = await echteFetch(url, opties);
    if (String(url).endsWith('/1784/media')) meta.containers.get(`c${meta.volgende}`).status = 'ERROR';
    return res;
  };
  const eerst = await behandel(verzoek({ body: { post: POST_ID, kanalen: ['instagram'] } }), ENV, zetFout);
  const data = await eerst.json();
  assert.equal(eerst.status, 502);
  assert.match(data.error, /Instagram kon het beeld niet verwerken \(ERROR: Error: Media upload has failed with error code 2207026\)/);
  assert.equal(rij.plaatsen_stand.instagram, undefined, 'stand gewist');

  aanroepen = [];
  const daarna = await plaats({ body: { post: POST_ID, kanalen: ['instagram'] } });
  assert.equal(daarna.data.klaar, true);
  assert.equal(containers()[0].velden.media_type, 'REELS');
  assert.equal(naar('media_publish')[0].velden.creation_id, 'c2');
});

test('was de container bij een eerdere poging al gepubliceerd, dan niet nog een keer', async () => {
  maakPost({ plaatsen_stand: { kanalen: ['instagram'], instagram: { container: 'c9' } } });
  meta.containers.set('c9', { status: 'PUBLISHED', nog: 0 });
  const { data } = await plaats({ body: { post: POST_ID, kanalen: ['instagram'] } });
  assert.equal(data.klaar, true);
  assert.equal(naar('media_publish').length, 0);
  assert.equal(containers().length, 0);
});

test('verlopen token en volle daglimiet geven een duidelijke melding', async () => {
  meta.fouten.me = { message: 'Error validating access token', code: 190 };
  const verlopen = await plaats();
  assert.equal(verlopen.status, 502);
  assert.match(verlopen.data.error, /Meta-token is verlopen/);
  assert.equal(rij.bezig, false);

  delete meta.fouten.me;
  meta.gebruikt = 100;
  const vol = await plaats({ body: { post: POST_ID, kanalen: ['instagram'] } });
  assert.match(vol.data.error, /limiet van 100 posts per 24 uur/);
  assert.equal(naar('media_publish').length, 0);
});

test('regels per kanaal', () => {
  const p = (kanaal, media, tekst = 'Tekst') => ({ kanaal, media, tekst });
  assert.deepEqual(platformsVoor('reel'), ['instagram', 'facebook']);
  assert.deepEqual(platformsVoor('facebook'), ['facebook']);
  assert.deepEqual(platformsVoor('google'), []);

  assert.deepEqual(bezwaren(p('foto', [foto(1)]), 'instagram'), []);
  assert.deepEqual(bezwaren(p('foto', [foto(1, { hoogte: 1440 })]), 'instagram'), ['Een foto moet op Instagram tussen 4:5 (staand) en 1,91:1 (liggend) zijn.']);
  assert.deepEqual(bezwaren(p('foto', [foto(1, { hoogte: 1440 })]), 'facebook'), [], 'Facebook neemt ook staand');
  assert.deepEqual(bezwaren(p('foto', [foto(1, { mime: 'image/png' })]), 'instagram'), ['Instagram neemt alleen JPEG-foto\'s.']);
  assert.deepEqual(bezwaren(p('foto', [foto(1), foto(2)]), 'instagram'), ['Een fotopost heeft precies één foto.']);
  assert.deepEqual(bezwaren(p('carrousel', [foto(1)]), 'instagram'), ['Een carrousel heeft 2 tot 10 foto\'s of video\'s.']);
  assert.deepEqual(bezwaren(p('carrousel', [foto(1), video()]), 'instagram'), []);
  assert.deepEqual(bezwaren(p('carrousel', [foto(1), video()]), 'facebook'), ['Een carrousel met video kan de app niet op Facebook zetten.']);
  assert.deepEqual(bezwaren(p('reel', [video({ duur: 2 })]), 'instagram'), ['De video moet minstens 3 seconden duren.']);
  assert.deepEqual(bezwaren(p('reel', [video({ duur: 16 * 60 })]), 'instagram'), ['De video mag maximaal 15 minuten duren.']);
  assert.deepEqual(bezwaren(p('reel', [video({ grootte: 400 * 1024 * 1024 })]), 'instagram'), ['De video mag maximaal 300 MB zijn.']);
  assert.deepEqual(bezwaren(p('story', [video({ duur: 61 })]), 'facebook'), ['De video mag maximaal 60 seconden duren.']);
  assert.deepEqual(bezwaren(p('story', [foto(1, { hoogte: 1920 })]), 'instagram'), [], 'story mag 9:16');
  assert.deepEqual(bezwaren(p('facebook', [foto(1)]), 'instagram'), ['Dit kanaal is alleen Facebook.']);
  assert.deepEqual(bezwaren(p('facebook', [foto(1), video()]), 'facebook'), ['Op Facebook gaat één video of een rij foto\'s, niet allebei.']);
  assert.deepEqual(bezwaren(p('google', [foto(1)]), 'facebook'), ['Dit kanaal plaatst de app niet zelf.']);
  assert.deepEqual(bezwaren(p('foto', []), 'facebook'), ['Zet eerst de foto\'s of de video klaar.']);

  const hashtags = Array.from({ length: 31 }, (_, i) => `#tag${i}`).join(' ');
  assert.deepEqual(bezwaren(p('foto', [foto(1)], hashtags), 'instagram'), ['Instagram staat maximaal 30 hashtags toe.']);
  assert.deepEqual(bezwaren(p('foto', [foto(1)], hashtags), 'facebook'), []);
});
