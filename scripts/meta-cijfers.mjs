// Haalt elke ochtend de volgers op bij Meta (Facebook-pagina en het Instagram-account dat eraan
// hangt) en zet ze als weekcijfer in marketing_metingen. Draait in GitHub Actions
// (.github/workflows/meta-cijfers.yml). De tokens staan alleen in de GitHub-geheimen: dit script
// zet ze nergens neer en nooit in de uitvoer.
import { pathToFileURL } from 'node:url';
import { vandaag, maandagVan } from '../public/lib/logica.js';

const GRAPH = 'https://graph.facebook.com/v25.0';
const VELDEN = 'name,followers_count,instagram_business_account{username,followers_count}';

// Eén paginatoken per Facebook-pagina. Het Instagram-account dat aan die pagina hangt, komt mee.
export const BRONNEN = Object.freeze([
  { naam: 'Pellens', token: 'META_TOKEN_PELLENS', facebook: 'fb_volgers_pellens', instagram: 'ig_volgers_pellens' },
  { naam: 'Brouwerij', token: 'META_TOKEN_BROUWERIJ', facebook: null, instagram: 'ig_volgers_brouwerij' },
]);

export async function haalPagina(token) {
  const antwoord = await fetch(`${GRAPH}/me?fields=${encodeURIComponent(VELDEN)}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const data = await antwoord.json().catch(() => ({}));
  if (!antwoord.ok || data.error) {
    const fout = data.error || {};
    const verlopen = fout.code === 190 ? ' Het token is verlopen of ingetrokken: maak een nieuw paginatoken.' : '';
    throw new Error(`Meta weigert (${fout.code ?? antwoord.status}): ${fout.message ?? 'onbekende fout'}.${verlopen}`);
  }
  return data;
}

// Zet het antwoord van Meta om in rijen voor marketing_metingen, plus wat er ontbrak.
export function metingenVoor(bron, pagina, periodeStart) {
  const rijen = [];
  const missend = [];
  if (bron.facebook) {
    if (Number.isFinite(pagina.followers_count)) {
      rijen.push({ metric: bron.facebook, periode_start: periodeStart, waarde: pagina.followers_count });
    } else {
      missend.push(`${bron.naam}: Meta gaf geen Facebook-volgers. Mist het token het recht pages_read_engagement?`);
    }
  }
  if (bron.instagram) {
    const ig = pagina.instagram_business_account;
    if (ig && Number.isFinite(ig.followers_count)) {
      rijen.push({ metric: bron.instagram, periode_start: periodeStart, waarde: ig.followers_count });
    } else if (ig) {
      missend.push(`${bron.naam}: Meta gaf geen Instagram-volgers. Mist het token het recht instagram_basic?`);
    } else {
      missend.push(`${bron.naam}: aan deze Facebook-pagina hangt geen zakelijk Instagram-account.`);
    }
  }
  return { rijen, missend };
}

export async function opslaan(rijen, { url, sleutel }) {
  const headers = {
    apikey: sleutel,
    'Content-Type': 'application/json',
    Prefer: 'resolution=merge-duplicates,return=minimal',
  };
  // De oude service_role-sleutel is een JWT en moet ook als Bearer mee; de nieuwe sb_secret_ niet.
  if (!sleutel.startsWith('sb_')) headers.Authorization = `Bearer ${sleutel}`;
  const antwoord = await fetch(`${url}/rest/v1/marketing_metingen?on_conflict=metric,periode_start`, {
    method: 'POST',
    headers,
    body: JSON.stringify(rijen),
  });
  if (!antwoord.ok) throw new Error(`Supabase weigert (${antwoord.status}): ${await antwoord.text()}`);
}

export async function draai(env = process.env, log = console.log, moment = new Date()) {
  const actief = BRONNEN.filter(b => env[b.token]);
  if (!actief.length) {
    log('Nog geen Meta-token ingesteld. Niets opgehaald.');
    return { rijen: [], fouten: [] };
  }
  if (!env.SUPABASE_URL || !env.SUPABASE_SECRET_KEY) {
    return { rijen: [], fouten: ['SUPABASE_URL of SUPABASE_SECRET_KEY ontbreekt.'] };
  }

  // Elke dag het cijfer van deze week bijwerken: wat er zondag staat, is het cijfer van die week.
  const periodeStart = maandagVan(vandaag(moment));
  const rijen = [];
  const fouten = [];
  for (const bron of actief) {
    try {
      const { rijen: nieuw, missend } = metingenVoor(bron, await haalPagina(env[bron.token]), periodeStart);
      for (const r of nieuw) log(`${bron.naam}: ${r.metric} = ${r.waarde}`);
      rijen.push(...nieuw);
      fouten.push(...missend);
    } catch (e) {
      fouten.push(`${bron.naam}: ${e.message}`);
    }
  }

  if (rijen.length) {
    try {
      await opslaan(rijen, { url: env.SUPABASE_URL, sleutel: env.SUPABASE_SECRET_KEY });
      log(`Week van ${periodeStart}: ${rijen.length} cijfers opgeslagen.`);
    } catch (e) {
      fouten.push(e.message);
    }
  }
  return { rijen, fouten };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const { fouten } = await draai();
  for (const f of fouten) console.error(f);
  // Een rode run stuurt Daan een mail van GitHub: zo valt een verlopen token op.
  if (fouten.length) process.exitCode = 1;
}
