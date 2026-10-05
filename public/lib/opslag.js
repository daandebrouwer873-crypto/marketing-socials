// Gegevenslaag: Supabase in het echt, of een demo die alleen in deze browser bewaart.
import { maandagVan, plusDagen, vandaag, vorigeMaand, maandStart } from './logica.js';

const SUPABASE_JS = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.57.4/dist/umd/supabase.min.js';

function laadScript(src) {
  return new Promise((ok, fout) => {
    const s = document.createElement('script');
    s.src = src;
    s.onload = ok;
    s.onerror = () => fout(new Error('Kon de inlogmodule niet laden. Check je internet.'));
    document.head.appendChild(s);
  });
}

function vertaalFout(error) {
  const tekst = String((error && (error.message || error.error_description)) || error || '');
  if (/Invalid login credentials/i.test(tekst)) return 'E-mail of wachtwoord klopt niet.';
  if (/Email not confirmed/i.test(tekst)) return 'Bevestig eerst je e-mailadres via de mail die je kreeg.';
  if (/row-level security/i.test(tekst)) return 'Dit account hoort niet bij het team.';
  if (/Failed to fetch|NetworkError/i.test(tekst)) return 'Geen verbinding. Check je internet.';
  if (/Password should be/i.test(tekst)) return 'Kies een wachtwoord van minstens 8 tekens.';
  if (/already registered|already been registered/i.test(tekst)) return 'Er is al een account met dit adres. Log in, of kies "Wachtwoord vergeten".';
  if (/rate limit|only request this after/i.test(tekst)) return 'Even geduld: probeer het over een paar minuten opnieuw.';
  return tekst || 'Er ging iets mis.';
}

function ok({ data, error }) {
  if (error) throw new Error(vertaalFout(error));
  return data;
}

// ---------------------------------------------------------------------------

class SupabaseOpslag {
  constructor(config) {
    this.config = config;
    this.demo = false;
  }

  async start(opAuth) {
    // Uitnodigings- en herstellinks komen binnen met type=invite of type=recovery in de url.
    // Lees dat vóór Supabase de url opruimt.
    const type = new URLSearchParams(location.hash.slice(1)).get('type');
    if (!window.supabase) await laadScript(SUPABASE_JS);
    this.sb = window.supabase.createClient(this.config.supabaseUrl, this.config.supabaseAnonKey, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
    });
    this.sb.auth.onAuthStateChange(gebeurtenis => {
      if (gebeurtenis === 'PASSWORD_RECOVERY') opAuth('wachtwoord');
    });
    return type === 'invite' || type === 'recovery' ? 'wachtwoord' : null;
  }

  async sessie() {
    const { data } = await this.sb.auth.getSession();
    const email = data.session && data.session.user && data.session.user.email;
    if (!email) return null;
    const lid = ok(await this.sb.from('teamleden').select('email,naam,rol').eq('email', email.toLowerCase()).maybeSingle());
    if (!lid) {
      await this.sb.auth.signOut();
      throw new Error('Dit account hoort niet bij het team. Vraag Daan om je toe te voegen.');
    }
    this.email = lid.email;
    return lid;
  }

  async inloggen(email, wachtwoord) {
    ok(await this.sb.auth.signInWithPassword({ email: email.trim(), password: wachtwoord }));
    return this.sessie();
  }

  // Zelf een account maken. Toegang krijg je pas als je e-mailadres op de teamlijst staat:
  // dat bewaakt de database, niet dit formulier.
  async accountMaken(email, wachtwoord) {
    const data = ok(await this.sb.auth.signUp({
      email: email.trim(),
      password: wachtwoord,
      options: { emailRedirectTo: location.origin + location.pathname },
    }));
    return data.session ? this.sessie() : null;
  }

  async wachtwoordVergeten(email) {
    ok(await this.sb.auth.resetPasswordForEmail(email.trim(), { redirectTo: location.origin + location.pathname }));
  }

  async nieuwWachtwoord(wachtwoord) {
    ok(await this.sb.auth.updateUser({ password: wachtwoord }));
    history.replaceState(null, '', location.pathname + '#vandaag');
  }

  async uitloggen() {
    await this.sb.auth.signOut();
  }

  async token() {
    const { data } = await this.sb.auth.getSession();
    return data.session ? data.session.access_token : null;
  }

  async team() {
    return ok(await this.sb.from('teamleden').select('email,naam,rol').eq('actief', true).order('naam'));
  }

  async taken() {
    const grens = plusDagen(maandagVan(vandaag()), -7 * 10);
    return ok(await this.sb.from('weektaken').select('*').or(`week_start.gte.${grens},status.eq.open`).order('created_at'));
  }

  async taakToevoegen(taak) {
    return ok(await this.sb.from('weektaken').insert(taak).select().single());
  }

  async taakBijwerken(id, velden) {
    return ok(await this.sb.from('weektaken').update(velden).eq('id', id).select().single());
  }

  async taakVerwijderen(id) {
    ok(await this.sb.from('weektaken').delete().eq('id', id));
  }

  async posts() {
    const van = plusDagen(maandagVan(vandaag()), -7 * 6);
    return ok(await this.sb.from('posts').select('*').gte('datum', van).order('datum').order('created_at'));
  }

  async postOpslaan(post) {
    const { id, ...velden } = post;
    delete velden.created_at;
    delete velden.updated_at;
    delete velden.aangemaakt_door;
    delete velden.tekst_door;
    if (id) return ok(await this.sb.from('posts').update(velden).eq('id', id).select().single());
    return ok(await this.sb.from('posts').insert(velden).select().single());
  }

  async postVerwijderen(id) {
    ok(await this.sb.from('posts').delete().eq('id', id));
  }

  async checks(email) {
    const van = plusDagen(vandaag(), -120);
    return ok(await this.sb.from('routine_checks').select('datum,routine,email').eq('email', email).gte('datum', van));
  }

  async check(datum, routine, aan) {
    if (aan) ok(await this.sb.from('routine_checks').insert({ datum, routine }));
    else ok(await this.sb.from('routine_checks').delete().match({ datum, routine, email: this.email }));
  }

  async metingen() {
    return ok(await this.sb.from('metingen').select('metric,periode_start,waarde,ingevuld_door,updated_at').order('periode_start'));
  }

  async metingOpslaan(metric, periode_start, waarde) {
    if (waarde === null) {
      ok(await this.sb.from('metingen').delete().match({ metric, periode_start }));
      return;
    }
    ok(await this.sb.from('metingen').upsert({ metric, periode_start, waarde }, { onConflict: 'metric,periode_start' }));
  }

  async doelen() {
    return ok(await this.sb.from('doelen').select('*').order('volgorde'));
  }

  async doelOpslaan(metric, velden) {
    return ok(await this.sb.from('doelen').update(velden).eq('metric', metric).select().single());
  }

  async uploads() {
    return ok(await this.sb.from('uploads').select('*').order('created_at', { ascending: false }).limit(40));
  }

  async uploadVastleggen(rij) {
    return ok(await this.sb.from('uploads').insert(rij).select().single());
  }

  async startUpload(gegevens) {
    const token = await this.token();
    const antwoord = await fetch('/.netlify/functions/drive-upload', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify(gegevens),
    });
    const data = await antwoord.json().catch(() => ({}));
    if (!antwoord.ok) throw new Error(data.error || 'Upload starten mislukt.');
    return data;
  }

  async memoOpslaan(postId, blob) {
    const ext = /mp4|m4a|aac/.test(blob.type) ? 'm4a' : /ogg/.test(blob.type) ? 'ogg' : 'webm';
    const pad = `${postId}/${Date.now()}.${ext}`;
    ok(await this.sb.storage.from('spraakmemos').upload(pad, blob, { contentType: blob.type || 'audio/webm' }));
    return pad;
  }

  async memoUrl(pad) {
    const data = ok(await this.sb.storage.from('spraakmemos').createSignedUrl(pad, 60 * 30));
    return data.signedUrl;
  }
}

// ---------------------------------------------------------------------------
// Demo: voorbeeldgegevens in localStorage, geen server nodig.

const DEMO_SLEUTEL = 'pellens-marketing-demo-v1';
const DEMO_TEAM = [
  { email: 'daan@demo', naam: 'Daan', rol: 'eigenaar' },
  { email: 'mila@demo', naam: 'Mila', rol: 'social' },
  { email: 'beau@demo', naam: 'Beau', rol: 'manager' },
];

function uuid() {
  return (crypto.randomUUID && crypto.randomUUID()) || `id-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function demoStart() {
  const nu = vandaag();
  const ma = maandagVan(nu);
  const vorige = plusDagen(ma, -7);
  const t = new Date().toISOString();
  const post = (dag, velden) => ({
    id: uuid(), datum: plusDagen(ma, dag), merk: 'pellens', thema: 'vuur', tekst: null, tekst_door: null,
    tekst_goedgekeurd: false, spraakmemo_pad: null, beeld: [], status: 'tekst_nodig',
    aangemaakt_door: 'mila@demo', created_at: t, updated_at: t, ...velden,
  });
  const meting = (metric, periode_start, waarde) => ({ metric, periode_start, waarde, ingevuld_door: 'mila@demo', updated_at: t });
  const weken = [-5, -4, -3, -2, -1].map(n => plusDagen(ma, 7 * n));
  return {
    taken: [
      { id: uuid(), titel: 'Nulmeting: volgers, reviews en Google-profiel', eigenaar: 'mila@demo', minimumversie: 'Alleen de volgers en het aantal reviews', klaar_wanneer: 'De stand van 1 oktober staat in de app', week_start: ma, status: 'open', created_at: t },
      { id: uuid(), titel: 'Lunch Les Brioches op Google en Instagram', eigenaar: 'daan@demo', minimumversie: 'Openingstijden lunch op Google', klaar_wanneer: 'Lunch staat op Google, in de bio en op de site', week_start: ma, status: 'open', created_at: t },
      { id: uuid(), titel: 'Reviewkaartjes bij de koffie', eigenaar: 'beau@demo', minimumversie: 'Kaartjes liggen klaar bij de pas', klaar_wanneer: 'Beau en Frits weten wanneer wel en niet', week_start: vorige, status: 'af', afgerond_op: t, created_at: t },
    ],
    posts: [
      post(2, { kanaal: 'reel', thema: 'vuur', idee: 'Houtduif op de grill, van dichtbij. 15 seconden, eindigt op het bord.', beeld: [{ naam: '2026-09-11_Sabine_clip-14.mp4' }] }),
      post(3, { kanaal: 'carrousel', thema: 'tafel', idee: 'Het najaarsmenu in vijf borden: hamachi, wijting, langoustine, houtduif, peer.', tekst: 'Zeven gangen van het land en het vuur. Dit is de herfst bij Pellens, tot half november.', tekst_door: 'daan@demo', tekst_goedgekeurd: true, status: 'tekst_klaar' }),
      post(4, { kanaal: 'story', thema: 'mensen', idee: 'Jonas aan de mise-en-place, wie staat er vanavond.' }),
      post(5, { kanaal: 'reel', merk: 'brouwerij', thema: 'land', idee: 'Kombucha van eigen oogst: van fles tot glas naast het menu.' }),
      post(5, { kanaal: 'google', thema: 'boeken', idee: 'Lunch Les Brioches, vrijdag tot en met zondag.', tekst: 'Vanaf vrijdag weer lunch: Les Brioches, van eigen akker.', tekst_door: 'daan@demo', tekst_goedgekeurd: true, status: 'ingepland' }),
      post(-3, { kanaal: 'reel', thema: 'land', idee: 'Oogst op De Vloeiweide', tekst: 'Vanochtend geoogst, vanavond op het vuur.', tekst_door: 'daan@demo', tekst_goedgekeurd: true, status: 'geplaatst' }),
    ],
    checks: [],
    metingen: [
      ...weken.map((w, i) => meting('ig_volgers_pellens', w, 3769 + i * 46)),
      ...weken.map((w, i) => meting('gasten_diner', w, [27, 31, 29, 30, 32][i])),
      ...weken.map((w, i) => meting('gasten_lunch', w, [6, 9, 8, 11, 12][i])),
      meting('google_reviews', vorigeMaand(nu), 241),
      meting('google_reviews', maandStart(vorigeMaand(vorigeMaand(nu))), 236),
    ],
    doelen: [
      { metric: 'gasten_diner', label: 'Gasten per diner', start_waarde: 31, doel_december: 33, doel_maart: 35, volgorde: 1 },
      { metric: 'gasten_lunch', label: 'Gasten per lunch', start_waarde: 9, doel_december: 15, doel_maart: 27, volgorde: 2 },
      { metric: 'ig_volgers_pellens', label: 'Instagram-volgers Pellens', start_waarde: 3769, doel_december: 4800, doel_maart: 6000, volgorde: 3 },
      { metric: 'ig_volgers_brouwerij', label: 'Instagram-volgers Brouwerij', start_waarde: null, doel_december: null, doel_maart: null, volgorde: 4 },
      { metric: 'google_reviews', label: 'Google-reviews', start_waarde: 232, doel_december: 275, doel_maart: 320, volgorde: 5 },
      { metric: 'emailadressen', label: 'E-mailadressen van gasten', start_waarde: 0, doel_december: 150, doel_maart: 400, volgorde: 6 },
    ],
    uploads: [
      { id: uuid(), drive_file_id: 'demo', naam: `${vandaag()}_Mila_Vuur-en-grill_IMG-2210.jpg`, onderwerp: 'vuur', mime: 'image/jpeg', grootte: 2400000, link: null, email: 'mila@demo', created_at: t },
      { id: uuid(), drive_file_id: 'demo', naam: `${vandaag()}_Beau_Nieuw-te-sorteren_IMG-0042.jpg`, onderwerp: 'nieuw', mime: 'image/jpeg', grootte: 1900000, link: null, email: 'beau@demo', created_at: t },
    ],
  };
}

class DemoOpslag {
  constructor() {
    this.demo = true;
    try {
      this.data = JSON.parse(localStorage.getItem(DEMO_SLEUTEL)) || demoStart();
    } catch {
      this.data = demoStart();
    }
    this.wie = (() => { try { return localStorage.getItem(`${DEMO_SLEUTEL}-wie`); } catch { return null; } })();
  }

  bewaar() {
    try { localStorage.setItem(DEMO_SLEUTEL, JSON.stringify(this.data)); } catch { /* privémodus */ }
  }

  async start() { return null; }

  async sessie() {
    return DEMO_TEAM.find(l => l.email === this.wie) || null;
  }

  async inloggen(email) {
    const lid = DEMO_TEAM.find(l => l.email === email) || DEMO_TEAM[1];
    this.wie = lid.email;
    try { localStorage.setItem(`${DEMO_SLEUTEL}-wie`, lid.email); } catch { /* privémodus */ }
    return lid;
  }

  async accountMaken(email) { return this.inloggen(email); }
  async wachtwoordVergeten() {}
  async nieuwWachtwoord() {}

  async uitloggen() {
    this.wie = null;
    try { localStorage.removeItem(`${DEMO_SLEUTEL}-wie`); } catch { /* privémodus */ }
  }

  reset() {
    this.data = demoStart();
    this.bewaar();
  }

  async team() { return DEMO_TEAM; }
  async taken() { return structuredClone(this.data.taken); }

  async taakToevoegen(taak) {
    const bezet = this.data.taken.filter(t => t.week_start === taak.week_start || (t.status === 'open' && t.week_start < taak.week_start)).length;
    if (bezet >= 3) throw new Error('Deze week zit vol: maximaal drie taken, en wat nog openstaat schuift door.');
    const rij = { id: uuid(), status: 'open', created_at: new Date().toISOString(), aangemaakt_door: this.wie, ...taak };
    this.data.taken.push(rij);
    this.bewaar();
    return rij;
  }

  async taakBijwerken(id, velden) {
    const taak = this.data.taken.find(t => t.id === id);
    Object.assign(taak, velden, velden.status === 'af' ? { afgerond_op: new Date().toISOString() } : {});
    this.bewaar();
    return taak;
  }

  async taakVerwijderen(id) {
    this.data.taken = this.data.taken.filter(t => t.id !== id);
    this.bewaar();
  }

  async posts() { return structuredClone(this.data.posts).sort((a, b) => a.datum.localeCompare(b.datum)); }

  async postOpslaan(post) {
    const lid = DEMO_TEAM.find(l => l.email === this.wie);
    const oud = post.id ? this.data.posts.find(p => p.id === post.id) : null;
    const nieuw = { ...(oud || { id: uuid(), created_at: new Date().toISOString(), aangemaakt_door: this.wie, beeld: [], tekst_goedgekeurd: false, status: 'tekst_nodig' }), ...post };
    if (nieuw.tekst_goedgekeurd && !(oud && oud.tekst_goedgekeurd) && lid.rol !== 'eigenaar') throw new Error('Alleen de eigenaar keurt teksten goed.');
    if ((oud ? oud.tekst : null) !== nieuw.tekst) {
      nieuw.tekst_door = this.wie;
      if (!(nieuw.tekst_goedgekeurd && lid.rol === 'eigenaar')) nieuw.tekst_goedgekeurd = false;
    }
    if (nieuw.tekst_goedgekeurd && !String(nieuw.tekst || '').trim()) throw new Error('Er is nog geen tekst om goed te keuren.');
    if (nieuw.tekst_goedgekeurd && ['idee', 'tekst_nodig'].includes(nieuw.status)) nieuw.status = 'tekst_klaar';
    if (!nieuw.tekst_goedgekeurd && nieuw.status === 'tekst_klaar') nieuw.status = 'tekst_nodig';
    nieuw.updated_at = new Date().toISOString();
    if (oud) Object.assign(oud, nieuw); else this.data.posts.push(nieuw);
    this.bewaar();
    return nieuw;
  }

  async postVerwijderen(id) {
    this.data.posts = this.data.posts.filter(p => p.id !== id);
    this.bewaar();
  }

  async checks(email) { return this.data.checks.filter(c => c.email === email); }

  async check(datum, routine, aan) {
    this.data.checks = this.data.checks.filter(c => !(c.datum === datum && c.routine === routine && c.email === this.wie));
    if (aan) this.data.checks.push({ datum, routine, email: this.wie });
    this.bewaar();
  }

  async metingen() { return structuredClone(this.data.metingen); }

  async metingOpslaan(metric, periode_start, waarde) {
    this.data.metingen = this.data.metingen.filter(m => !(m.metric === metric && m.periode_start === periode_start));
    if (waarde !== null) this.data.metingen.push({ metric, periode_start, waarde, ingevuld_door: this.wie, updated_at: new Date().toISOString() });
    this.bewaar();
  }

  async doelen() { return structuredClone(this.data.doelen); }

  async doelOpslaan(metric, velden) {
    const doel = this.data.doelen.find(d => d.metric === metric);
    Object.assign(doel, velden);
    this.bewaar();
    return doel;
  }

  async uploads() { return structuredClone(this.data.uploads).sort((a, b) => b.created_at.localeCompare(a.created_at)); }

  async uploadVastleggen(rij) {
    const nieuw = { id: uuid(), email: this.wie, created_at: new Date().toISOString(), ...rij };
    this.data.uploads.unshift(nieuw);
    this.bewaar();
    return nieuw;
  }

  async startUpload() { return { uploadUrl: 'demo:', bestandsnaam: null }; }

  async memoOpslaan(postId, blob) {
    this.memos = this.memos || new Map();
    const pad = `${postId}/${Date.now()}`;
    this.memos.set(pad, URL.createObjectURL(blob));
    return pad;
  }

  async memoUrl(pad) {
    return (this.memos && this.memos.get(pad)) || null;
  }
}

export function maakOpslag(config) {
  const demoGevraagd = new URLSearchParams(location.search).has('demo');
  return config.demo || demoGevraagd ? new DemoOpslag() : new SupabaseOpslag(config);
}

export { DEMO_TEAM };
